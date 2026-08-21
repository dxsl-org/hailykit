import * as fs from 'node:fs';
import * as path from 'node:path';

const SAFE_NAME_RE = /^[A-Za-z][A-Za-z0-9-]*$/;

interface OwnershipMarker {
  provider: string;
  kind: string;
  name: string;
}

export interface ManagedResourcePaths {
  rootPath: string;
  manifestPath: string;
  targetPath(name: string): string;
  markerPath(name: string): string;
}

export interface InstallManagedResourceOptions {
  name: string;
  provider: string;
  kind: string;
  sourcePath: string;
  targetPath: string;
  markerPath: string;
  rootPath: string;
  transformMarkdown?: (content: string, sourcePath: string) => string;
}

function readMarker(markerPath: string): OwnershipMarker | null {
  try {
    const raw = JSON.parse(fs.readFileSync(markerPath, 'utf8')) as Partial<OwnershipMarker>;
    return typeof raw.provider === 'string' && typeof raw.kind === 'string' && typeof raw.name === 'string'
      ? { provider: raw.provider, kind: raw.kind, name: raw.name }
      : null;
  } catch {
    return null;
  }
}

function isManagedResource(markerPath: string, provider: string, kind: string, name: string): boolean {
  const marker = readMarker(markerPath);
  return marker?.provider === provider && marker.kind === kind && marker.name === name;
}

function copyResource(
  sourcePath: string,
  targetPath: string,
  transformMarkdown?: (content: string, sourcePath: string) => string,
): void {
  const stat = fs.lstatSync(sourcePath);
  if (stat.isSymbolicLink()) throw new Error(`Refusing symbolic-link resource: ${sourcePath}`);
  if (stat.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });
    for (const entry of fs.readdirSync(sourcePath, { withFileTypes: true })) {
      copyResource(
        path.join(sourcePath, entry.name),
        path.join(targetPath, entry.name),
        transformMarkdown,
      );
    }
    return;
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (transformMarkdown && sourcePath.endsWith('.md')) {
    fs.writeFileSync(targetPath, transformMarkdown(fs.readFileSync(sourcePath, 'utf8'), sourcePath), 'utf8');
    return;
  }
  fs.copyFileSync(sourcePath, targetPath);
}

function assertWithinRoot(rootPath: string, candidatePath: string): void {
  const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Managed resource path escapes provider root: ${candidatePath}`);
  }
}

function readManifest(manifestPath: string): string[] {
  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
    return Array.isArray(raw)
      ? raw.filter((entry): entry is string => typeof entry === 'string' && SAFE_NAME_RE.test(entry))
      : [];
  } catch {
    return [];
  }
}

function writeMarker(markerPath: string, provider: string, kind: string, name: string): void {
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(markerPath, `${JSON.stringify({ provider, kind, name })}\n`, 'utf8');
}

export function installManagedResource(options: InstallManagedResourceOptions): 'installed' | 'updated' | 'skipped-user' {
  const { name, provider, kind, sourcePath, targetPath, markerPath, rootPath, transformMarkdown } = options;
  if (!SAFE_NAME_RE.test(name)) {
    throw new Error(`Unsafe managed resource name: ${name}`);
  }
  assertWithinRoot(rootPath, targetPath);
  assertWithinRoot(rootPath, markerPath);
  if (fs.existsSync(targetPath) && fs.lstatSync(targetPath).isSymbolicLink()) {
    throw new Error(`Refusing symbolic-link target: ${targetPath}`);
  }
  const exists = fs.existsSync(targetPath);
  const managed = isManagedResource(markerPath, provider, kind, name);
  if (exists && !managed) return 'skipped-user';
  if (managed) {
    fs.rmSync(targetPath, { recursive: true, force: true });
    fs.rmSync(markerPath, { force: true });
  }
  copyResource(sourcePath, targetPath, transformMarkdown);
  writeMarker(markerPath, provider, kind, name);
  return exists ? 'updated' : 'installed';
}

export function writeManagedManifest(manifestPath: string, installedNames: string[]): void {
  if (installedNames.length === 0) {
    fs.rmSync(manifestPath, { force: true });
    return;
  }
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify([...installedNames].sort(), null, 2)}\n`, 'utf8');
}

export function pruneStaleManagedResources(
  provider: string,
  kind: string,
  installedNames: ReadonlySet<string>,
  paths: ManagedResourcePaths,
): number {
  let removed = 0;
  for (const name of readManifest(paths.manifestPath)) {
    if (installedNames.has(name)) continue;
    const markerPath = paths.markerPath(name);
    const targetPath = paths.targetPath(name);
    assertWithinRoot(paths.rootPath, targetPath);
    assertWithinRoot(paths.rootPath, markerPath);
    if (!isManagedResource(markerPath, provider, kind, name)) continue;
    if (fs.existsSync(targetPath) && fs.lstatSync(targetPath).isSymbolicLink()) continue;
    fs.rmSync(targetPath, { recursive: true, force: true });
    fs.rmSync(markerPath, { force: true });
    removed++;
  }
  return removed;
}

export function uninstallManagedResources(
  provider: string,
  kind: string,
  paths: ManagedResourcePaths,
): number {
  let removed = 0;
  for (const name of readManifest(paths.manifestPath)) {
    const markerPath = paths.markerPath(name);
    const targetPath = paths.targetPath(name);
    assertWithinRoot(paths.rootPath, targetPath);
    assertWithinRoot(paths.rootPath, markerPath);
    if (!isManagedResource(markerPath, provider, kind, name)) continue;
    if (fs.existsSync(targetPath) && fs.lstatSync(targetPath).isSymbolicLink()) continue;
    fs.rmSync(targetPath, { recursive: true, force: true });
    fs.rmSync(markerPath, { force: true });
    removed++;
  }
  fs.rmSync(paths.manifestPath, { force: true });
  return removed;
}
