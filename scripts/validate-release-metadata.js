const fs = require('node:fs');
const path = require('node:path');

const APP_INFO_PLIST = 'QuranNotes/Info.plist';
const WIDGET_INFO_PLIST = 'targets/widget/Info.plist';
const IOS_MARKETING_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const IOS_BUILD_NUMBER_PATTERN = /^\d+(?:\.\d+){0,2}$/;

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

function extractBuildConfigurations(projectContents) {
  const configurationsById = new Map();
  const configurationPattern =
    /([A-Za-z0-9]+)\s*\/\*\s*[^*]+?\s*\*\/\s*=\s*\{\s*isa = XCBuildConfiguration;[\s\S]*?buildSettings = \{([\s\S]*?)\n\s*\};\s*name = ([^;]+);\s*\};/g;
  let match = configurationPattern.exec(projectContents);

  while (match) {
    const buildSettings = match[2];
    const infoPlist = extractBuildSetting(buildSettings, 'INFOPLIST_FILE');
    const normalizedInfoPlist = infoPlist
      ? infoPlist.replace(/^\.\.\//, '')
      : undefined;

    configurationsById.set(match[1], {
      build: extractBuildSetting(buildSettings, 'CURRENT_PROJECT_VERSION'),
      configuration: stripBuildSettingQuotes(match[3]),
      infoPlist: normalizedInfoPlist,
      version: extractBuildSetting(buildSettings, 'MARKETING_VERSION'),
    });

    match = configurationPattern.exec(projectContents);
  }

  return configurationsById;
}

function extractNativeTargetConfigurationLists(projectContents) {
  const configurationListByTarget = new Map();
  const targetPattern =
    /[A-Za-z0-9]+\s*\/\*\s*[^*]+?\s*\*\/\s*=\s*\{\s*isa = PBXNativeTarget;\s*buildConfigurationList = ([A-Za-z0-9]+)[^;]*;[\s\S]*?\n\s*name = ([^;]+);/g;
  let match = targetPattern.exec(projectContents);

  while (match) {
    configurationListByTarget.set(
      stripBuildSettingQuotes(match[2]),
      match[1],
    );
    match = targetPattern.exec(projectContents);
  }

  return configurationListByTarget;
}

function extractConfigurationIds(projectContents, configurationListId) {
  const configurationListPattern = new RegExp(
    `^\\s*${configurationListId}\\s*\\/\\*[^\\n]*\\*\\/\\s*=\\s*\\{\\s*isa = XCConfigurationList;\\s*buildConfigurations = \\(([\\s\\S]*?)\\);`,
    'm',
  );
  const configurationList = projectContents.match(configurationListPattern);
  if (!configurationList) {
    return [];
  }

  return Array.from(
    configurationList[1].matchAll(/([A-Za-z0-9]+)\s*\/\*[^*]+\*\//g),
    (match) => match[1],
  );
}

function extractTargetConfigurations(projectContents) {
  const configurationsById = extractBuildConfigurations(projectContents);
  const configurationListByTarget =
    extractNativeTargetConfigurationLists(projectContents);
  const targetDefinitions = [
    {
      expectedInfoPlist: APP_INFO_PLIST,
      projectName: 'QuranNotes',
      targetName: 'app',
    },
    {
      expectedInfoPlist: WIDGET_INFO_PLIST,
      projectName: 'widget',
      targetName: 'widget',
    },
  ];
  const targetConfigurations = [];

  for (const target of targetDefinitions) {
    const configurationListId = configurationListByTarget.get(
      target.projectName,
    );
    if (!configurationListId) {
      throw new Error(
        `The Xcode project must define the ${target.targetName} target.`,
      );
    }

    const configurationIds = extractConfigurationIds(
      projectContents,
      configurationListId,
    );
    if (configurationIds.length === 0) {
      throw new Error(
        `The ${target.targetName} target must reference build configurations.`,
      );
    }

    for (const configurationId of configurationIds) {
      const configuration = configurationsById.get(configurationId);
      if (!configuration) {
        throw new Error(
          `The ${target.targetName} target references a missing build configuration.`,
        );
      }
      if (configuration.infoPlist !== target.expectedInfoPlist) {
        throw new Error(
          `The ${target.targetName} ${configuration.configuration} configuration must use ${target.expectedInfoPlist}.`,
        );
      }

      targetConfigurations.push({
        ...configuration,
        targetName: target.targetName,
      });
    }
  }

  return targetConfigurations;
}

function extractPlistString(plistContents, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = plistContents.match(
    new RegExp(`<key>${escapedKey}<\\/key>\\s*<string>([^<]+)<\\/string>`),
  );
  return match ? match[1].trim() : undefined;
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
  if (!IOS_MARKETING_VERSION_PATTERN.test(version)) {
    throw new Error(
      'app.json expo.version must be a valid iOS marketing version with three numeric components.',
    );
  }
  if (!IOS_BUILD_NUMBER_PATTERN.test(build)) {
    throw new Error(
      'app.json expo.ios.buildNumber must be a valid iOS build number with one to three numeric components.',
    );
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
    ({ targetName }) => targetName === 'app',
  );
  const widgetConfigurations = targetConfigurations.filter(
    ({ targetName }) => targetName === 'widget',
  );

  for (const [targetName, configurations] of [
    ['app', appConfigurations],
    ['widget', widgetConfigurations],
  ]) {
    if (
      !configurations.some(
        ({ configuration }) => configuration === 'Release',
      )
    ) {
      throw new Error(
        `The ${targetName} target must define a Release configuration.`,
      );
    }
  }

  for (const configuration of targetConfigurations) {
    if (configuration.version !== version) {
      throw new Error(
        `${configuration.targetName} ${configuration.configuration} MARKETING_VERSION ${configuration.version || 'missing'} does not equal ${version}.`,
      );
    }
    if (configuration.build !== build) {
      throw new Error(
        `${configuration.targetName} ${configuration.configuration} CURRENT_PROJECT_VERSION ${configuration.build || 'missing'} does not equal ${build}.`,
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
