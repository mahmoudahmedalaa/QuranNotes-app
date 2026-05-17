#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function getAccessToken(serviceAccountPath) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64UrlJson({ alg: 'RS256', typ: 'JWT' })}.${base64UrlJson({
    iss: serviceAccount.client_email,
    scope: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/identitytoolkit',
      'https://www.googleapis.com/auth/datastore',
    ].join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();

  const assertion = `${unsigned}.${signer.sign(serviceAccount.private_key, 'base64url')}`;
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`OAuth token request failed: ${response.status} ${JSON.stringify(json)}`);
  }

  return {
    accessToken: json.access_token,
    projectId: serviceAccount.project_id,
  };
}

async function listUsers(projectId, accessToken) {
  let nextPageToken = '';
  const users = [];

  do {
    const url = new URL(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet`);
    url.searchParams.set('maxResults', '1000');
    if (nextPageToken) {
      url.searchParams.set('nextPageToken', nextPageToken);
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to list auth users: ${response.status} ${JSON.stringify(json)}`);
    }

    users.push(...(json.users || []));
    nextPageToken = json.nextPageToken || '';
  } while (nextPageToken);

  return users;
}

function resolveServiceAccountPath() {
  const candidatePaths = [
    path.join(process.cwd(), 'secrets', 'service-account.json'),
    path.join(process.cwd(), '..', 'QuranApp', 'secrets', 'service-account.json'),
  ];

  const resolved = candidatePaths.find((candidate) => fs.existsSync(candidate));
  if (!resolved) {
    throw new Error('Could not find secrets/service-account.json in the current worktree or the main QuranApp checkout.');
  }

  return resolved;
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
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/access/state`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (response.status === 404) {
    return null;
  }

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to fetch access state for ${uid}: ${response.status} ${JSON.stringify(json)}`);
  }

  return json;
}

async function writeAccessState(projectId, accessToken, uid, record) {
  const fields = toDocumentFields(record);
  const mask = [
    'grandfathered',
    'evaluatedAt',
    'source',
    'rolloutVersion',
    'userCreatedAt',
  ].map((field) => `updateMask.fieldPaths=${field}`).join('&');

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/access/state?${mask}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    },
  );

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to write access state for ${uid}: ${response.status} ${JSON.stringify(json)}`);
  }
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

  const serviceAccountPath = resolveServiceAccountPath();
  const { accessToken, projectId } = await getAccessToken(serviceAccountPath);
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
