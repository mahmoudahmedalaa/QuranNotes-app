const fs = require('node:fs');
const path = require('node:path');

const APP_INFO_PLIST = 'QuranNotes/Info.plist';
const WIDGET_INFO_PLIST = 'targets/widget/Info.plist';

function stripBuildSettingQuotes(value) {
  const trimmedValue = value.trim();
  if (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) {
    return trimmedValue.slice(1, -1);
  }
  return trimmedValue;
}

function extractBuildSetting(buildSettings, name) {
  const match = buildSettings.match(
    new RegExp(`(?:^|\\n)\\s*${name}\\s*=\\s*([^;]+);`),
  );
  return match ? stripBuildSettingQuotes(match[1]) : undefined;
}

function extractTargetConfigurations(projectContents) {
  const configurations = [];
  const configurationPattern =
    /isa = XCBuildConfiguration;[\s\S]*?buildSettings = \{([\s\S]*?)\n\s*\};\s*name = ([^;]+);/g;
  let match = configurationPattern.exec(projectContents);

  while (match) {
    const buildSettings = match[1];
    const infoPlist = extractBuildSetting(buildSettings, 'INFOPLIST_FILE');
    const normalizedInfoPlist = infoPlist
      ? infoPlist.replace(/^\.\.\//, '')
      : undefined;

    if (
      normalizedInfoPlist === APP_INFO_PLIST ||
      normalizedInfoPlist === WIDGET_INFO_PLIST
    ) {
      configurations.push({
        build: extractBuildSetting(
          buildSettings,
          'CURRENT_PROJECT_VERSION',
        ),
        configuration: stripBuildSettingQuotes(match[2]),
        infoPlist: normalizedInfoPlist,
        version: extractBuildSetting(buildSettings, 'MARKETING_VERSION'),
      });
    }

    match = configurationPattern.exec(projectContents);
  }

  return configurations;
}

function extractPlistString(plistContents, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = plistContents.match(
    new RegExp(`<key>${escapedKey}<\\/key>\\s*<string>([^<]+)<\\/string>`),
  );
  return match ? match[1].trim() : undefined;
}

function targetNameForInfoPlist(infoPlist) {
  return infoPlist === APP_INFO_PLIST ? 'app' : 'widget';
}

function assertPlistMetadata({ build, contents, name, version }) {
  const plistVersion = extractPlistString(
    contents,
    'CFBundleShortVersionString',
  );
  const plistBuild = extractPlistString(contents, 'CFBundleVersion');
  const validVersions = new Set(['$(MARKETING_VERSION)', version]);
  const validBuilds = new Set(['$(CURRENT_PROJECT_VERSION)', build]);

  if (!validVersions.has(plistVersion)) {
    throw new Error(
      `${name} CFBundleShortVersionString must resolve to marketing version ${version}.`,
    );
  }
  if (!validBuilds.has(plistBuild)) {
    throw new Error(
      `${name} CFBundleVersion must resolve to build number ${build}.`,
    );
  }
}

function validateReleaseMetadataSources({
  appInfoPlistContents,
  appJsonContents,
  approvedBuild,
  approvedVersion,
  projectContents,
  widgetInfoPlistContents,
}) {
  const appConfig = JSON.parse(appJsonContents);
  const version = String(appConfig.expo?.version || '').trim();
  const build = String(appConfig.expo?.ios?.buildNumber || '').trim();

  if (!version || !build) {
    throw new Error('app.json must define expo.version and expo.ios.buildNumber.');
  }

  const hasApprovedVersion = Boolean(approvedVersion);
  const hasApprovedBuild = Boolean(approvedBuild);
  if (hasApprovedVersion !== hasApprovedBuild) {
    throw new Error(
      'Approved release version and build number must be supplied together.',
    );
  }
  if (hasApprovedVersion && version !== approvedVersion) {
    throw new Error(
      `app.json version ${version} does not equal approved version ${approvedVersion}.`,
    );
  }
  if (hasApprovedBuild && build !== approvedBuild) {
    throw new Error(
      `app.json build ${build} does not equal approved build ${approvedBuild}.`,
    );
  }

  const targetConfigurations = extractTargetConfigurations(projectContents);
  const appConfigurations = targetConfigurations.filter(
    ({ infoPlist }) => infoPlist === APP_INFO_PLIST,
  );
  const widgetConfigurations = targetConfigurations.filter(
    ({ infoPlist }) => infoPlist === WIDGET_INFO_PLIST,
  );

  if (appConfigurations.length === 0 || widgetConfigurations.length === 0) {
    throw new Error(
      'The Xcode project must define release metadata for the app and widget targets.',
    );
  }

  for (const configuration of targetConfigurations) {
    const targetName = targetNameForInfoPlist(configuration.infoPlist);
    if (configuration.version !== version) {
      throw new Error(
        `${targetName} ${configuration.configuration} MARKETING_VERSION ${configuration.version || 'missing'} does not equal ${version}.`,
      );
    }
    if (configuration.build !== build) {
      throw new Error(
        `${targetName} ${configuration.configuration} CURRENT_PROJECT_VERSION ${configuration.build || 'missing'} does not equal ${build}.`,
      );
    }
  }

  assertPlistMetadata({
    build,
    contents: appInfoPlistContents,
    name: 'App Info.plist',
    version,
  });
  assertPlistMetadata({
    build,
    contents: widgetInfoPlistContents,
    name: 'Widget Info.plist',
    version,
  });

  return { build, version };
}

function runReleaseMetadataValidation({
  cwd = process.cwd(),
  environment = process.env,
  readFile = fs.readFileSync,
  stderr = (message) => process.stderr.write(message),
  stdout = (message) => process.stdout.write(message),
} = {}) {
  try {
    const result = validateReleaseMetadataSources({
      appInfoPlistContents: readFile(
        path.join(cwd, 'ios/QuranNotes/Info.plist'),
        'utf8',
      ),
      appJsonContents: readFile(path.join(cwd, 'app.json'), 'utf8'),
      approvedBuild: environment.QURANNOTES_RELEASE_BUILD,
      approvedVersion: environment.QURANNOTES_RELEASE_VERSION,
      projectContents: readFile(
        path.join(cwd, 'ios/QuranNotes.xcodeproj/project.pbxproj'),
        'utf8',
      ),
      widgetInfoPlistContents: readFile(
        path.join(cwd, 'targets/widget/Info.plist'),
        'utf8',
      ),
    });
    stdout(
      `Release metadata is consistent for version ${result.version} (${result.build}).\n`,
    );
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    stderr(`Release metadata validation failed: ${message}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runReleaseMetadataValidation();
}

module.exports = {
  runReleaseMetadataValidation,
  validateReleaseMetadataSources,
};
