const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const {
  loadReleaseEnvironment,
  parseEnvironmentFile,
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

function loadValidatorWithoutNativeParseEnv() {
  const validatorPath = require.resolve('./validate-release-environment');
  const cachedValidator = require.cache[validatorPath];
  const originalLoad = Module._load;

  delete require.cache[validatorPath];
  Module._load = function loadWithoutNativeParseEnv(
    request,
    parent,
    isMain,
  ) {
    if (request === 'node:util') {
      return {};
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(validatorPath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[validatorPath];
    if (cachedValidator) {
      require.cache[validatorPath] = cachedValidator;
    }
  }
}

function createMetadataFixture(overrides = {}) {
  const version = overrides.version || '2.2.2';
  const build = overrides.build || '50';
  const widgetBuild = overrides.widgetBuild || build;
  const widgetReleaseBuild = overrides.widgetReleaseBuild || widgetBuild;
  const appConfigurations = [
    {
      build,
      id: 'AAAAAAAAAAAAAAAAAAAAAAA1',
      name: 'Debug',
      version,
    },
    ...(!overrides.omitAppRelease
      ? [
          {
            build,
            id: 'AAAAAAAAAAAAAAAAAAAAAAA2',
            name: 'Release',
            version,
          },
        ]
      : []),
  ];
  const widgetConfigurations = [
    {
      build: widgetBuild,
      id: 'BBBBBBBBBBBBBBBBBBBBBBB1',
      name: 'Debug',
      version,
    },
    {
      build: widgetReleaseBuild,
      id: 'BBBBBBBBBBBBBBBBBBBBBBB2',
      name: 'Release',
      version,
    },
  ];

  function configurationBlock(configuration, infoPlist) {
    return `
      ${configuration.id} /* ${configuration.name} */ = {
        isa = XCBuildConfiguration;
        baseConfigurationReference = FIXTURE /* generated xcconfig */;
        buildSettings = {
          CURRENT_PROJECT_VERSION = ${configuration.build};
          INFOPLIST_FILE = ${infoPlist};
          MARKETING_VERSION = ${configuration.version};
        };
        name = ${configuration.name};
      };`;
  }

  function configurationListBlock(id, targetName, configurations) {
    const references = configurations
      .map(
        (configuration) =>
          `${configuration.id} /* ${configuration.name} */,`,
      )
      .join('\n');
    return `
      ${id} /* Build configuration list for PBXNativeTarget "${targetName}" */ = {
        isa = XCConfigurationList;
        buildConfigurations = (
          ${references}
        );
        defaultConfigurationIsVisible = 0;
        defaultConfigurationName = Release;
      };`;
  }

  const unrelatedConfiguration = overrides.includeUnrelatedMismatch
    ? configurationBlock(
        {
          build: '999',
          id: 'CCCCCCCCCCCCCCCCCCCCCCC1',
          name: 'Release',
          version,
        },
        'QuranNotes/Info.plist',
      )
    : '';

  return {
    appJsonContents: JSON.stringify({
      expo: { version, ios: { buildNumber: build } },
    }),
    projectContents: `
      DDDDDDDDDDDDDDDDDDDDDDD1 /* QuranNotes */ = {
        isa = PBXNativeTarget;
        buildConfigurationList = AAAAAAAAAAAAAAAAAAAAAAA0 /* Build configuration list for PBXNativeTarget "QuranNotes" */;
        name = QuranNotes;
      };
      DDDDDDDDDDDDDDDDDDDDDDD2 /* widget */ = {
        isa = PBXNativeTarget;
        buildConfigurationList = BBBBBBBBBBBBBBBBBBBBBBB0 /* Build configuration list for PBXNativeTarget "widget" */;
        name = widget;
      };
      ${appConfigurations
        .map((configuration) =>
          configurationBlock(configuration, 'QuranNotes/Info.plist'),
        )
        .join('\n')}
      ${widgetConfigurations
        .map((configuration) =>
          configurationBlock(configuration, '../targets/widget/Info.plist'),
        )
        .join('\n')}
      ${unrelatedConfiguration}
      ${configurationListBlock(
        'AAAAAAAAAAAAAAAAAAAAAAA0',
        'QuranNotes',
        appConfigurations,
      )}
      ${configurationListBlock(
        'BBBBBBBBBBBBBBBBBBBBBBB0',
        'widget',
        widgetConfigurations,
      )}
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

test('comment-only values remain missing after dotenv parsing', () => {
  const environment = loadReleaseEnvironment({
    cwd: '/virtual-project',
    inheritedEnvironment: {},
    readFile: createFileReader({
      '/virtual-project/.env.local':
        'EXPO_PUBLIC_FIREBASE_API_KEY= # intentionally unset',
      '/virtual-project/.env': serializeEnvironment({
        ...FIREBASE_VARIABLES,
        EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'revenuecat-ios-fixture',
      }),
    }),
  });

  const result = validateReleaseEnvironment({ environment, platform: 'ios' });

  assert.ok(
    result.missingVariables.includes('EXPO_PUBLIC_FIREBASE_API_KEY'),
  );
});

test('dotenv parsing strips ordinary inline comments', () => {
  const environment = parseEnvironmentFile('FIXTURE=value # explanation');

  assert.equal(environment.FIXTURE, 'value');
});

test('dotenv parsing preserves hash characters inside quoted values', () => {
  const environment = parseEnvironmentFile(
    'DOUBLE="value # retained"\nSINGLE=\'other # retained\'',
  );

  assert.equal(environment.DOUBLE, 'value # retained');
  assert.equal(environment.SINGLE, 'other # retained');
});

test('dotenv fallback supports all required behavior when util.parseEnv is unavailable', () => {
  const fallbackValidator = loadValidatorWithoutNativeParseEnv();
  const environment = fallbackValidator.loadReleaseEnvironment({
    cwd: '/virtual-project',
    inheritedEnvironment: {},
    readFile: createFileReader({
      '/virtual-project/.env.local': [
        'EXPO_PUBLIC_FIREBASE_API_KEY= # intentionally unset',
        'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="local # retained"',
        'EXPO_PUBLIC_FIREBASE_PROJECT_ID=local-project # explanation',
      ].join('\n'),
      '/virtual-project/.env': serializeEnvironment({
        ...FIREBASE_VARIABLES,
        EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'revenuecat-ios-fixture',
      }),
    }),
  });

  const result = fallbackValidator.validateReleaseEnvironment({
    environment,
    platform: 'ios',
  });

  assert.equal(environment.EXPO_PUBLIC_FIREBASE_API_KEY, '');
  assert.equal(
    environment.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    'local # retained',
  );
  assert.equal(environment.EXPO_PUBLIC_FIREBASE_PROJECT_ID, 'local-project');
  assert.deepEqual(result.missingVariables, [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
  ]);
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

test('metadata validation requires a Release configuration for every target', () => {
  assert.throws(
    () =>
      validateReleaseMetadataSources(
        createMetadataFixture({ omitAppRelease: true }),
      ),
    /app target.*Release configuration/,
  );
});

test('metadata validation rejects a mismatch confined to the widget Release configuration', () => {
  assert.throws(
    () =>
      validateReleaseMetadataSources(
        createMetadataFixture({ widgetReleaseBuild: '49' }),
      ),
    /widget Release CURRENT_PROJECT_VERSION 49.*50/,
  );
});

test('metadata validation ignores configurations not associated with either target', () => {
  const result = validateReleaseMetadataSources(
    createMetadataFixture({ includeUnrelatedMismatch: true }),
  );

  assert.deepEqual(result, { build: '50', version: '2.2.2' });
});

test('metadata validation rejects invalid iOS marketing versions', () => {
  assert.throws(
    () =>
      validateReleaseMetadataSources(
        createMetadataFixture({ version: '2.2' }),
      ),
    /valid iOS marketing version/,
  );
});

test('metadata validation rejects invalid iOS build numbers', () => {
  assert.throws(
    () =>
      validateReleaseMetadataSources(createMetadataFixture({ build: '50a' })),
    /valid iOS build number/,
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

test('build preparation checks the workspace before metadata validation', () => {
  const buildScript = fs.readFileSync(
    path.join(__dirname, '..', 'build-ios.sh'),
    'utf8',
  );

  const workspaceCheck = buildScript.indexOf('if [[ ! -d "$WORKSPACE" ]]');
  const nativeProjectCheck = buildScript.indexOf(
    'if [[ ! -f "$NATIVE_PROJECT" ]]',
  );
  const metadataValidation = buildScript.indexOf(
    'node scripts/validate-release-metadata.js',
  );

  assert.ok(workspaceCheck >= 0, 'workspace check must exist');
  assert.ok(nativeProjectCheck >= 0, 'native project check must exist');
  assert.ok(metadataValidation >= 0, 'metadata validation must exist');
  assert.ok(
    workspaceCheck < metadataValidation,
    'workspace check must run before metadata validation',
  );
  assert.ok(
    nativeProjectCheck < metadataValidation,
    'native project check must run before metadata validation',
  );
});
