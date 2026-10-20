const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const xcode = require('xcode');
const yaml = require('yaml');
const plist = require('plist');
const { validateProfiles, configureProject, exportOptions } = require('../../scripts/ios-signing.cjs');

const bundleId = 'com.rodrigo.forge.training';
const certificate = Buffer.from('test distribution certificate');
const now = new Date('2026-10-20T12:00:00Z');
function profile(extension = false) {
  return {
    UUID: extension ? 'BBBBBBBB-1111-2222-3333-444444444444' : 'AAAAAAAA-1111-2222-3333-444444444444',
    TeamIdentifier: ['TESTTEAM01'],
    ApplicationIdentifierPrefix: ['TESTTEAM01'],
    ExpirationDate: new Date('2027-10-20T12:00:00Z'),
    ProvisionedDevices: ['device-one'],
    DeveloperCertificates: [certificate],
    Entitlements: {
      'application-identifier': `TESTTEAM01.${bundleId}${extension ? '.resttimer' : ''}`,
      'get-task-allow': false,
      ...(!extension ? { 'aps-environment': 'production', 'com.apple.developer.usernotifications.time-sensitive': true } : {}),
    },
  };
}
function validate(app = profile(), widget = profile(true)) {
  return validateProfiles(app, widget, bundleId, certificate, now);
}

test('Ad Hoc signing selects separate app and widget profiles with a common certificate', () => {
  // Exercise the data-buffer and date types returned by Apple's decoded plist.
  const app = plist.parse(plist.build(profile()));
  const widget = plist.parse(plist.build(profile(true)));
  const signing = validate(app, widget);
  const options = exportOptions(signing);
  assert.equal(options.method, 'release-testing');
  assert.equal(options.signingStyle, 'manual');
  assert.equal(options.provisioningProfiles[bundleId], app.UUID);
  assert.equal(options.provisioningProfiles[`${bundleId}.resttimer`], widget.UUID);
});

test('rejects wrong identities, mismatched teams, expired and non-Ad Hoc profiles', () => {
  const wrongId = profile();
  wrongId.Entitlements['application-identifier'] += '.old';
  assert.throws(() => validate(wrongId), /does not match/);
  const wrongTeam = profile(true);
  wrongTeam.TeamIdentifier = ['OTHERTEAM'];
  assert.throws(() => validate(profile(), wrongTeam), /same Apple team/);
  assert.throws(() => validate({ ...profile(), ExpirationDate: new Date('2020-01-01') }), /expired/);
  assert.throws(() => validate({ ...profile(), ProvisionedDevices: [] }), /Ad Hoc/);
  assert.throws(() => validate({ ...profile(), ProvisionsAllDevices: true }), /Ad Hoc/);
  const development = profile();
  development.Entitlements['get-task-allow'] = true;
  assert.throws(() => validate(development), /Ad Hoc/);
});

test('rejects missing certificate, disjoint devices and absent notification capabilities', () => {
  assert.throws(() => validate(profile(), { ...profile(true), DeveloperCertificates: [] }), /certificate/);
  assert.throws(() => validate(profile(), { ...profile(true), ProvisionedDevices: ['other-device'] }), /common device/);
  const app = profile();
  app.Entitlements['aps-environment'] = 'development';
  assert.throws(() => validate(app), /Push Notifications/);
  app.Entitlements['aps-environment'] = 'production';
  delete app.Entitlements['com.apple.developer.usernotifications.time-sensitive'];
  assert.throws(() => validate(app), /Time Sensitive/);
});

