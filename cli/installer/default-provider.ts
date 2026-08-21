export const DEFAULT_INSTALLER_PROVIDER = 'pi';

export function requestedInstallerProvider(provider?: string): string {
  return provider || DEFAULT_INSTALLER_PROVIDER;
}
