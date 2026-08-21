export interface PiRuntimeManifest {
  command: string;
  packageName: string;
  packageVersion: string;
  supportedVersionRange: string;
  versionArgs: string[];
  installArgs: string[];
  timeoutMs?: number;
  maxBufferBytes?: number;
}

export interface ProcessRunOptions {
  timeoutMs: number;
  maxBufferBytes: number;
}

export interface ProcessRunResult {
  stdout: string;
  stderr: string;
}

export interface ProcessRunner {
  exec(file: string, args: string[], options: ProcessRunOptions): Promise<ProcessRunResult>;
}

export interface PiRuntimePaths {
  env: NodeJS.ProcessEnv;
  cwd: string;
  homeDir: string;
}

export interface PiRuntimeState {
  commandPath: string;
  version: string;
  supported: boolean;
  source: 'path' | 'known-bin';
}

export interface PiRuntimeDeps {
  manifest?: PiRuntimeManifest;
  paths?: Partial<PiRuntimePaths>;
  runner?: ProcessRunner;
}
