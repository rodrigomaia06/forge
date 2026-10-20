const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const plist = require('plist');
const xcode = require('xcode');

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function validateProfiles(app, widget, bundleId, certificateDER, now = new Date()) {
  const certificate = crypto.createHash('sha1').update(certificateDER).digest('hex').toUpperCase();
  const profiles = [app, widget];
  const bundleIds = [bundleId, `${bundleId}.resttimer`];
  const team = app.TeamIdentifier?.[0];
  requireValue(team && widget.TeamIdentifier?.[0] === team, 'Both profiles must belong to the same Apple team.');
  profiles.forEach((profile, index) => {
    const entitlements = profile.Entitlements ?? {};
    const expected = `${profile.ApplicationIdentifierPrefix?.[0]}.${bundleIds[index]}`;
    requireValue(entitlements['application-identifier'] === expected, `Provisioning profile does not match ${bundleIds[index]}.`);
    requireValue(/^[A-Fa-f0-9-]{36}$/.test(profile.UUID ?? ''), 'Provisioning profile has an invalid UUID.');
    requireValue(new Date(profile.ExpirationDate) > now, 'Provisioning profile has expired.');
    requireValue(profile.ProvisionedDevices?.length > 0 && !profile.ProvisionsAllDevices && !entitlements['get-task-allow'], 'Use Ad Hoc distribution profiles with registered devices.');
    requireValue(profile.DeveloperCertificates?.some(value => crypto.createHash('sha1').update(value).digest('hex').toUpperCase() === certificate), 'The signing certificate must be included in both provisioning profiles.');
  });
  requireValue(app.ProvisionedDevices.some(device => widget.ProvisionedDevices.includes(device)), 'App and extension profiles must include a common device.');
  requireValue(app.Entitlements['com.apple.developer.usernotifications.time-sensitive'] === true, 'Enable Time Sensitive Notifications on the app profile.');
  requireValue(app.Entitlements['aps-environment'] === 'production', 'Enable Push Notifications on the Ad Hoc app profile.');
  return {
    team,
    certificate,
    profiles: Object.fromEntries(bundleIds.map((id, index) => [id, profiles[index].UUID])),
  };
}

const unquote = value => String(value ?? '').replace(/^"|"$/g, '');

function configureProject(project, signing) {
  const configured = new Set();
  const targets = project.pbxNativeTargetSection();
  const lists = project.pbxXCConfigurationList();
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const target of Object.values(targets)) {
    if (target.isa !== 'PBXNativeTarget') continue;
    for (const entry of lists[target.buildConfigurationList]?.buildConfigurations ?? []) {
      const configuration = configurations[entry.value];
      if (unquote(configuration.name) !== 'Release') continue;
      const settings = configuration.buildSettings;
      const id = unquote(settings.PRODUCT_BUNDLE_IDENTIFIER);
      if (!signing.profiles[id]) continue;
      Object.assign(settings, {
        CODE_SIGN_STYLE: 'Manual',
        DEVELOPMENT_TEAM: signing.team,
        CODE_SIGN_IDENTITY: signing.certificate,
        PROVISIONING_PROFILE_SPECIFIER: signing.profiles[id],
        CODE_SIGNING_ALLOWED: 'YES',
        CODE_SIGNING_REQUIRED: 'YES',
      });
      delete settings.PROVISIONING_PROFILE;
      configured.add(id);
    }
  }
  requireValue(Object.keys(signing.profiles).every(id => configured.has(id)), 'Generated Xcode project must contain both app and rest-timer Release targets.');
}

function exportOptions(signing) {
  return {
    method: 'release-testing',
    destination: 'export',
    signingStyle: 'manual',
    teamID: signing.team,
    signingCertificate: signing.certificate,
    provisioningProfiles: signing.profiles,
    manageAppVersionAndBuildNumber: false,
  };
}

function main() {
  const directory = process.env.FORGE_SIGNING_DIRECTORY;
  requireValue(directory, 'FORGE_SIGNING_DIRECTORY is required.');
  const readProfile = name => plist.parse(fs.readFileSync(path.join(directory, `${name}.plist`), 'utf8'));
  const certificate = new crypto.X509Certificate(fs.readFileSync(path.join(directory, 'certificate.pem')));
  requireValue(new Date(certificate.validTo) > new Date(), 'The distribution certificate has expired.');
  const bundleId = require('../app.json').expo.ios.bundleIdentifier;
  console.log(`App Bundle ID: ${bundleId}`);
  console.log(`Extension Bundle ID: ${bundleId}.resttimer`);
  const signing = validateProfiles(readProfile('app'), readProfile('widget'), bundleId, certificate.raw);
  const projectPath = 'ios/Forge.xcodeproj/project.pbxproj';
  const project = xcode.project(projectPath);
  project.parseSync();
  configureProject(project, signing);
  fs.writeFileSync(projectPath, project.writeSync());
  // Expo defaults APNs to development; Ad Hoc profiles authorize production.
  const entitlementsPath = 'ios/Forge/Forge.entitlements';
  const entitlements = plist.parse(fs.readFileSync(entitlementsPath, 'utf8'));
  entitlements['aps-environment'] = 'production';
  fs.writeFileSync(entitlementsPath, plist.build(entitlements));
  fs.writeFileSync(path.join(directory, 'ExportOptions.plist'), plist.build(exportOptions(signing)));
  fs.writeFileSync(path.join(directory, 'team.txt'), signing.team);
  console.log('Configured manual Ad Hoc signing for Forge and its rest-timer extension.');
}

module.exports = { validateProfiles, configureProject, exportOptions };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
