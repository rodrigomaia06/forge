import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function keyboardBridge(available = true, platform = 'android') {
  const native = new Set<(frame: unknown) => void>();
  const system = new Map<string, (event: unknown) => void>();
  const systemListeners = new Map<string, Set<(event: unknown) => void>>();
  let nativeDismissals = 0;
  let systemDismissals = 0;
  let back: (() => boolean) | undefined;
  const lifecycle = new Set<(state: string) => void>();
  const timers = new Map<number, () => void>();
  let timerId = 0;
  const appState = {
    currentState: 'active',
    addEventListener: (_name: string, callback: (state: string) => void) => {
      lifecycle.add(callback);
      return { remove: () => lifecycle.delete(callback) };
    },
  };
  const exports: any = {};
  const source = ts.transpileModule(readFileSync('src/components/ui/forgeKeyboard.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(source, { exports,
    setTimeout: (callback: () => void) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id: number) => timers.delete(id),
    require: (name: string) => {
    if (name === 'react-native') return {
      Platform: { OS: platform }, AppState: appState,
      Keyboard: { metrics: () => ({ height: 200 }), dismiss: () => systemDismissals++,
        addListener: (name: string, callback: (event: unknown) => void) => {
          const listeners = systemListeners.get(name) ?? new Set();
          listeners.add(callback);
          systemListeners.set(name, listeners);
          system.set(name, event => listeners.forEach(listener => listener(event)));
          return { remove: () => { listeners.delete(callback); if (!listeners.size) system.delete(name); } };
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
    state: (state: string) => { appState.currentState = state; lifecycle.forEach(callback => callback(state)); },
    flush: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); },
    lifecycle,
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

test('iPhone app switching preserves layout and ignores the unchanged returning keyboard', () => {
  const bridge = keyboardBridge(false, 'ios');
  const shows: any[] = [], hides: any[] = [];
  const show = bridge.exports.addForgeKeyboardListener('keyboardWillShow', (event: unknown) => shows.push(event));
  const hide = bridge.exports.addForgeKeyboardListener('keyboardWillHide', (event: unknown) => hides.push(event));
  const frame = { height: 300, width: 393, screenX: 0, screenY: 550 };
  const event = { endCoordinates: frame, isEventFromThisApp: true };
  bridge.system.get('keyboardWillShow')!(event);
  bridge.system.get('keyboardWillHide')!(event);
  bridge.state('inactive');
  bridge.flush();
  bridge.state('background');
  bridge.system.get('keyboardWillShow')!({ ...event, endCoordinates: { ...frame, height: 250 } });
  bridge.system.get('keyboardWillHide')!(event);
  bridge.flush();
  bridge.state('active');
  bridge.system.get('keyboardWillShow')!({ ...event, isEventFromThisApp: false });
  bridge.system.get('keyboardWillShow')!(event);
  expect(shows).toHaveLength(1);
  expect(hides).toHaveLength(0);
  bridge.system.get('keyboardWillHide')!(event);
  bridge.flush();
  expect(hides).toHaveLength(1);
  bridge.state('inactive');
  bridge.state('active');
  bridge.system.get('keyboardWillShow')!(event);
  expect(shows).toHaveLength(2);
  show.remove(); hide.remove();
  expect(bridge.lifecycle.size).toBe(0);
});

test('a changed iPhone keyboard frame after app switching still updates layout', () => {
  const bridge = keyboardBridge(false, 'ios');
  const events: any[] = [];
  bridge.exports.addForgeKeyboardListener('keyboardWillChangeFrame', (event: unknown) => events.push(event));
  const frame = { height: 300, width: 393, screenX: 0, screenY: 550 };
  bridge.system.get('keyboardWillChangeFrame')!({ endCoordinates: frame });
  bridge.state('inactive');
  bridge.state('active');
  bridge.system.get('keyboardWillChangeFrame')!({ endCoordinates: { ...frame, screenY: 500, height: 350 } });
  expect(events).toHaveLength(2);
  expect(events[1].endCoordinates.height).toBe(350);
});

test('removing an iPhone listener cancels a queued dismissal', () => {
  const bridge = keyboardBridge(false, 'ios');
  const events: unknown[] = [];
  const listener = bridge.exports.addForgeKeyboardListener('keyboardWillHide', (event: unknown) => events.push(event));
  bridge.system.get('keyboardWillHide')!({ endCoordinates: { height: 0 } });
  listener.remove();
  bridge.flush();
  expect(events).toHaveLength(0);
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
