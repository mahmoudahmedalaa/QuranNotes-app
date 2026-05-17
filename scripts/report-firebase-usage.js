#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function asMillis(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysAgo(days) {
  return Date.now() - (days * 24 * 60 * 60 * 1000);
}

function renderMarkdown(report) {
  const providerLines = report.auth.providers
    .map(([provider, count]) => `- ${provider}: ${count}`)
    .join('\n');

  return [
    `# Firebase Usage Report`,
    ``,
    `Generated at: ${report.generatedAt}`,
    `Project: \`${report.projectId}\``,
    ``,
    `## Auth`,
    `- Total users: ${report.auth.totalUsers}`,
    `- Active in last 7 days: ${report.auth.active7d}`,
    `- Active in last 30 days: ${report.auth.active30d}`,
    `- Active in last 90 days: ${report.auth.active90d}`,
    `- Latest login: ${report.auth.latestLoginAt}`,
    `- Newest account: ${report.auth.newestUserAt}`,
    `- Providers:`,
    providerLines,
    ``,
    `## Firestore`,
    `- Notes: ${report.firestore.notes}`,
    `- Recordings: ${report.firestore.recordings}`,
    `- Folders: ${report.firestore.folders}`,
    `- Pro sync docs: ${report.firestore.syncDocs}`,
    `- Distinct sync users: ${report.firestore.syncUsers}`,
    `- Access state docs: ${report.firestore.accessStateDocs}`,
    `- Metrics summary docs: ${report.firestore.metricsSummaryDocs}`,
    `- Telemetry event docs: ${report.firestore.telemetryEventDocs}`,
  ].join('\n');
}

async function main() {
  const candidatePaths = [
    path.join(process.cwd(), 'secrets', 'service-account.json'),
    path.join(process.cwd(), '..', 'QuranApp', 'secrets', 'service-account.json'),
  ];
  const serviceAccountPath = candidatePaths.find((candidate) => fs.existsSync(candidate));

  if (!serviceAccountPath) {
    throw new Error('Could not find secrets/service-account.json in the current worktree or the main QuranApp checkout.');
  }

  const { accessToken, projectId } = await getAccessToken(serviceAccountPath);
  const users = await listUsers(projectId, accessToken);

  const authUsers = users.map((user) => ({
    uid: user.localId,
    createdAt: asMillis(user.createdAt),
    lastLoginAt: asMillis(user.lastLoginAt),
    providers: (user.providerUserInfo || []).map((provider) => provider.providerId),
  }));

  const syncDocs = await runQuery(projectId, accessToken, {
    from: [{ collectionId: 'sync', allDescendants: true }],
    limit: 1000,
  });
  const syncUsers = new Set(syncDocs.map((doc) => doc.name.split('/')[6]));

  const report = {
    generatedAt: new Date().toISOString(),
    projectId,
    auth: {
      totalUsers: authUsers.length,
      active7d: authUsers.filter((user) => user.lastLoginAt >= daysAgo(7)).length,
      active30d: authUsers.filter((user) => user.lastLoginAt >= daysAgo(30)).length,
      active90d: authUsers.filter((user) => user.lastLoginAt >= daysAgo(90)).length,
      newestUserAt: new Date(Math.max(...authUsers.map((user) => user.createdAt || 0))).toISOString(),
      latestLoginAt: new Date(Math.max(...authUsers.map((user) => user.lastLoginAt || 0))).toISOString(),
      providers: Object.entries(authUsers.reduce((acc, user) => {
        const key = user.providers.sort().join('+') || 'password';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})).sort((a, b) => b[1] - a[1]),
    },
    firestore: {
      notes: await runAggregationQuery(projectId, accessToken, { collectionId: 'notes' }),
      recordings: await runAggregationQuery(projectId, accessToken, { collectionId: 'recordings' }),
      folders: await runAggregationQuery(projectId, accessToken, { collectionId: 'folders' }),
      syncDocs: await runAggregationQuery(projectId, accessToken, { collectionId: 'sync', allDescendants: true }),
      syncUsers: syncUsers.size,
      accessStateDocs: await runAggregationQuery(projectId, accessToken, { collectionId: 'access', allDescendants: true }),
      metricsSummaryDocs: await runAggregationQuery(projectId, accessToken, { collectionId: 'metrics', allDescendants: true }),
      telemetryEventDocs: await runAggregationQuery(projectId, accessToken, { collectionId: 'telemetry_events', allDescendants: true }),
    },
  };

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(renderMarkdown(report));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
