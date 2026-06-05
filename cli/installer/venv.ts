import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Run the skills venv setup script if present.
 * On Windows runs install.ps1; on Unix runs install.sh.
 * No-ops silently when the script file does not exist.
 *
 * @param claudeDir - Absolute path to the .claude/ directory containing skills/.
 */
export function setupVenv(claudeDir: string): void {
  const skillsDir = path.join(claudeDir, 'skills');

  if (process.platform === 'win32') {
    const ps1 = path.join(skillsDir, 'install.ps1');
    if (!fs.existsSync(ps1)) return;
    console.log('  Setting up Python venv...');
    execFileSync('powershell', ['-NonInteractive', '-File', ps1, '-Y'], { stdio: 'inherit' });
  } else {
    const sh = path.join(skillsDir, 'install.sh');
    if (!fs.existsSync(sh)) return;
    console.log('  Setting up Python venv...');
    execFileSync('bash', [sh, '-y'], { stdio: 'inherit' });
  }
}
