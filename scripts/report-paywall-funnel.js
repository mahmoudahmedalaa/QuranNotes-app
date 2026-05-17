#!/usr/bin/env node

const {
  getAccessToken,
  runQuery,
} = require('./lib/firebase-admin-rest');

function parseValue(field) {
  if (!field || typeof field !== 'object') {
    return null;
  }

  if ('stringValue' in field) return field.stringValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return Number(field.doubleValue);
  if ('timestampValue' in field) return field.timestampValue;
  if ('nullValue' in field) return null;

  return null;
}

function fieldsToObject(document) {
  const fields = document?.fields || {};
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, parseValue(value)]),
  );
}

function parseUserIdFromDocumentName(name) {
  const parts = name.split('/');
  const usersIndex = parts.indexOf('users');
  if (usersIndex === -1 || !parts[usersIndex + 1]) {
    return null;
  }
  return parts[usersIndex + 1];
}

function daysAgoIso(days) {
  return new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
}

function isOnOrAfter(value, cutoffIso) {
  if (!value) return false;
  return value >= cutoffIso;
}

function increment(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function sortedEntries(object) {
  return Object.entries(object).sort((a, b) => b[1] - a[1]);
}

function renderMap(entries, emptyLabel = 'None') {
  if (!entries.length) {
    return `- ${emptyLabel}`;
  }

  return entries.map(([key, value]) => `- ${key}: ${value}`).join('\n');
}

function renderMarkdown(report) {
  return [
    '# Paywall Funnel Report',
    '',
    `Generated at: ${report.generatedAt}`,
    `Project: \`${report.projectId}\``,
    '',
    '## Coverage',
    `- Metrics summary docs: ${report.coverage.metricsSummaryDocs}`,
    `- Telemetry event docs: ${report.coverage.telemetryEventDocs}`,
    `- Unique users in telemetry events: ${report.coverage.uniqueEventUsers}`,
    '',
    '## Activity',
    `- Users seen in last 7 days: ${report.activity.activeUsers7d}`,
    `- Users seen in last 30 days: ${report.activity.activeUsers30d}`,
    `- Total app opens recorded: ${report.activity.totalAppOpens}`,
    '',
    '## Paywall',
    `- Users with at least one paywall view: ${report.paywall.usersWithPaywallView}`,
    `- Total paywall views: ${report.paywall.totalViews}`,
    `- Hard-paywall views: ${report.paywall.hardViews}`,
    `- Soft-paywall views: ${report.paywall.softViews}`,
    '- Views by location:',
    renderMap(sortedEntries(report.paywall.viewsByLocation)),
    '- Views by reason:',
    renderMap(sortedEntries(report.paywall.viewsByReason)),
    '',
    '## Subscription Events',
    '- Outcomes:',
    renderMap(sortedEntries(report.subscription.outcomes)),
    '- Outcomes by location:',
    renderMap(sortedEntries(report.subscription.outcomesByLocation)),
    `- Successful purchases: ${report.subscription.successCount}`,
    `- Restores: ${report.subscription.restoreCount}`,
    `- Failures: ${report.subscription.failureCount}`,
    `- Cancellations: ${report.subscription.cancelledCount}`,
    '',
    '## Onboarding',
    `- Users with onboarding completion tracked: ${report.onboarding.usersCompleted}`,
    `- Onboarding skipped: ${report.onboarding.skippedCount}`,
    `- Onboarding completed without skip: ${report.onboarding.completedCount}`,
    '',
    '## Segments',
    `- Last-known Pro users in metrics summaries: ${report.segments.lastKnownProUsers}`,
    `- Last-known grandfathered users in metrics summaries: ${report.segments.lastKnownGrandfatheredUsers}`,
    `- Last-known non-grandfathered users in metrics summaries: ${report.segments.lastKnownStandardUsers}`,
  ].join('\n');
}

async function main() {
  const { accessToken, projectId } = await getAccessToken();

  const [metricDocs, eventDocs] = await Promise.all([
    runQuery(projectId, accessToken, {
      from: [{ collectionId: 'metrics', allDescendants: true }],
      limit: 5000,
    }),
    runQuery(projectId, accessToken, {
      from: [{ collectionId: 'telemetry_events', allDescendants: true }],
      limit: 5000,
    }),
  ]);

  const metrics = metricDocs
    .filter((doc) => doc.name.endsWith('/summary'))
    .map((doc) => ({
      userId: parseUserIdFromDocumentName(doc.name),
      data: fieldsToObject(doc),
    }));

  const events = eventDocs.map((doc) => ({
    userId: parseUserIdFromDocumentName(doc.name),
    data: fieldsToObject(doc),
  }));

  const active7dCutoff = daysAgoIso(7);
  const active30dCutoff = daysAgoIso(30);

  const paywallViewsByLocation = {};
  const paywallViewsByReason = {};
  const subscriptionOutcomes = {};
  const subscriptionOutcomesByLocation = {};
  const uniqueEventUsers = new Set(events.map((event) => event.userId).filter(Boolean));

  for (const event of events) {
    if (event.data.type === 'paywall_view') {
      increment(paywallViewsByLocation, event.data.location || 'unknown');
      increment(paywallViewsByReason, event.data.reason || 'unknown');
    }

    if (event.data.type === 'subscription_event') {
      increment(subscriptionOutcomes, event.data.outcome || 'unknown');
      increment(
        subscriptionOutcomesByLocation,
        `${event.data.location || 'unknown'}:${event.data.outcome || 'unknown'}`,
      );
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    projectId,
    coverage: {
      metricsSummaryDocs: metrics.length,
      telemetryEventDocs: events.length,
      uniqueEventUsers: uniqueEventUsers.size,
    },
    activity: {
      activeUsers7d: metrics.filter((metric) => isOnOrAfter(metric.data.lastSeenClientAt, active7dCutoff)).length,
      activeUsers30d: metrics.filter((metric) => isOnOrAfter(metric.data.lastSeenClientAt, active30dCutoff)).length,
      totalAppOpens: metrics.reduce((total, metric) => total + (metric.data.appOpenCount || 0), 0),
    },
    paywall: {
      usersWithPaywallView: metrics.filter((metric) => Boolean(metric.data.lastPaywallViewAt || metric.data.lastPaywallViewClientAt)).length,
      totalViews: metrics.reduce((total, metric) => total + (metric.data.paywallViewCount || 0), 0),
      hardViews: events.filter((event) => event.data.type === 'paywall_view' && event.data.hardPaywall === true).length,
      softViews: events.filter((event) => event.data.type === 'paywall_view' && event.data.hardPaywall === false).length,
      viewsByLocation: paywallViewsByLocation,
      viewsByReason: paywallViewsByReason,
    },
    subscription: {
      outcomes: subscriptionOutcomes,
      outcomesByLocation: subscriptionOutcomesByLocation,
      successCount: events.filter((event) => event.data.type === 'subscription_event' && event.data.outcome === 'success').length,
      restoreCount: events.filter((event) => event.data.type === 'subscription_event' && event.data.outcome === 'restored').length,
      failureCount: events.filter((event) => event.data.type === 'subscription_event' && event.data.outcome === 'failed').length,
      cancelledCount: events.filter((event) => event.data.type === 'subscription_event' && event.data.outcome === 'cancelled').length,
    },
    onboarding: {
      usersCompleted: metrics.filter((metric) => Boolean(metric.data.onboardingCompletedAt || metric.data.onboardingCompletedClientAt)).length,
      skippedCount: metrics.filter((metric) => metric.data.onboardingSkipped === true).length,
      completedCount: metrics.filter((metric) => metric.data.onboardingCompletedAt && metric.data.onboardingSkipped !== true).length,
    },
    segments: {
      lastKnownProUsers: metrics.filter((metric) => metric.data.lastKnownIsPro === true).length,
      lastKnownGrandfatheredUsers: metrics.filter((metric) => metric.data.lastKnownGrandfathered === true).length,
      lastKnownStandardUsers: metrics.filter((metric) => metric.data.lastKnownGrandfathered === false).length,
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