test('manual signing configures only the correct Release targets and preserves Debug', () => {
  const project = xcode.project('fixture.pbxproj');
  const settings = id => ({ PRODUCT_BUNDLE_IDENTIFIER: `"${id}"`, CODE_SIGN_STYLE: 'Automatic' });
  project.hash = { project: { objects: {
    PBXNativeTarget: {
      APP: { isa: 'PBXNativeTarget', buildConfigurationList: 'APP_CONFIG' },
      WIDGET: { isa: 'PBXNativeTarget', buildConfigurationList: 'WIDGET_CONFIG' },
      LIBRARY: { isa: 'PBXNativeTarget', buildConfigurationList: 'LIBRARY_CONFIG' },
    },
    XCConfigurationList: {
      APP_CONFIG: { buildConfigurations: [{ value: 'APP_RELEASE' }, { value: 'APP_DEBUG' }] },
      WIDGET_CONFIG: { buildConfigurations: [{ value: 'WIDGET_RELEASE' }] },
      LIBRARY_CONFIG: { buildConfigurations: [{ value: 'LIBRARY_RELEASE' }] },
    },
    XCBuildConfiguration: {
      APP_RELEASE: { name: 'Release', buildSettings: settings(bundleId) },
      APP_DEBUG: { name: 'Debug', buildSettings: settings(bundleId) },
      WIDGET_RELEASE: { name: '"Release"', buildSettings: settings(`${bundleId}.resttimer`) },
      LIBRARY_RELEASE: { name: 'Release', buildSettings: settings('org.other.library') },
    },
  } } };
  configureProject(project, validate());
  const configurations = project.pbxXCBuildConfigurationSection();
  assert.equal(configurations.APP_RELEASE.buildSettings.PROVISIONING_PROFILE_SPECIFIER, profile().UUID);
  assert.equal(configurations.WIDGET_RELEASE.buildSettings.PROVISIONING_PROFILE_SPECIFIER, profile(true).UUID);
  assert.equal(configurations.APP_RELEASE.buildSettings.CODE_SIGN_STYLE, 'Manual');
  assert.equal(configurations.APP_DEBUG.buildSettings.CODE_SIGN_STYLE, 'Automatic');
  assert.equal(configurations.LIBRARY_RELEASE.buildSettings.CODE_SIGN_STYLE, 'Automatic');
  delete project.pbxNativeTargetSection().WIDGET;
  assert.throws(() => configureProject(project, validate()), /both app and rest-timer/);
});

test('signed workflow decodes secrets, isolates artifacts and always cleans credentials', () => {
  const signed = yaml.parse(fs.readFileSync('.github/workflows/build-ipa-signed.yml', 'utf8'));
  const unsigned = yaml.parse(fs.readFileSync('.github/workflows/build-ipa.yml', 'utf8'));
  const steps = signed.jobs['build-ipa'].steps;
  const install = steps.find(step => step.name === 'Install Apple signing credentials');
  assert.deepEqual(Object.keys(install.env).sort(), ['APP_PROVISION_PROFILE_BASE64', 'BUILD_CERTIFICATE_BASE64', 'P12_PASSWORD', 'WIDGET_PROVISION_PROFILE_BASE64']);
  assert.match(install.run, /base64\.b64decode/);
  assert.match(install.run, /if \[ -z "\$\{!SECRET_NAME\}" \]/);
  const cleanup = steps.find(step => step.name === 'Remove signing credentials');
  assert.equal(cleanup.if, '${{ always() }}');
  assert.match(cleanup.run, /security delete-keychain/);
  const upload = steps.find(step => step.name === 'Upload signed IPA');
  assert.equal(upload.with.path, 'artifacts/Forge-signed-adhoc.ipa');
  assert.notEqual(signed.concurrency.group, unsigned.concurrency.group);
  for (const step of steps.filter(step => step.run)) {
    const result = spawnSync('bash', ['-n'], { input: step.run, encoding: 'utf8' });
    assert.equal(result.status, 0, `${step.name}: ${result.stderr}`);
  }
  for (const name of ['Select Xcode with Swift 6.2', 'Patch ExpoModulesJSI for Xcode 26', 'Generate the iOS project', 'Install CocoaPods']) {
    assert.deepEqual(steps.find(step => step.name === name), unsigned.jobs['build-ipa'].steps.find(step => step.name === name));
  }
  assert.match(unsigned.jobs['build-ipa'].steps.find(step => step.name === 'Archive unsigned device app').run, /CODE_SIGNING_ALLOWED=NO/);
});
