export interface HailykitSettings {
  modules: { task: boolean; plan: boolean; presets: boolean; safety: boolean; diagnostics: boolean };
  plan: { command: string; readOnlyTools: string[] };
  safety: {
    requireProjectTrust: boolean;
    guardDirtyRepo: boolean;
    confirmDestructive: boolean;
    protectedPaths: string[];
  };
  presets: {
    command: string;
    defaultName?: string;
    definitions: Record<string, { tier?: string; thinkingLevel?: string; tools?: string[] }>;
  };
}

export interface HailykitRuntime {
  settings: HailykitSettings;
  warnings: string[];
  activePreset?: string;
  planState: { enabled: boolean; toolsBeforePlanMode?: string[]; restored?: boolean };
}
