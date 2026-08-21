import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateManifest } from '../installer/pi-runtime';

export function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'haily-pi-runtime-'));
}

export const manifest = validateManifest({
  command: 'pi',
  packageName: '@earendil-works/pi-coding-agent',
  packageVersion: '0.84.2',
  supportedVersionRange: '>=0.84.2 <0.85.0',
  versionArgs: ['--version'],
  installArgs: ['install', '-g', '--ignore-scripts', '@earendil-works/pi-coding-agent@0.84.2'],
});
