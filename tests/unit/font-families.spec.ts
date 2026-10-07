import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { resolveManropeFamilies } from '../../src/theme/fontFamilies';

function postScriptName(data: Buffer): string {
  const tables = data.readUInt16BE(4);
  let table = -1;
  for (let i = 0; i < tables; i += 1) {
    const offset = 12 + i * 16;
    if (data.toString('ascii', offset, offset + 4) === 'name')
      table = data.readUInt32BE(offset + 8);
  }
  if (table < 0) throw new Error('Missing font name table');
  const count = data.readUInt16BE(table + 2);
  const strings = table + data.readUInt16BE(table + 4);
  for (let i = 0; i < count; i += 1) {
    const record = table + 6 + i * 12;
    if (data.readUInt16BE(record) !== 3 || data.readUInt16BE(record + 6) !== 6) continue;
    const length = data.readUInt16BE(record + 8);
    const offset = strings + data.readUInt16BE(record + 10);
    const name = data.subarray(offset, offset + length);
    return Array.from({ length: length / 2 }, (_, index) =>
      String.fromCharCode(name.readUInt16BE(index * 2)),
    ).join('');
  }
  throw new Error('Missing Windows PostScript font name');
}

test('native font embedding matches the real Manrope assets and iOS names', () => {
  const config = JSON.parse(fs.readFileSync(path.resolve('app.json'), 'utf8'));
  const entry = config.expo.plugins.find(
    (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-font',
  );
  const fonts: string[] = entry[1].fonts;
  expect(fonts).toHaveLength(4);
  const iosNames = fonts.map((font) => postScriptName(fs.readFileSync(path.resolve(font))));
  const loaded = new Set(iosNames);
  const resolved = resolveManropeFamilies('ios', (name) => loaded.has(name));
  expect(resolved.embedded).toBe(true);
  expect(Object.values(resolved.families)).toEqual(iosNames);
  const androidNames = new Set(fonts.map((font) => path.basename(font, '.ttf')));
  expect(resolveManropeFamilies('android', (name) => androidNames.has(name)).embedded).toBe(true);
});

test('web, Expo Go, and older native builds keep runtime font loading', () => {
  expect(resolveManropeFamilies('web', () => true).embedded).toBe(false);
  expect(resolveManropeFamilies('ios', () => false)).toEqual(
    resolveManropeFamilies('web', () => false),
  );
  expect(resolveManropeFamilies('android', () => false).embedded).toBe(false);
  const partial = new Set(['Manrope-Regular', 'Manrope-Bold']);
  expect(resolveManropeFamilies('ios', (name) => partial.has(name)).embedded).toBe(false);
});
