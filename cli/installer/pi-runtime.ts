import { resolveManifest, validateManifest } from './pi-runtime-manifest.js';
import { defaultPaths, existingExecutable, knownBinDirs, npmInvocations, runtimeOptions } from './pi-runtime-paths.js';
import { defaultRunner, formatExecFailure } from './pi-runtime-process.js';
import { readVersionText, versionSatisfies } from './pi-runtime-version.js';
import type { PiRuntimeDeps, PiRuntimeState } from './pi-runtime-types.js';

export type {
  PiRuntimeDeps,
  PiRuntimeManifest,
  PiRuntimePaths,
  PiRuntimeState,
  ProcessRunOptions,
  ProcessRunResult,
  ProcessRunner,
} from './pi-runtime-types.js';

export { validateManifest };

export async function detectPiRuntime(deps: PiRuntimeDeps = {}): Promise<PiRuntimeState | null> {
  const paths = { ...defaultPaths(), ...deps.paths };
  const manifest = resolveManifest(deps, paths.cwd);
  const runner = deps.runner ?? defaultRunner;
  const found = existingExecutable(manifest.command, knownBinDirs(paths), paths.env);
  if (!found) return null;
  const output = await runner.exec(found.commandPath, manifest.versionArgs, runtimeOptions(manifest));
  const version = readVersionText(output);
  return {
    commandPath: found.commandPath,
    version,
    supported: versionSatisfies(version, manifest.supportedVersionRange),
    source: found.source,
  };
}

export async function ensurePiRuntime(deps: PiRuntimeDeps = {}): Promise<PiRuntimeState> {
  const paths = { ...defaultPaths(), ...deps.paths };
  const manifest = resolveManifest(deps, paths.cwd);
  const runner = deps.runner ?? defaultRunner;
  const current = await detectPiRuntime({ ...deps, manifest, runner, paths });
  if (current) {
    if (!current.supported) {
      throw new Error(`Detected Pi ${current.version} at ${current.commandPath}, outside supported range ${manifest.supportedVersionRange}.`);
    }
    return current;
  }

  let installError = 'npm could not be resolved';
  for (const invocation of npmInvocations(paths)) {
    try {
      await runner.exec(invocation.file, [...invocation.args, ...manifest.installArgs], runtimeOptions(manifest));
      const resolved = await detectPiRuntime({ ...deps, manifest, runner, paths });
      if (!resolved) {
        throw new Error(
          `Pi installed but ${manifest.command} is still not resolvable. Restart the shell or add the npm global bin directory to PATH.`,
        );
      }
      if (!resolved.supported) {
        throw new Error(`Installed Pi ${resolved.version}, outside supported range ${manifest.supportedVersionRange}.`);
      }
      return resolved;
    } catch (error) {
      const message = formatExecFailure(error);
      if (message === 'command not found') continue;
      installError = message;
      break;
    }
  }
  throw new Error(`Unable to install official Pi runtime ${manifest.packageName}@${manifest.packageVersion}: ${installError}.`);
}
