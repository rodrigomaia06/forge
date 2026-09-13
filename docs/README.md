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

## Unsigned iOS sideload build

The manual **Build unsigned iOS IPA** GitHub workflow uses Forge's explicit
`ios-unsigned.yml` EAS build. It deliberately skips Apple credentials and
packages an unsigned device archive; it is intended for iLoader, which
re-signs the IPA with the user's Apple ID before installation. The sideload
archive retains Forge's Live Activity/widget extension and App Group, which
iLoader provisions as it re-signs the IPA. After EAS completes, the workflow
retains the final IPA as the `Forge-unsigned-ios-ipa` GitHub Actions artifact
for 30 days. When EAS provides Xcode/build logs, the same run retains them as
`Forge-unsigned-ios-build-logs` for the same period.
