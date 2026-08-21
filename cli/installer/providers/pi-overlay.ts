import * as fs from 'node:fs';
import * as path from 'node:path';
import { assertManagedPathWithinRoot, copyManagedResource, isManagedResource, removeManagedResource, writeManagedMarker } from './native-resource.js';
import { readPiOverlayManifest, type PiOverlayResource } from './pi-overlay-manifest.js';
import { planPiOverlaySettings, planPiOverlaySettingsRemoval, writeFileAtomically, writeSettingsAtomically, type AtomicFileCommit } from './pi-overlay-settings.js';
import type { OverlayInstallResult, OverlayUninstallResult } from '../commands/overlay-lifecycle.js';

const OVERLAY_STATE = 'hailykit-installed-pi-overlay.json';

interface OverlayState { resources: PiOverlayResource[]; ownedKeys: string[]; }
interface CommitState { targetPath: string; markerPath: string; backupPath: string | null; markerBackupPath: string | null; created: boolean; }
interface StagedResource { resource: PiOverlayResource; targetPath: string; markerPath: string; tempPath: string; }

function statePath(targetProviderDir: string): string { return path.join(targetProviderDir, OVERLAY_STATE); }
function readState(targetProviderDir: string): OverlayState {
  try { return JSON.parse(fs.readFileSync(statePath(targetProviderDir), 'utf8')) as OverlayState; } catch { return { resources: [], ownedKeys: [] }; }
}
function siblingTemp(targetPath: string): string { return `${targetPath}.hailykit-tmp`; }
function siblingBackup(targetPath: string): string { return `${targetPath}.hailykit-old`; }
function markerPayload(resource: PiOverlayResource): { provider: string; kind: string; name: string } {
  return { provider: 'pi', kind: `overlay-${resource.kind}`, name: resource.name };
}
function ensureSafe(rootPath: string, candidatePath: string): void { assertManagedPathWithinRoot(rootPath, candidatePath); }
function isSymbolicLink(candidatePath: string): boolean { return fs.existsSync(candidatePath) && fs.lstatSync(candidatePath).isSymbolicLink(); }
function markerLivesInsideTarget(targetPath: string, markerPath: string): boolean {
  const relative = path.relative(path.resolve(targetPath), path.resolve(markerPath));
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function removeIfExists(targetPath: string): void {
  if (!fs.existsSync(targetPath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true });
}
function restoreIfNeeded(fromPath: string | null, targetPath: string): void {
  if (fromPath && fs.existsSync(fromPath) && !fs.existsSync(targetPath)) fs.renameSync(fromPath, targetPath);
}
function finalizeQuiet(state: CommitState): void {
  try { finalizeResource(state); } catch {}
}
function clearBackupPath(backupPath: string | null, requiredPath: string): void {
  if (!backupPath || !fs.existsSync(backupPath)) return;
  if (!fs.existsSync(requiredPath)) throw new Error(`Refusing backup cleanup without current resource: ${requiredPath}`);
  fs.rmSync(backupPath, { recursive: true, force: true });
}

function stageResource(sourceRoot: string, targetRoot: string, resource: PiOverlayResource): StagedResource {
  const sourcePath = path.join(sourceRoot, resource.source);
  const targetPath = path.join(targetRoot, resource.target);
  const markerPath = path.join(targetRoot, resource.marker);
  const tempPath = siblingTemp(targetPath);
  ensureSafe(sourceRoot, sourcePath);
  for (const candidate of [targetPath, markerPath, tempPath]) ensureSafe(targetRoot, candidate);
  if (!fs.existsSync(sourcePath)) throw new Error(`Pi overlay resource missing: ${resource.source}`);
  removeIfExists(tempPath);
  copyManagedResource(sourcePath, tempPath);
  return { resource, targetPath, markerPath, tempPath };
}

function backupMarkerPath(targetPath: string, markerPath: string): string | null {
  return fs.existsSync(markerPath) && !markerLivesInsideTarget(targetPath, markerPath) ? siblingBackup(markerPath) : null;
}

function commitResource(rootPath: string, staged: StagedResource): CommitState {
  const { resource, targetPath, markerPath, tempPath } = staged;
  if (isSymbolicLink(staged.targetPath) || isSymbolicLink(staged.markerPath)) {
    throw new Error(`Refusing symbolic-link target: ${resource.target}`);
  }
  const managed = isManagedResource(markerPath, 'pi', `overlay-${resource.kind}`, resource.name);
  if (fs.existsSync(targetPath) && !managed) throw new Error(`Unowned Pi overlay collision at ${resource.target}`);
  const backupPath = fs.existsSync(targetPath) ? siblingBackup(targetPath) : null;
  const markerBackupPath = backupMarkerPath(targetPath, markerPath);
  try {
    clearBackupPath(backupPath, targetPath);
    clearBackupPath(markerBackupPath, markerPath);
    if (backupPath) fs.renameSync(targetPath, backupPath);
    if (markerBackupPath) fs.renameSync(markerPath, markerBackupPath);
    fs.renameSync(tempPath, targetPath);
    writeManagedMarker(markerPath, markerPayload(resource));
    ensureSafe(rootPath, targetPath);
    return { targetPath, markerPath, backupPath, markerBackupPath, created: !backupPath };
  } catch (error) {
    removeIfExists(targetPath);
    restoreIfNeeded(markerBackupPath, markerPath);
    restoreIfNeeded(backupPath, targetPath);
    throw error;
  }
}

function retireManagedResource(rootPath: string, resource: PiOverlayResource): CommitState | null {
  const targetPath = path.join(rootPath, resource.target);
  const markerPath = path.join(rootPath, resource.marker);
  for (const candidate of [targetPath, markerPath]) ensureSafe(rootPath, candidate);
  if (isSymbolicLink(targetPath) || isSymbolicLink(markerPath)) return null;
  if (!isManagedResource(markerPath, 'pi', `overlay-${resource.kind}`, resource.name)) return null;
  const backupPath = fs.existsSync(targetPath) ? siblingBackup(targetPath) : null;
  const markerBackupPath = backupMarkerPath(targetPath, markerPath);
  if (!backupPath && !markerBackupPath) return null;
  try {
    clearBackupPath(backupPath, targetPath);
    clearBackupPath(markerBackupPath, markerPath);
    if (backupPath) fs.renameSync(targetPath, backupPath);
    if (markerBackupPath) fs.renameSync(markerPath, markerBackupPath);
    return { targetPath, markerPath, backupPath, markerBackupPath, created: false };
  } catch (error) {
    restoreIfNeeded(markerBackupPath, markerPath);
    restoreIfNeeded(backupPath, targetPath);
    throw error;
  }
}

function rollbackResource(state: CommitState): void {
  removeIfExists(state.targetPath);
  removeIfExists(state.markerPath);
  if (state.backupPath) fs.renameSync(state.backupPath, state.targetPath);
  if (state.markerBackupPath) fs.renameSync(state.markerBackupPath, state.markerPath);
}

function finalizeResource(state: CommitState): void {
  if (state.backupPath) removeIfExists(state.backupPath);
  if (state.markerBackupPath) removeIfExists(state.markerBackupPath);
}

export function installPiOverlay(extractedKitDir: string, targetProviderDir: string): OverlayInstallResult {
  const manifest = readPiOverlayManifest(extractedKitDir);
  const sourceRoot = path.join(extractedKitDir, 'pi');
  const previous = readState(targetProviderDir);
  const stateFilePath = statePath(targetProviderDir);
  const settingsPath = path.join(targetProviderDir, 'settings.json');
  const settingsPlan = planPiOverlaySettings(settingsPath, manifest.settings.ownedKeys, manifest.settings.values);
  const stale = previous.resources.filter((entry) => !manifest.resources.some((next) => next.kind === entry.kind && next.name === entry.name));
  const staged: StagedResource[] = [];
  const committed: CommitState[] = [];
  const retired: CommitState[] = [];
  let settingsCommit: AtomicFileCommit | null = null;
  let stateCommit: AtomicFileCommit | null = null;
  let skippedUser = 0;
  let result: OverlayInstallResult | null = null;
  try {
    for (const resource of manifest.resources) staged.push(stageResource(sourceRoot, targetProviderDir, resource));
    for (const item of staged) {
      if (fs.existsSync(item.targetPath) && !isManagedResource(item.markerPath, 'pi', `overlay-${item.resource.kind}`, item.resource.name)) {
        skippedUser++;
        continue;
      }
      committed.push(commitResource(targetProviderDir, item));
    }
    for (const resource of stale) {
      const retiredState = retireManagedResource(targetProviderDir, resource);
      if (retiredState) retired.push(retiredState);
    }
    if (settingsPlan.changed) settingsCommit = writeSettingsAtomically(settingsPath, settingsPlan.next);
    stateCommit = writeFileAtomically(stateFilePath, `${JSON.stringify({ resources: manifest.resources, ownedKeys: manifest.settings.ownedKeys }, null, 2)}\n`);
    result = {
      installed: committed.filter((item) => item.created).length,
      updated: committed.filter((item) => !item.created).length,
      removed: retired.length,
      skippedUser,
      settingsChanged: settingsPlan.changed,
    };
  } catch (error) {
    stateCommit?.rollback();
    settingsCommit?.rollback();
    for (const item of retired.reverse()) rollbackResource(item);
    for (const item of committed.reverse()) rollbackResource(item);
    throw error;
  } finally {
    for (const item of staged) removeIfExists(item.tempPath);
  }
  for (const item of [...committed, ...retired]) finalizeQuiet(item);
  try { settingsCommit?.finalize(); } catch {}
  try { stateCommit?.finalize(); } catch {}
  return result ?? { installed: 0, updated: 0, removed: 0, skippedUser, settingsChanged: settingsPlan.changed };
}

export function uninstallPiOverlay(targetProviderDir: string): OverlayUninstallResult {
  const previous = readState(targetProviderDir);
  const settingsPath = path.join(targetProviderDir, 'settings.json');
  const settingsPlan = planPiOverlaySettingsRemoval(settingsPath, previous.ownedKeys);
  if (settingsPlan.changed) writeSettingsAtomically(settingsPath, settingsPlan.next).finalize();
  let removed = 0;
  for (const resource of previous.resources) {
    if (removeManagedResource(targetProviderDir, path.join(targetProviderDir, resource.target), path.join(targetProviderDir, resource.marker), 'pi', `overlay-${resource.kind}`, resource.name)) {
      removed++;
    }
  }
  removeIfExists(statePath(targetProviderDir));
  return { removed, settingsChanged: settingsPlan.changed };
}
