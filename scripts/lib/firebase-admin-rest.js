const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Buffer } = require('buffer');

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
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

async function getAccessToken(serviceAccountPath = resolveServiceAccountPath()) {
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
    serviceAccountPath,
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

async function runAggregationQuery(projectId, accessToken, from) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runAggregationQuery`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredAggregationQuery: {
          aggregations: [{ alias: 'count', count: {} }],
          structuredQuery: { from: [from] },
        },
      }),
    },
  );

  const json = JSON.parse(await response.text());
  if (!response.ok) {
    throw new Error(`Aggregation query failed: ${response.status} ${JSON.stringify(json)}`);
  }

  return Number(json[0]?.result?.aggregateFields?.count?.integerValue || 0);
}

async function runQuery(projectId, accessToken, structuredQuery) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ structuredQuery }),
    },
  );

  const json = JSON.parse(await response.text());
  if (!response.ok) {
    throw new Error(`RunQuery failed: ${response.status} ${JSON.stringify(json)}`);
  }

  return json.filter((entry) => entry.document).map((entry) => entry.document);
}

function firestoreDocumentUrl(projectId, documentPath) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${documentPath}`;
}

async function fetchDocument(projectId, accessToken, documentPath) {
  const response = await fetch(firestoreDocumentUrl(projectId, documentPath), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 404) {
    return null;
  }

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to fetch document ${documentPath}: ${response.status} ${JSON.stringify(json)}`);
  }

  return json;
}

async function patchDocument(projectId, accessToken, documentPath, fields, updateMaskFields) {
  const mask = updateMaskFields
    .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join('&');

  const response = await fetch(
    `${firestoreDocumentUrl(projectId, documentPath)}?${mask}`,
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
    throw new Error(`Failed to patch document ${documentPath}: ${response.status} ${JSON.stringify(json)}`);
  }

  return json;
}

function asMillis(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

module.exports = {
  asMillis,
  fetchDocument,
  getAccessToken,
  listUsers,
  patchDocument,
  resolveServiceAccountPath,
  runAggregationQuery,
  runQuery,
};
