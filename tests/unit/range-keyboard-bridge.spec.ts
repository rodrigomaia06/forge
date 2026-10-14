import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function keyboardBridge(available = true) {
  const native = new Set<(frame: unknown) => void>();
  const system = new Map<string, (event: unknown) => void>();
  let nativeDismissals = 0;
  let systemDismissals = 0;
  let back: (() => boolean) | undefined;
  const exports: any = {};
  const source = ts.transpileModule(readFileSync('src/components/ui/forgeKeyboard.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(source, { exports, require: (name: string) => {
    if (name === 'react-native') return {
      Keyboard: { metrics: () => ({ height: 200 }), dismiss: () => systemDismissals++,
        addListener: (name: string, callback: (event: unknown) => void) => {
          system.set(name, callback);
          return { remove: () => system.delete(name) };
        } },
      BackHandler: { addEventListener: (_name: string, callback: () => boolean) => {
        back = callback;
        return { remove: () => { back = undefined; } };
      } },
    };
    if (name === '../../../modules/forge-range-keyboard') return { rangeKeyboardModule: available ? {
      dismiss: () => nativeDismissals++,
      addListener: (_name: string, callback: (frame: unknown) => void) => {
        native.add(callback);
        return { remove: () => native.delete(callback) };
      },
    } : null };
    throw new Error(`Unexpected import ${name}`);
  } });
  return { exports, system, native,
    frame: (visible: boolean) => native.forEach(callback => callback({ visible, height: 300, width: 393, screenX: 0, screenY: 550, duration: 0 })),
    back: () => back?.(), counts: () => [nativeDismissals, systemDismissals],
  };
}

test('custom range occlusion drives show/hide and survives a late IME hide', () => {
  const bridge = keyboardBridge();
  const shows: any[] = [], hides: any[] = [];
  const show = bridge.exports.addForgeKeyboardListener('keyboardDidShow', (event: unknown) => shows.push(event));
  const hide = bridge.exports.addForgeKeyboardListener('keyboardDidHide', (event: unknown) => hides.push(event));
  bridge.frame(true);
  expect(shows[0].endCoordinates).toMatchObject({ height: 300, screenY: 550 });
  expect(bridge.exports.forgeKeyboardMetrics().height).toBe(300);
  bridge.system.get('keyboardDidHide')!({});
  expect(hides).toHaveLength(0);
  expect(bridge.back()).toBe(true);
  expect(bridge.counts()).toEqual([1, 1]);
  bridge.frame(false);
  expect(hides).toHaveLength(1);
  expect(hides[0].endCoordinates.height).toBe(0);
  expect(bridge.back()).toBe(false);
  show.remove(); hide.remove();
  expect(bridge.native.size).toBe(0);
});

test('unsupported runtime retains system keyboard behavior', () => {
  const bridge = keyboardBridge(false);
  const events: unknown[] = [];
  bridge.exports.addForgeKeyboardListener('keyboardDidShow', (event: unknown) => events.push(event));
  bridge.system.get('keyboardDidShow')!({ endCoordinates: { height: 200 } });
  expect(events).toHaveLength(1);
  expect(bridge.exports.forgeKeyboardMetrics().height).toBe(200);
  bridge.exports.dismissForgeKeyboard();
  expect(bridge.counts()).toEqual([0, 1]);
});
