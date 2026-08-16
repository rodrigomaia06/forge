# Release and licensing

## Builds and distribution

The current deployment target is iOS 17.0, as defined in `project.yml`. GitHub Actions builds on macOS,
uploads an unsigned IPA artifact, and does not contain signing credentials. Sideloading requires the user
to sign the IPA with their own Apple ID. App Store or TestFlight distribution requires the maintainer's
own Apple Developer signing setup and a reviewed release build.

Do not commit certificates, provisioning profiles, private keys, Apple account data, team identifiers,
or reusable signing tokens. Keep bundle identifiers and signing settings easy to override.

## App Store preparation

Before publishing, verify the bundle metadata, privacy declarations, entitlements, export behavior,
accessibility, release notes, and the complete migration and backup path. The app must not claim support
for behavior that has not passed the release build and device checks.

## Licensing and attribution

Forge is derived from the open-source Iron project by Karim Abou Zeid. Preserve the upstream copyright
notices, attribution, license files, and applicable GNU GPLv3 obligations. Permission from Karim is
required for the planned Forge App Store publication and should be retained with the release records.
Permission does not replace compliance with the GPL or Apple requirements.

## Data safety

Release work must protect existing local data. Test upgrades from realistic stores, validate exports,
create recovery paths before replacement, and do not rewrite historical exercise identities during catalog
or schema changes.
