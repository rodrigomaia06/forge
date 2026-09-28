const { withInfoPlist, withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

// Lets a shared `.forge` file open straight into Forge (AirDrop, Files, Mail,
// Drive, etc.) instead of forcing Settings -> Backup & Export -> Import. A
// `.forge` file is Forge's portable JSON export (see backupRepository), so the
// declared type conforms to public.json / public.data.
//
// This is a managed Expo project with no committed `ios/` or `android/`, so the
// document-type and intent-filter registrations are patched into the prebuilt
// Info.plist and AndroidManifest here rather than hand-edited native files.

// Reverse-DNS, namespaced under the app's own bundle id so the exported UTI can
// never collide with another app's type. (Apple recommends owning the prefix;
// the issue's `app.forge.data` example is not under a domain Forge controls.)
const FORGE_UTI = 'com.forge.training.data';
const FORGE_EXTENSION = 'forge';
const FORGE_MIME = 'application/json';
const TYPE_DESCRIPTION = 'Forge data';

function withForgeDocumentTypeIOS(config) {
  return withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;

    // Declare the custom `.forge` type as one Forge exports/owns. Conforming to
    // public.json (which itself conforms to public.text -> public.data) tells
    // the OS the payload is JSON while keeping the extension distinctly Forge's.
    const exported = infoPlist.UTExportedTypeDeclarations ?? [];
    if (!exported.some((entry) => entry?.UTTypeIdentifier === FORGE_UTI)) {
      exported.push({
        UTTypeIdentifier: FORGE_UTI,
        UTTypeDescription: TYPE_DESCRIPTION,
        UTTypeConformsTo: ['public.json', 'public.data'],
        UTTypeTagSpecification: {
          'public.filename-extension': [FORGE_EXTENSION],
          'public.mime-type': [FORGE_MIME],
        },
      });
    }
    infoPlist.UTExportedTypeDeclarations = exported;

    // Register the app as an owning handler for that type so iOS routes an
    // opened `.forge` file to Forge and surfaces it in the share sheet.
    const documentTypes = infoPlist.CFBundleDocumentTypes ?? [];
    if (!documentTypes.some((entry) => (entry?.LSItemContentTypes ?? []).includes(FORGE_UTI))) {
      documentTypes.push({
        CFBundleTypeName: TYPE_DESCRIPTION,
        // Editor: Forge reads the file and imports/merges its contents.
        CFBundleTypeRole: 'Editor',
        LSHandlerRank: 'Owner',
        LSItemContentTypes: [FORGE_UTI],
      });
    }
    infoPlist.CFBundleDocumentTypes = documentTypes;

    return config;
  });
}

// Android matches a custom extension through scheme + host + pathPattern. The
// leading `.*` is greedy, so a filename with earlier dots (e.g.
// `Forge.export.2026.forge`) needs the extra escaped-dot patterns below to
// still match. content:// providers rarely expose the name, so the mime-typed
// filter is the practical path for Gmail/Drive attachments.
const FILE_CONTENT_SCHEMES = ['content', 'file'];
const EXTENSION_PATH_PATTERNS = [
  `.*\\.${FORGE_EXTENSION}`,
  `.*\\..*\\.${FORGE_EXTENSION}`,
  `.*\\..*\\..*\\.${FORGE_EXTENSION}`,
  `.*\\..*\\..*\\..*\\.${FORGE_EXTENSION}`,
];

function forgeIntentFilters() {
  const viewAction = [{ $: { 'android:name': 'android.intent.action.VIEW' } }];
  const categories = [
    { $: { 'android:name': 'android.intent.category.DEFAULT' } },
    { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
  ];

  // Extension-based match for file:// and content:// URIs that expose a name.
  const byExtension = {
    action: viewAction,
    category: categories,
    data: [
      ...FILE_CONTENT_SCHEMES.map((scheme) => ({ $: { 'android:scheme': scheme } })),
      { $: { 'android:host': '*' } },
      ...EXTENSION_PATH_PATTERNS.map((pattern) => ({ $: { 'android:pathPattern': pattern } })),
    ],
  };

  // Mime-based match for content:// attachments whose name is hidden; the
  // in-app content check (parseDataTransfer) rejects non-Forge JSON.
  const byMime = {
    action: viewAction,
    category: categories,
    data: [
      ...FILE_CONTENT_SCHEMES.map((scheme) => ({ $: { 'android:scheme': scheme } })),
      { $: { 'android:host': '*' } },
      { $: { 'android:mimeType': FORGE_MIME } },
    ],
  };

  return [byExtension, byMime];
}

// Recognise a filter this plugin already added, without stamping a foreign
// attribute onto the manifest node (which would serialise as invalid XML).
function isForgeFilter(filter) {
  const data = (filter && filter.data) ?? [];
  return data.some((entry) => {
    const attrs = entry?.$ ?? {};
    return (
      attrs['android:pathPattern'] === EXTENSION_PATH_PATTERNS[0] ||
      attrs['android:mimeType'] === FORGE_MIME
    );
  });
}

function withForgeIntentFilterAndroid(config) {
  return withAndroidManifest(config, (config) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    const existing = mainActivity['intent-filter'] ?? [];

    // Idempotent across repeated prebuilds: drop any filters we added before,
    // then re-add the current set, so they never accumulate as duplicates.
    mainActivity['intent-filter'] = [
      ...existing.filter((filter) => !isForgeFilter(filter)),
      ...forgeIntentFilters(),
    ];

    return config;
  });
}

module.exports = function withForgeFileAssociation(config) {
  config = withForgeDocumentTypeIOS(config);
  config = withForgeIntentFilterAndroid(config);
  return config;
};
