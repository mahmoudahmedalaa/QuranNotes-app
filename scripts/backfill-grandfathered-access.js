#!/usr/bin/env node

const {
  fetchDocument,
  getAccessToken,
  listUsers,
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

function toDocumentFields(record) {
  return {
    grandfathered: { booleanValue: record.grandfathered },
    evaluatedAt: { stringValue: record.evaluatedAt },
    source: { stringValue: record.source },
    rolloutVersion: { integerValue: String(record.rolloutVersion) },
    userCreatedAt: record.userCreatedAt
      ? { stringValue: record.userCreatedAt }
      : { nullValue: null },
  };
}

async function fetchAccessState(projectId, accessToken, uid) {
  return fetchDocument(projectId, accessToken, `users/${uid}/access/state`);
}

async function writeAccessState(projectId, accessToken, uid, record) {
  const fields = toDocumentFields(record);
  const updateMaskFields = [
    'grandfathered',
    'evaluatedAt',
    'source',
    'rolloutVersion',
    'userCreatedAt',
  ];

  await patchDocument(projectId, accessToken, `users/${uid}/access/state`, fields, updateMaskFields);
}

function computeRecord(user, cutoffIso, rolloutVersion) {
  const createdAtIso = user.createdAt ? new Date(Number(user.createdAt)).toISOString() : null;
  const cutoff = Date.parse(cutoffIso);
  const createdAtMillis = user.createdAt ? Number(user.createdAt) : 0;

  return {
    grandfathered: createdAtMillis > 0 && createdAtMillis < cutoff,
    evaluatedAt: new Date().toISOString(),
    source: 'auth_creation_time',
    rolloutVersion,
    userCreatedAt: createdAtIso,
  };
}

async function main() {
  const cutoffIso = getArg('cutoff', '2026-05-18T00:00:00.000Z');
  const rolloutVersion = Number(getArg('rollout-version', '1'));
  const shouldWrite = hasFlag('write');
  const shouldOverwrite = hasFlag('overwrite');

  const { accessToken, projectId } = await getAccessToken();
  const users = await listUsers(projectId, accessToken);

  const summary = {
    totalUsers: users.length,
    wouldGrandfather: 0,
    wouldRequireSubscription: 0,
    skippedExisting: 0,
    written: 0,
  };

  for (const user of users) {
    const record = computeRecord(user, cutoffIso, rolloutVersion);
    if (record.grandfathered) {
      summary.wouldGrandfather += 1;
    } else {
      summary.wouldRequireSubscription += 1;
    }

    const existing = await fetchAccessState(projectId, accessToken, user.localId);
    if (existing && !shouldOverwrite) {
      summary.skippedExisting += 1;
      continue;
    }

    if (shouldWrite) {
      await writeAccessState(projectId, accessToken, user.localId, record);
      summary.written += 1;
    }
  }

  console.log(JSON.stringify({
    mode: shouldWrite ? 'write' : 'dry-run',
    cutoffIso,
    rolloutVersion,
    overwriteExisting: shouldOverwrite,
    summary,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
