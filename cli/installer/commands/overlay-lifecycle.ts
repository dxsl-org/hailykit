export interface OverlayInstallResult {
  installed: number;
  updated: number;
  removed: number;
  skippedUser: number;
  settingsChanged: boolean;
}

export interface OverlayUninstallResult {
  removed: number;
  settingsChanged: boolean;
}

export interface OverlayLifecycleProvider {
  installOverlay?(extractedKitDir: string, targetProviderDir: string): OverlayInstallResult | void;
  uninstallOverlay?(targetProviderDir: string): OverlayUninstallResult | void;
}

export function reportOverlayInstall(label: string, result: OverlayInstallResult | void): void {
  if (!result) return;
  const parts: string[] = [];
  if (result.installed > 0) parts.push(`installed ${result.installed}`);
  if (result.updated > 0) parts.push(`updated ${result.updated}`);
  if (result.removed > 0) parts.push(`removed ${result.removed}`);
  if (result.skippedUser > 0) parts.push(`skipped user-owned ${result.skippedUser}`);
  if (result.settingsChanged) parts.push('settings merged');
  console.log(`    Overlay (${label}): ${parts.join(', ') || 'no changes'}`);
}

export function reportOverlayUninstall(label: string, result: OverlayUninstallResult | void): void {
  if (!result) return;
  const parts: string[] = [];
  if (result.removed > 0) parts.push(`removed ${result.removed}`);
  if (result.settingsChanged) parts.push('settings cleaned');
  console.log(`    Overlay (${label}): ${parts.join(', ') || 'no changes'}`);
}
