# Forge documentation

## Importing Forge JSON

Use **Settings → Backup & Export → Export JSON** to create a portable copy of
your Forge data. The file is intended to move data between compatible Forge
installs, including web, iOS, and Android.

To add data from a file:

1. Keep the complete `.json` file created by Forge. Do not rename or remove
   fields inside it.
2. On the receiving device, open **Settings → Backup & Export** and choose
   **Import JSON**. The adjacent information mark is visual-only for now.
3. Select the data categories to add, then review the validated file summary.
   Forge shows available, new, and already-present records before any data is
   written.
4. Confirm **Import selected data**. Existing local data is retained; records
   that already have the same stable Forge ID are not added again.

Export JSON and Export text use the same category chooser, so a portable file
can contain only the data you selected. JSON is the complete portable format;
text is a read-only sharing summary.

JSON import is additive, not a device restore. To replace all data on an
iPhone or Android build, use **Create SQLite backup** and **Restore SQLite
backup** instead. SQLite backups are Forge-specific and are not compatible
with the previous Swift/Core Data app. Web supports JSON transfer but not a
complete SQLite backup.

The transfer contains personal training data. Store it privately and only
import files you trust. If Forge rejects a file, export it again from a
compatible Forge installation rather than editing it by hand.

## Migrating a legacy Swift Forge database

The previous Swift app used a Core Data SQLite schema, so it cannot be restored
as a current Forge SQLite backup. Convert a copy into the portable JSON format
instead:

```bash
python3 scripts/migrate_legacy_forge_sqlite.py old-forge.sqlite forge-import.json
```

The converter opens the source read-only, preserves completed history, plans,
routines, custom exercises, notes, set measurements and targets, then validates
the resulting Forge JSON. It deliberately excludes legacy “current workout”
rows because current Forge permits only one active workout; a migration can be
reviewed in the JSON import screen before it writes to the app.

## Unsigned iOS sideload build

The manual **Build unsigned iOS IPA** GitHub workflow runs the Forge build
directly on the standard `macos-15` runner. It generates the iOS project,
builds an unsigned device archive with Xcode, packages `Payload/Forge.app`,
and verifies both the app and its direct Live Activity/widget extension before
upload. It deliberately needs neither an EAS build nor Apple credentials; it
is intended for iLoader, which re-signs the IPA with the user's Apple ID before
installation. The sideload archive does not depend on an App Group when
iLoader re-signs it. The IPA and `xcodebuild` log remain separate GitHub
Actions artifacts for 30 days. The repository's `EXPO_TOKEN` may remain stored
for other Expo operations, but this workflow does not read it.

## Android APK build

The manual **Build Android APK** GitHub workflow runs on a standard
`ubuntu-latest` runner: it generates the Android project with `expo prebuild`
(including Forge's config plugins) and builds a release APK with Gradle. The
Expo release build type is signed with the bundled debug keystore and embeds
the JS bundle, so the APK installs and runs on a device without Metro — it is a
sideload test build, not a Play Store release. To keep the build fast it
compiles only the `arm64-v8a` architecture, which every modern physical phone
uses; the APK therefore does **not** install on x86/x86_64 emulators. Gradle,
its dependencies, and the build cache are cached between runs. The signed
`Forge-release.apk` is uploaded as a GitHub Actions artifact for 30 days.
