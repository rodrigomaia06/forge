import { expect, test } from '@playwright/test';
import { readFileSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fileType from '../../src/data/forgeFileType.json';

const withIcons = require('../../plugins/withForgeDocumentIcons');
const withAssociation = require('../../plugins/withForgeFileAssociation');
const projectRoot = process.cwd();
const config = () => withAssociation(withIcons({ name: 'Forge', slug: 'forge' }));

test('registered plugin order attaches icons only to Forge document and VIEW handlers', async () => {
  const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
  expect(app.plugins.indexOf('./plugins/withForgeDocumentIcons.js')).toBeLessThan(
    app.plugins.indexOf('./plugins/withForgeFileAssociation.js'),
  );
  const mods = config();
  const other = { LSItemContentTypes: ['public.pdf'] };
  const plist = (
    await mods.mods.ios.infoPlist({
      ...mods,
      modRequest: {},
      modResults: { CFBundleDocumentTypes: [other] },
    })
  ).modResults;
  expect(plist.CFBundleDocumentTypes[0]).toEqual(other);
  const icons = plist.CFBundleDocumentTypes.find((entry: any) =>
    entry.LSItemContentTypes.includes(fileType.uti),
  ).CFBundleTypeIconFiles;
  expect(icons).toHaveLength(5);
  for (const name of icons)
    expect(readFileSync(path.join('assets/file-icons', name)).subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );

  const launcher = { action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }] };
  const manifest = {
    manifest: {
      application: [
        {
          activity: [
            {
              $: { 'android:name': '.MainActivity' },
              'intent-filter': [launcher],
            },
          ],
        },
      ],
    },
  };
  const result = (
    await mods.mods.android.manifest({ ...mods, modRequest: {}, modResults: manifest })
  ).modResults;
  const filters = result.manifest.application[0].activity[0]['intent-filter'];
  expect(filters[0]).toEqual(launcher);
  expect(filters.slice(1)).toHaveLength(3);
  for (const filter of filters.slice(1))
    expect(filter.$['android:icon']).toBe('@drawable/forge_document');
});

test('Android resource copy is repeat-safe and contains the actual document artwork', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'forge-icon-'));
  try {
    const mods = config();
    const input = {
      ...mods,
      modRequest: { projectRoot, platformProjectRoot: directory },
      modResults: {},
    };
    await mods.mods.android.dangerous(input);
    await mods.mods.android.dangerous(input);
    expect(
      readFileSync(path.join(directory, 'app/src/main/res/drawable-xxxhdpi/forge_document.png')),
    ).toEqual(readFileSync('assets/file-icons/forge_document.png'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('iOS copies and links all declared icons into the application resources once', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'forge-icon-'));
  const group = { children: [] as any[] };
  const resources: any[] = [];
  const references = new Set<string>();
  let uuid = 0;
  const project = {
    hasFile: (filepath: string) => references.has(filepath),
    getFirstProject: () => ({ firstProject: { mainGroup: 'root' } }),
    getPBXGroupByKey: (key: string) =>
      key === 'root' ? { children: [{ comment: 'Forge', value: 'app' }] } : group,
    pbxGroupByName: () => group,
    pbxGroupByPath: () => group,
    pbxGroupSection: () => ({ app: { name: 'Forge', path: 'Forge', ...group } }),
    getTarget: () => ({ uuid: 'app-target' }),
    generateUuid: () => `uuid-${++uuid}`,
    addToPbxFileReferenceSection: (file: any) => references.add(file.path),
    addToPbxBuildFileSection: () => undefined,
    addToPbxResourcesBuildPhase: (file: any) => resources.push(file),
  };
  try {
    mkdirSync(path.join(directory, 'ios/Forge'), { recursive: true });
    // Expo derives the native source directory from its AppDelegate.
    symlinkSync(path.join(projectRoot, 'assets'), path.join(directory, 'assets'));
    writeFileSync(path.join(directory, 'ios/Forge/AppDelegate.swift'), '');
    const mods = config();
    const input = { ...mods, modRequest: { projectRoot: directory }, modResults: project };
    await mods.mods.ios.xcodeproj(input);
    await mods.mods.ios.xcodeproj(input);
    expect(resources).toHaveLength(5);
    for (const file of resources) {
      expect(file.target).toBe('app-target');
      expect(readFileSync(path.join(directory, 'ios', file.path))).toEqual(
        readFileSync(path.join('assets/file-icons', file.basename)),
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
