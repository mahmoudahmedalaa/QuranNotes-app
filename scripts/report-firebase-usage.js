#!/usr/bin/env node

const {
  asMillis,
  fetchDocument,
  getAccessToken,
  listUsers,
  runAggregationQuery,
  runQuery,
} = require('./lib/firebase-admin-rest');

function daysAgo(days) {
  return Date.now() - (days * 24 * 60 * 60 * 1000);
}

function renderMarkdown(report) {
  const providerLines = report.auth.providers
    .map(([provider, count]) => `- ${provider}: ${count}`)
    .join('\n');
  const rolloutConfigLines = report.paywallRollout.exists
    ? [
        `- Config document: present`,
        `- Enabled: ${String(report.paywallRollout.enabled)}`,
        `- Grandfather before: ${report.paywallRollout.grandfatherBefore}`,
        `- Rollout version: ${report.paywallRollout.rolloutVersion}`,
      ].join('\n')
    : `- Config document: missing (app falls back to code default)`;

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
    ``,
    `## Paywall Rollout`,
    rolloutConfigLines,
  ].join('\n');
}

function parsePaywallRolloutConfig(document) {
  if (!document?.fields) {
    return {
      exists: false,
      enabled: false,
      grandfatherBefore: null,
      rolloutVersion: null,
    };
  }

  return {
    exists: true,
    enabled: document.fields.enabled?.booleanValue ?? false,
    grandfatherBefore: document.fields.grandfatherBefore?.stringValue || null,
    rolloutVersion: Number(document.fields.rolloutVersion?.integerValue || 0) || null,
  };
}

async function main() {
  const { accessToken, projectId } = await getAccessToken();
  const users = await listUsers(projectId, accessToken);

  const authUsers = users.map((user) => ({
    uid: user.localId,
    createdAt: asMillis(user.createdAt),
    lastLoginAt: asMillis(user.lastLoginAt),
    providers: (user.providerUserInfo || []).map((provider) => provider.providerId),
  }));
  const paywallRolloutConfig = await fetchDocument(projectId, accessToken, 'config/paywallRollout');

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
    paywallRollout: parsePaywallRolloutConfig(paywallRolloutConfig),
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
