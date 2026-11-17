const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

/**
 * Adds the hidden iCloud Drive container used to mirror backups. Only signed
 * builds can carry iCloud entitlements (free signing rejects them), so the
 * plugin does nothing unless FORGE_ICLOUD=1, and the app then reports iCloud as
 * unavailable and keeps backups on the phone.
 */
module.exports = function withForgeICloud(config) {
  if (process.env.FORGE_ICLOUD !== '1') return config;
  const bundleIdentifier = config.ios?.bundleIdentifier;
  if (!bundleIdentifier) throw new Error('Forge iCloud requires ios.bundleIdentifier.');
  const container = `iCloud.${bundleIdentifier}`;

  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.developer.icloud-container-identifiers'] = [container];
    config.modResults['com.apple.developer.icloud-services'] = ['CloudDocuments'];
    config.modResults['com.apple.developer.ubiquity-container-identifiers'] = [container];
    config.modResults['com.apple.developer.icloud-container-environment'] = 'Production';
    return config;
  });
  return withInfoPlist(config, (config) => {
    config.modResults.NSUbiquitousContainers = {
      [container]: {
        NSUbiquitousContainerIsDocumentScopePublic: false,
        NSUbiquitousContainerName: 'Forge',
        NSUbiquitousContainerSupportedFolderLevels: 'Any',
      },
    };
    return config;
  });
};

module.exports.iCloudContainer = (bundleIdentifier) => `iCloud.${bundleIdentifier}`;
