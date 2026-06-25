import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../config/space-owners.json');

let cachedConfig = null;

export function loadSpaceOwnerConfig() {
  if (cachedConfig) return cachedConfig;
  cachedConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  return cachedConfig;
}

/** Resolve the maintainer for a Confluence space. */
export function resolveSpaceOwner(spaceKey, spaceName, config = loadSpaceOwnerConfig()) {
  const key = spaceKey || spaceName || '';
  const overrides = config.spaceOverrides || {};

  if (key && overrides[key]) {
    return { ...normalizeOwner(overrides[key]), source: 'manual' };
  }

  const def = config.defaultOwner;
  if (def?.name?.trim()) {
    return { ...normalizeOwner(def), source: 'default' };
  }

  return { name: '', email: '', slackId: '', source: 'unassigned' };
}

function normalizeOwner(owner) {
  return {
    name: owner?.name?.trim() || '',
    email: owner?.email?.trim() || '',
    slackId: owner?.slackId?.trim() || '',
  };
}
