import { expect, test } from '@playwright/test';
import type { ExpoConfig } from 'expo/config';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import fileType from '../../src/data/forgeFileType.json';

const withAssociation = require('../../plugins/withForgeFileAssociation');

async function apply(platform: 'ios' | 'android', modResults: any) {
  const config = withAssociation({ name: 'Forge', slug: 'forge' } satisfies ExpoConfig);
  const mod = platform === 'ios' ? 'infoPlist' : 'manifest';
  return (await config.mods[platform][mod]({ ...config, modResults, modRequest: {} })).modResults;
}

test('iOS registers a distinct owned document type and keeps copied-file access', async () => {
  const plist = await apply('ios', {});
  expect(plist.UTExportedTypeDeclarations).toEqual([
    {
      UTTypeIdentifier: fileType.uti,
      UTTypeDescription: 'Forge data',
      UTTypeConformsTo: ['public.data', 'public.content'],
      UTTypeTagSpecification: {
        'public.filename-extension': [fileType.extension],
        'public.mime-type': [fileType.mimeType],
      },
    },
  ]);
  expect(plist.CFBundleDocumentTypes).toEqual([
    {
      CFBundleTypeName: 'Forge data',
      CFBundleTypeRole: 'Editor',
      LSHandlerRank: 'Owner',
      LSItemContentTypes: [fileType.uti],
    },
  ]);
  expect(plist.LSSupportsOpeningDocumentsInPlace).toBe(false);
  expect(plist.UISupportsDocumentBrowser).toBe(false);
});

test('repeated iOS prebuild replaces stale JSON associations without losing other declarations', async () => {
  const other = { UTTypeIdentifier: 'com.example.other' };
  const unrelatedDocument = {
    LSItemContentTypes: ['com.example.other'],
    LSHandlerRank: 'Alternate',
  };
  const migrated = await apply('ios', {
    UTExportedTypeDeclarations: [
      other,
      {
        UTTypeIdentifier: fileType.uti,
        UTTypeConformsTo: ['public.json'],
        UTTypeTagSpecification: { 'public.mime-type': ['application/json'] },
      },
    ],
    CFBundleDocumentTypes: [
      {
        LSItemContentTypes: [fileType.uti, 'com.example.other'],
        LSHandlerRank: 'Alternate',
      },
    ],
  });
  expect(migrated.UTExportedTypeDeclarations).toHaveLength(2);
  expect(migrated.UTExportedTypeDeclarations[0]).toEqual(other);
  expect(migrated.CFBundleDocumentTypes).toContainEqual(unrelatedDocument);
  expect(
    migrated.CFBundleDocumentTypes.find((entry: any) =>
      entry.LSItemContentTypes.includes(fileType.uti),
    ).LSHandlerRank,
  ).toBe('Owner');
  expect(await apply('ios', structuredClone(migrated))).toEqual(migrated);
});

const dataAttributes = (filter: any) => filter.data.map((entry: any) => entry.$);
const view = { $: { 'android:name': 'android.intent.action.VIEW' } };
const manifest = (filters: any[]) => ({
  manifest: {
    application: [
      {
        activity: [
          {
            $: { 'android:name': '.MainActivity' },
            'intent-filter': filters,
          },
        ],
      },
    ],
  },
});
const filtersOf = (value: any) => value.manifest.application[0].activity[0]['intent-filter'];

test('Android covers extension opens with and without MIME and opaque provider MIME opens', async () => {
  const filters = filtersOf(await apply('android', manifest([])));
  expect(filters).toHaveLength(3);
  const [untyped, typed, opaque] = filters.map(dataAttributes);
  expect(untyped.filter((data: any) => data['android:mimeType'])).toEqual([]);
  for (const extensionFilter of [untyped, typed]) {
    expect(extensionFilter).toContainEqual({ 'android:scheme': 'file' });
    expect(extensionFilter).toContainEqual({ 'android:scheme': 'content' });
    expect(extensionFilter.filter((data: any) => data['android:pathPattern'])).toHaveLength(4);
  }
  expect(typed).toContainEqual({ 'android:mimeType': '*/*' });
  expect(
    opaque
      .filter((data: any) => data['android:mimeType'])
      .map((data: any) => data['android:mimeType']),
  ).toEqual([fileType.mimeType, 'application/json']);
  expect(opaque.some((data: any) => data['android:host'] || data['android:pathPattern'])).toBe(
    false,
  );
});

test('Android upgrades previous filters idempotently and retains launcher, links and foreign handlers', async () => {
  const launcher = { action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }] };
  const link = { action: [view], data: [{ $: { 'android:scheme': 'forge' } }] };
  const foreign = {
    action: [view],
    data: [{ $: { 'android:scheme': 'https' } }, { $: { 'android:mimeType': 'application/json' } }],
  };
  const legacy = {
    action: [view],
    data: [
      { $: { 'android:scheme': 'content' } },
      { $: { 'android:mimeType': 'application/json' } },
    ],
  };
  const updated = await apply('android', manifest([launcher, link, foreign, legacy]));
  expect(filtersOf(updated)).toHaveLength(6);
  expect(filtersOf(updated).slice(0, 3)).toEqual([launcher, link, foreign]);
  expect(await apply('android', structuredClone(updated))).toEqual(updated);
});

function nativeExporter(available = true) {
  const shares: { uri: string; options: any }[] = [];
  const files: { name: string; content: string }[] = [];
  class File {
    exists = false;
    uri: string;
    constructor(
      _directory: unknown,
      private name: string,
    ) {
      this.uri = `file:///cache/${name}`;
    }
    create() {}
    write(content: string) {
      files.push({ name: this.name, content });
    }
  }
  const exports: any = {};
  const source = ts.transpileModule(readFileSync('src/data/backupRepository.ts', 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  runInNewContext(source, {
    exports,
    require: (name: string) => {
      if (name === 'expo-file-system') return { File, Paths: { cache: 'cache' } };
      if (name === 'expo-sharing')
        return {
          isAvailableAsync: async () => available,
          shareAsync: async (uri: string, options: any) => {
            shares.push({ uri, options });
          },
        };
      if (name === './forgeFileType.json') return fileType;
      return {};
    },
  });
  return { shareTransfer: exports.shareTransfer, shares, files };
}

for (const kind of ['backup', 'workout'] as const) {
  test(`native ${kind} export retains the .forge extension and dedicated share metadata`, async () => {
    const exporter = nativeExporter();
    const transfer = {
      format: 'forge-data',
      version: 1,
      ...(kind === 'workout' ? { share: { kind, title: 'Morning workout' } } : {}),
    };
    await exporter.shareTransfer(transfer);
    expect(exporter.files).toHaveLength(1);
    expect(exporter.files[0].name).toMatch(/\.forge$/);
    expect(JSON.parse(exporter.files[0].content)).toEqual(transfer);
    expect(exporter.shares).toEqual([
      {
        uri: `file:///cache/${exporter.files[0].name}`,
        options: { mimeType: fileType.mimeType, UTI: fileType.uti, dialogTitle: 'Forge data' },
      },
    ]);
  });
}

test('native export reports unavailable sharing instead of pretending the file was sent', async () => {
  const exporter = nativeExporter(false);
  const error = await exporter.shareTransfer({ format: 'forge-data', version: 1 }).then(
    () => null,
    (error: Error) => error.message,
  );
  expect(error).toContain('File sharing is not available');
  expect(exporter.shares).toEqual([]);
});
