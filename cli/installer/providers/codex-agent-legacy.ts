const GENERATED_AGENT_KEYS = new Set([
  'name',
  'description',
  'model',
  'model_reasoning_effort',
  'sandbox_mode',
  'developer_instructions',
]);

export interface GeneratedAgentShape {
  name: string;
  legacyFingerprints: string[];
}

export function isGeneratedCodexAgentToml(toml: string, expected: GeneratedAgentShape): boolean {
  let name: string | null = null;
  let sawDeveloperInstructions = false;
  let inDeveloperInstructions = false;
  const developerBody: string[] = [];
  for (const rawLine of toml.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (inDeveloperInstructions) {
      if (line === '"""') inDeveloperInstructions = false;
      else developerBody.push(rawLine);
      continue;
    }
    if (!line || line.startsWith('#')) continue;
    const assignment = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (!assignment) return false;
    const key = assignment[1];
    const value = assignment[2].trim();
    if (!GENERATED_AGENT_KEYS.has(key)) return false;
    if (key === 'developer_instructions') {
      if (value !== '"""') return false;
      sawDeveloperInstructions = true;
      inDeveloperInstructions = true;
      continue;
    }
    if (!value.startsWith('"') || !value.endsWith('"')) return false;
    try {
      const parsed = JSON.parse(value) as unknown;
      if (typeof parsed !== 'string') return false;
      if (key === 'name') name = parsed;
    } catch {
      return false;
    }
  }
  const developerText = developerBody.join('\n');
  const matched = expected.legacyFingerprints.filter((value) => developerText.includes(value));
  return expected.legacyFingerprints.length >= 2 &&
    !inDeveloperInstructions && sawDeveloperInstructions && name === expected.name &&
    developerText.trim().length > 0 && matched.length >= 2;
}
