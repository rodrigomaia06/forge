const fs = require('node:fs');
const path = require('node:path');
const {
  withInfoPlist,
  withXcodeProject,
  withAndroidManifest,
  withDangerousMod,
  IOSConfig,
  AndroidConfig,
} = require('expo/config-plugins');
const { uti, mimeType, extension } = require('../src/data/forgeFileType.json');

const IOS_ICONS = [
  'ForgeDocument.png',
  'ForgeDocument@2x.png',
  'ForgeDocument@3x.png',
  'ForgeDocumentTablet.png',
  'ForgeDocumentLarge.png',
];

module.exports = function withForgeDocumentIcons(config) {
  // Expo runs mod actions in reverse plugin order. Register this plugin before
  // the association plugin so its document and VIEW entries exist here.
  config = withInfoPlist(config, (config) => {
    for (const document of config.modResults.CFBundleDocumentTypes ?? []) {
      if (document.LSItemContentTypes?.includes(uti)) {
        document.CFBundleTypeIconFiles = IOS_ICONS;
      }
    }
    return config;
  });

  config = withXcodeProject(config, (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const sourceRoot = IOSConfig.Paths.getSourceRoot(projectRoot);
    for (const name of IOS_ICONS) {
      fs.copyFileSync(
        path.join(projectRoot, 'assets/file-icons', name),
        path.join(sourceRoot, name),
      );
      const filepath = `${projectName}/${name}`;
      if (!config.modResults.hasFile(filepath)) {
        IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath,
          groupName: projectName,
          project: config.modResults,
          isBuildFile: true,
        });
      }
    }
    return config;
  });

  config = withAndroidManifest(config, (config) => {
    const main = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    for (const filter of main['intent-filter'] ?? []) {
      const data = filter.data ?? [];
      if (
        data.some(
          (entry) =>
            entry.$?.['android:mimeType'] === mimeType ||
            entry.$?.['android:pathPattern']?.endsWith(`\\.${extension}`),
        )
      ) {
        filter.$ = { ...filter.$, 'android:icon': '@drawable/forge_document' };
      }
    }
    return config;
  });

  return withDangerousMod(config, [
    'android',
    (config) => {
      const directory = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/res/drawable-xxxhdpi',
      );
      fs.mkdirSync(directory, { recursive: true });
      fs.copyFileSync(
        path.join(config.modRequest.projectRoot, 'assets/file-icons/forge_document.png'),
        path.join(directory, 'forge_document.png'),
      );
      return config;
    },
  ]);
};
