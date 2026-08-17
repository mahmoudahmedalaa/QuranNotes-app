const fs = require('node:fs');
const path = require('node:path');

const FIREBASE_PUBLIC_CLIENT_VARIABLES = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
  'EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID',
];

const REVENUECAT_VARIABLE_BY_PLATFORM = {
  android: 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
  ios: 'EXPO_PUBLIC_REVENUECAT_IOS_KEY',
};

function parseEnvironmentFile(contents) {
  const parsed = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = line.match(
      /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
    );
    if (!match) {
      continue;
    }

    const [, name, rawValue] = match;
    let quote;
    let escaped = false;
    let commentIndex = -1;

    for (let index = 0; index < rawValue.length; index += 1) {
      const character = rawValue[index];
      if (escaped) {
        escaped = false;
      } else if (character === '\\' && quote === '"') {
        escaped = true;
      } else if (quote) {
        if (character === quote) {
          quote = undefined;
        }
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '#') {
        commentIndex = index;
        break;
      }
    }

    let value = (commentIndex >= 0
      ? rawValue.slice(0, commentIndex)
      : rawValue
    ).trim();
    const firstCharacter = value.at(0);
    const lastCharacter = value.at(-1);
    if (
      value.length >= 2 &&
      ((firstCharacter === '"' && lastCharacter === '"') ||
        (firstCharacter === "'" && lastCharacter === "'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[name] = value;
  }

  return parsed;
}

function readOptionalEnvironmentFile(filePath, readFile) {
  try {
    return parseEnvironmentFile(readFile(filePath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

function loadReleaseEnvironment({
  cwd = process.cwd(),
  inheritedEnvironment = process.env,
  readFile = fs.readFileSync,
} = {}) {
  const loadedEnvironment = {};
  const fileNames = ['.env.local', '.env'];

  for (const fileName of fileNames) {
    const fileEnvironment = readOptionalEnvironmentFile(
      path.join(cwd, fileName),
      readFile,
    );

    for (const [name, value] of Object.entries(fileEnvironment)) {
      if (!(name in loadedEnvironment)) {
        loadedEnvironment[name] = value;
      }
    }
  }

  return { ...loadedEnvironment, ...inheritedEnvironment };
}

function validateReleaseEnvironment({ environment, platform }) {
  const revenueCatVariable = REVENUECAT_VARIABLE_BY_PLATFORM[platform];
  if (!revenueCatVariable) {
    throw new Error('Release platform must be either ios or android.');
  }

  const requiredVariables = [
    ...FIREBASE_PUBLIC_CLIENT_VARIABLES,
    revenueCatVariable,
  ];
  const missingVariables = requiredVariables.filter((name) => {
    const value = environment[name];
    return typeof value !== 'string' || value.trim() === '';
  });

  return { missingVariables, platform };
}

function runReleaseEnvironmentValidation({
  cwd = process.cwd(),
  environment,
  inheritedEnvironment = process.env,
  platform = 'ios',
  readFile = fs.readFileSync,
  stderr = (message) => process.stderr.write(message),
  stdout = (message) => process.stdout.write(message),
} = {}) {
  const releaseEnvironment =
    environment ||
    loadReleaseEnvironment({ cwd, inheritedEnvironment, readFile });
  const result = validateReleaseEnvironment({
    environment: releaseEnvironment,
    platform,
  });

  if (result.missingVariables.length > 0) {
    stderr('Missing required release environment variables:\n');
    for (const name of result.missingVariables) {
      stderr(`- ${name}\n`);
    }
    return 1;
  }

  stdout(`Release environment metadata is complete for ${platform}.\n`);
  return 0;
}

function readPlatformArgument(argv, environment) {
  const inlineArgument = argv.find((argument) =>
    argument.startsWith('--platform='),
  );
  if (inlineArgument) {
    return inlineArgument.slice('--platform='.length);
  }

  const platformIndex = argv.indexOf('--platform');
  if (platformIndex >= 0 && argv[platformIndex + 1]) {
    return argv[platformIndex + 1];
  }

  return environment.QURANNOTES_RELEASE_PLATFORM || 'ios';
}

if (require.main === module) {
  try {
    process.exitCode = runReleaseEnvironmentValidation({
      platform: readPlatformArgument(process.argv.slice(2), process.env),
    });
  } catch {
    process.stderr.write('Release environment validation could not complete.\n');
    process.exitCode = 1;
  }
}

module.exports = {
  FIREBASE_PUBLIC_CLIENT_VARIABLES,
  loadReleaseEnvironment,
  parseEnvironmentFile,
  runReleaseEnvironmentValidation,
  validateReleaseEnvironment,
};
