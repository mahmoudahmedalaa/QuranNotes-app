#!/usr/bin/env node

const {
  fetchDocument,
  getAccessToken,
  patchDocument,
} = require('./lib/firebase-admin-rest');

function getArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const DEFAULT_CONFIG = {
  enabled: false,
  grandfatherBefore: '2026-05-18T00:00:00.000Z',
  rolloutVersion: 1,
};

function parseFirestoreConfig(document) {
  if (!document?.fields) {
    return null;
  }

  return {
    enabled: document.fields.enabled?.booleanValue ?? DEFAULT_CONFIG.enabled,
    grandfatherBefore: document.fields.grandfatherBefore?.stringValue || DEFAULT_CONFIG.grandfatherBefore,
    rolloutVersion: Number(document.fields.rolloutVersion?.integerValue || DEFAULT_CONFIG.rolloutVersion),
  };
}

function toDocumentFields(config) {
  return {
    enabled: { booleanValue: config.enabled },
    grandfatherBefore: { stringValue: config.grandfatherBefore },
    rolloutVersion: { integerValue: String(config.rolloutVersion) },
  };
}

function parseBoolean(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Invalid boolean value: ${value}. Use true or false.`);
}

function ensureIsoDate(value) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return new Date(timestamp).toISOString();
}

async function main() {
  const { accessToken, projectId } = await getAccessToken();
  const currentDoc = await fetchDocument(projectId, accessToken, 'config/paywallRollout');
  const currentConfig = parseFirestoreConfig(currentDoc) || DEFAULT_CONFIG;

  const enabledArg = getArg('enabled');
  const grandfatherBeforeArg = getArg('grandfather-before');
  const rolloutVersionArg = getArg('rollout-version');
  const shouldWrite = hasFlag('write');

  const nextConfig = {
    enabled: parseBoolean(enabledArg, currentConfig.enabled),
    grandfatherBefore: grandfatherBeforeArg
      ? ensureIsoDate(grandfatherBeforeArg)
      : currentConfig.grandfatherBefore,
    rolloutVersion: rolloutVersionArg
      ? Number(rolloutVersionArg)
      : currentConfig.rolloutVersion,
  };

  if (!Number.isInteger(nextConfig.rolloutVersion) || nextConfig.rolloutVersion < 1) {
    throw new Error(`Invalid rollout version: ${String(rolloutVersionArg)}`);
  }

  const hasChanges = JSON.stringify(currentConfig) !== JSON.stringify(nextConfig);
  const needsWrite = !currentDoc || hasChanges;

  if (shouldWrite && needsWrite) {
    await patchDocument(
      projectId,
      accessToken,
      'config/paywallRollout',
      toDocumentFields(nextConfig),
      ['enabled', 'grandfatherBefore', 'rolloutVersion'],
    );
  }

  console.log(JSON.stringify({
    mode: shouldWrite ? 'write' : 'dry-run',
    projectId,
    documentExists: !!currentDoc,
    changed: hasChanges,
    needsWrite,
    currentConfig,
    nextConfig,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
