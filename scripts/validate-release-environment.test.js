const assert = require('node:assert/strict');
const test = require('node:test');

const {
  loadReleaseEnvironment,
  runReleaseEnvironmentValidation,
  validateReleaseEnvironment,
} = require('./validate-release-environment');
const {
  validateReleaseMetadataSources,
} = require('./validate-release-metadata');

const FIREBASE_VARIABLES = {
  EXPO_PUBLIC_FIREBASE_API_KEY: 'firebase-api-key-fixture',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'auth.example.test',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'project-fixture',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'bucket.example.test',
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'sender-fixture',
  EXPO_PUBLIC_FIREBASE_APP_ID: 'app-fixture',
  EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID: 'web-client-fixture',
};

function serializeEnvironment(environment) {
  return Object.entries(environment)
    .map(([name, value]) => `${name}=${value}`)
    .join('\n');
}

function createFileReader(files) {
  return (filePath) => {
    if (!(filePath in files)) {
      const error = new Error(`Missing fixture file: ${filePath}`);
      error.code = 'ENOENT';
      throw error;
    }

    return files[filePath];
  };
}

function createMetadataFixture(overrides = {}) {
  const version = overrides.version || '2.2.2';
  const build = overrides.build || '50';
  const widgetBuild = overrides.widgetBuild || build;

  return {
    appJsonContents: JSON.stringify({
      expo: { version, ios: { buildNumber: build } },
    }),
    projectContents: `
      isa = XCBuildConfiguration;
      baseConfigurationReference = FIXTURE /* Pods-QuranNotes.release.xcconfig */;
      buildSettings = {
        CURRENT_PROJECT_VERSION = ${build};
        INFOPLIST_FILE = QuranNotes/Info.plist;
        MARKETING_VERSION = ${version};
      };
      name = Release;
      isa = XCBuildConfiguration;
      buildSettings = {
        CURRENT_PROJECT_VERSION = ${widgetBuild};
        INFOPLIST_FILE = ../targets/widget/Info.plist;
        MARKETING_VERSION = ${version};
      };
      name = Release;
    `,
    appInfoPlistContents: `
      <key>CFBundleShortVersionString</key>
      <string>$(MARKETING_VERSION)</string>
      <key>CFBundleVersion</key>
      <string>$(CURRENT_PROJECT_VERSION)</string>
    `,
    widgetInfoPlistContents: `
      <key>CFBundleShortVersionString</key>
      <string>$(MARKETING_VERSION)</string>
      <key>CFBundleVersion</key>
      <string>$(CURRENT_PROJECT_VERSION)</string>
    `,
    approvedVersion: overrides.approvedVersion,
    approvedBuild: overrides.approvedBuild,
  };
}

test('accepts a complete environment for the selected platform', () => {
  const result = validateReleaseEnvironment({
    environment: {
      ...FIREBASE_VARIABLES,
      EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'revenuecat-ios-fixture',
    },
    platform: 'ios',
  });

  assert.deepEqual(result, { missingVariables: [], platform: 'ios' });
});

test('reports only the missing variable names', () => {
  const result = validateReleaseEnvironment({
    environment: {
      ...FIREBASE_VARIABLES,
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: '',
    },
    platform: 'android',
  });

  assert.deepEqual(result.missingVariables, [
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
  ]);
});

test('.env.local takes precedence over .env without reading the live environment', () => {
  const environment = loadReleaseEnvironment({
    cwd: '/virtual-project',
    inheritedEnvironment: {},
    readFile: createFileReader({
      '/virtual-project/.env.local':
        'EXPO_PUBLIC_FIREBASE_API_KEY=local-fixture',
      '/virtual-project/.env': serializeEnvironment({
        ...FIREBASE_VARIABLES,
        EXPO_PUBLIC_FIREBASE_API_KEY: 'base-fixture',
        EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'revenuecat-ios-fixture',
      }),
    }),
  });

  assert.equal(environment.EXPO_PUBLIC_FIREBASE_API_KEY, 'local-fixture');
  assert.equal(environment.EXPO_PUBLIC_FIREBASE_PROJECT_ID, 'project-fixture');
});

test('CLI-safe reporting never leaks configured values', () => {
  let stdout = '';
  let stderr = '';
  const secretFixture = 'must-not-appear-in-output';

  const exitCode = runReleaseEnvironmentValidation({
    environment: {
      ...FIREBASE_VARIABLES,
      EXPO_PUBLIC_FIREBASE_API_KEY: secretFixture,
    },
    platform: 'ios',
    stdout: (message) => {
      stdout += message;
    },
    stderr: (message) => {
      stderr += message;
    },
  });

  assert.equal(exitCode, 1);
  assert.match(stderr, /EXPO_PUBLIC_REVENUECAT_IOS_KEY/);
  assert.doesNotMatch(`${stdout}${stderr}`, new RegExp(secretFixture));
});

test('metadata validation accepts matching app and native target values', () => {
  const result = validateReleaseMetadataSources(createMetadataFixture());

  assert.deepEqual(result, { build: '50', version: '2.2.2' });
});

test('metadata validation rejects a native target mismatch', () => {
  assert.throws(
    () =>
      validateReleaseMetadataSources(
        createMetadataFixture({ widgetBuild: '49' }),
      ),
    /widget.*CURRENT_PROJECT_VERSION.*49.*50/,
  );
});

test('metadata validation enforces approved release values', () => {
  assert.throws(
    () =>
      validateReleaseMetadataSources(
        createMetadataFixture({
          approvedBuild: '51',
          approvedVersion: '2.2.2',
        }),
      ),
    /approved build 51/,
  );
});
