const { withInfoPlist, withAndroidManifest, AndroidConfig } = require('expo/config-plugins');
const {
  uti: FORGE_UTI,
  extension: FORGE_EXTENSION,
  mimeType: FORGE_MIME,
} = require('../src/data/forgeFileType.json');

// Lets a shared `.forge` file open straight into Forge (AirDrop, Files, Mail,
// Drive, etc.) instead of forcing Settings -> Backup & Export -> Import.
// `.forge` files contain JSON, but are application documents rather than generic
// text. Advertising them as public.json lets text editors claim their opens.
//
// This is a managed Expo project with no committed `ios/` or `android/`, so the
// document-type and intent-filter registrations are patched into the prebuilt
// Info.plist and AndroidManifest here rather than hand-edited native files.

const LEGACY_MIME = 'application/json';
const TYPE_DESCRIPTION = 'Forge data';

function withForgeDocumentTypeIOS(config) {
  return withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;

    // Replace our old declaration on repeated prebuilds, preserving other types.
    const exported = infoPlist.UTExportedTypeDeclarations ?? [];
    infoPlist.UTExportedTypeDeclarations = [
      ...exported.filter((entry) => entry?.UTTypeIdentifier !== FORGE_UTI),
      {
        UTTypeIdentifier: FORGE_UTI,
        UTTypeDescription: TYPE_DESCRIPTION,
        UTTypeConformsTo: ['public.data', 'public.content'],
        UTTypeTagSpecification: {
          'public.filename-extension': [FORGE_EXTENSION],
          'public.mime-type': [FORGE_MIME],
        },
      },
    ];

    // Register the app as an owning handler for that type so iOS routes an
    // opened `.forge` file to Forge and surfaces it in the share sheet.
    const documentTypes = infoPlist.CFBundleDocumentTypes ?? [];
    infoPlist.CFBundleDocumentTypes = [
      ...documentTypes.flatMap((entry) => {
        if (!(entry?.LSItemContentTypes ?? []).includes(FORGE_UTI)) return [entry];
        const otherTypes = entry.LSItemContentTypes.filter((type) => type !== FORGE_UTI);
        return otherTypes.length ? [{ ...entry, LSItemContentTypes: otherTypes }] : [];
      }),
      {
        CFBundleTypeName: TYPE_DESCRIPTION,
        // Editor: Forge reads the file and imports/merges its contents.
        CFBundleTypeRole: 'Editor',
        LSHandlerRank: 'Owner',
        LSItemContentTypes: [FORGE_UTI],
      },
    ];

    // Opt out of in-place opening so iOS COPIES an opened/shared `.forge` into the
    // app's Documents/Inbox and hands a sandbox-local file:// URL. In place, iOS
    // delivers a security-scoped URL that a plain read (expo-file-system File.text)
    // cannot open without startAccessingSecurityScopedResource — the "you don't have
    // permission to view it" failure. Copying sidesteps the scope entirely.
    infoPlist.LSSupportsOpeningDocumentsInPlace = false;
    infoPlist.UISupportsDocumentBrowser = false;

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

  // A MIME-bearing intent never matches a filter without a MIME type. Keep
  // this wildcard constrained to named .forge paths, not all provider files.
  const byTypedExtension = {
    ...byExtension,
    data: [...byExtension.data, { $: { 'android:mimeType': '*/*' } }],
  };

  // Opaque provider URIs need MIME matching. Keep JSON for previous exports;
  // parseDataTransfer rejects unrelated JSON. Never claim every opaque file.
  const byMime = {
    action: viewAction,
    category: categories,
    data: [
      ...FILE_CONTENT_SCHEMES.map((scheme) => ({ $: { 'android:scheme': scheme } })),
      { $: { 'android:mimeType': FORGE_MIME } },
      { $: { 'android:mimeType': LEGACY_MIME } },
    ],
  };

  return [byExtension, byTypedExtension, byMime];
}

// Recognise a filter this plugin already added, without stamping a foreign
// attribute onto the manifest node (which would serialise as invalid XML).
function isForgeFilter(filter) {
  const data = (filter && filter.data) ?? [];
  const schemes = data.flatMap((entry) => entry?.$?.['android:scheme'] ?? []);
  if (
    !filter?.action?.some((entry) => entry?.$?.['android:name'] === 'android.intent.action.VIEW') ||
    !schemes.length ||
    schemes.some((scheme) => !FILE_CONTENT_SCHEMES.includes(scheme))
  )
    return false;
  return data.some((entry) => {
    const attrs = entry?.$ ?? {};
    return (
      attrs['android:pathPattern'] === EXTENSION_PATH_PATTERNS[0] ||
      attrs['android:mimeType'] === FORGE_MIME ||
      attrs['android:mimeType'] === LEGACY_MIME
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
