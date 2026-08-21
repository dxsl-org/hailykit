import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PiOverlayResource {
  kind: 'extension' | 'prompt';
  name: string;
  source: string;
  target: string;
  marker: string;
}

export interface PiOverlayManifest {
  format: 1;
  provider: 'pi';
  compatibility: { runtimeRange: string };
  settings: { ownedKeys: string[]; values: Record<string, unknown> };
  resources: PiOverlayResource[];
}

function safeRelative(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || path.isAbsolute(value)) {
    throw new Error(`Invalid Pi overlay manifest: ${label} must be a non-empty relative path.`);
  }
  const normalized = value.replace(/\\/g, '/');
  if (normalized.startsWith('../') || normalized.includes('/../') || normalized === '..') {
    throw new Error(`Invalid Pi overlay manifest: ${label} escapes its root.`);
  }
  return normalized;
}

function safeName(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(value)) {
    throw new Error(`Invalid Pi overlay manifest: ${label} must be a safe name.`);
  }
  return value;
}

function ownedKeysAndValues(raw: Record<string, unknown>): { ownedKeys: string[]; values: Record<string, unknown> } {
  const ownedKeysRaw = raw.ownedKeys;
  const values = raw.values;
  if (!Array.isArray(ownedKeysRaw) || typeof values !== 'object' || values === null || Array.isArray(values)) {
    throw new Error('Invalid Pi overlay manifest: settings.ownedKeys and settings.values are required.');
  }
  const ownedKeys = ownedKeysRaw.map((entry, index) => {
    if (typeof entry !== 'string' || !/^[A-Za-z0-9._-]+$/.test(entry)) {
      throw new Error(`Invalid Pi overlay manifest: settings.ownedKeys[${index}] must be a safe key.`);
    }
    return entry;
  });
  if (ownedKeys.length === 0 || new Set(ownedKeys).size !== ownedKeys.length) {
    throw new Error('Invalid Pi overlay manifest: settings.ownedKeys must be unique and non-empty.');
  }
  const valueKeys = Object.keys(values);
  if (valueKeys.length !== ownedKeys.length || ownedKeys.some((key) => !(key in values)) || valueKeys.some((key) => !ownedKeys.includes(key))) {
    throw new Error('Invalid Pi overlay manifest: settings.values keys must exactly match settings.ownedKeys.');
  }
  return { ownedKeys, values: values as Record<string, unknown> };
}

export function validatePiOverlayManifest(raw: unknown): PiOverlayManifest {
  const value = raw as Record<string, unknown>;
  if (typeof value !== 'object' || value === null || value.format !== 1 || value.provider !== 'pi') {
    throw new Error('Invalid Pi overlay manifest: expected format=1 provider=pi.');
  }
  const compatibility = value.compatibility as Record<string, unknown>;
  const settings = value.settings as Record<string, unknown>;
  const resources = value.resources;
  if (typeof compatibility !== 'object' || compatibility === null || typeof compatibility.runtimeRange !== 'string') {
    throw new Error('Invalid Pi overlay manifest: compatibility.runtimeRange is required.');
  }
  if (typeof settings !== 'object' || settings === null) throw new Error('Invalid Pi overlay manifest: settings are required.');
  const { ownedKeys, values } = ownedKeysAndValues(settings);
  if (!Array.isArray(resources) || resources.length === 0) throw new Error('Invalid Pi overlay manifest: resources must not be empty.');
  return {
    format: 1,
    provider: 'pi',
    compatibility: { runtimeRange: compatibility.runtimeRange },
    settings: { ownedKeys, values },
    resources: resources.map((entry, index) => {
      const resource = entry as Record<string, unknown>;
      if (resource.kind !== 'extension' && resource.kind !== 'prompt') {
        throw new Error(`Invalid Pi overlay manifest: resources[${index}].kind must be extension or prompt.`);
      }
      return {
        kind: resource.kind,
        name: safeName(resource.name, `resources[${index}].name`),
        source: safeRelative(resource.source, `resources[${index}].source`),
        target: safeRelative(resource.target, `resources[${index}].target`),
        marker: safeRelative(resource.marker, `resources[${index}].marker`),
      };
    }),
  };
}

export function readPiOverlayManifest(extractedKitDir: string): PiOverlayManifest {
  const manifestPath = path.join(extractedKitDir, 'pi', 'overlay.json');
  return validatePiOverlayManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown);
}
