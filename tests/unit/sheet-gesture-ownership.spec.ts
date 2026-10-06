import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the sheet's native component wiring with native bridges stubbed. This
// checks gesture ownership without pretending to simulate UIKit recognition.
function loadSheet() {
  const contexts: { value: unknown }[] = [];
  const callbacks: Record<string, (...args: any[]) => void>[] = [];
  const shared: { value: any }[] = [];
  const react = {
    createContext: (value: unknown) => {
      const context = { value, Provider: 'Provider' };
      contexts.push(context);
      return context;
    },
    createElement: (type: unknown, props: any, ...children: unknown[]) => ({ type, props: { ...props, children } }),
    useContext: (context: { value: unknown }) => context.value,
    useMemo: (fn: () => unknown) => fn(),
    useCallback: (fn: unknown) => fn,
    useEffect: () => undefined,
    useRef: (value: unknown) => ({ current: value }),
    useState: (value: unknown) => [typeof value === 'function' ? value() : value, () => undefined],
  };
  const Gesture = {
    Pan: () => {
      const handlers: Record<string, (...args: any[]) => void> = {};
      callbacks.push(handlers);
      const gesture: any = new Proxy({}, { get: (_target, key) => (value: any) => {
        if (String(key).startsWith('on')) handlers[String(key)] = value;
        return gesture;
      }});
      return gesture;
    },
  };
  const mocks: Record<string, unknown> = {
    react,
    'react-native-worklets': { scheduleOnRN: (fn: (...args: any[]) => unknown, ...args: any[]) => fn(...args) },
    'react-native': {
      Platform: { OS: 'ios' }, StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
      View: 'View', Modal: 'Modal', Pressable: 'Pressable', Keyboard: { dismiss: () => undefined },
      LayoutAnimation: {}, UIManager: {}, useWindowDimensions: () => ({ height: 900, width: 420 }),
    },
    'react-native-gesture-handler': { Gesture, GestureDetector: 'GestureDetector' },
    'react-native-reanimated': {
      View: 'AnimatedView', LinearTransition: { duration: () => undefined },
      useSharedValue: (value: unknown) => { const state = { value }; shared.push(state); return state; },
      useAnimatedStyle: () => ({}), withSpring: (value: unknown) => value,
      withTiming: (value: unknown) => value,
    },
    '../../theme/ThemeProvider': { useForgeTheme: () => ({}) },
    '../../theme/motion': { useForgeReducedMotion: () => true, forgeMotion: { sheetSpring: {}, sheetEnter: 0, sheetExit: 0 } },
    '../../theme/scale': { scaleUI: (value: unknown) => value },
    './haptics': { lightHaptic: () => undefined },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
  };
  const source = ts.transpileModule(readFileSync('src/components/ui/ForgeBottomSheet.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports: any = {};
  runInNewContext(source, { exports, require: (name: string) => {
    if (!(name in mocks)) throw new Error(`Unstubbed native import: ${name}`);
    return mocks[name];
  }, setTimeout: () => 0, clearTimeout: () => undefined, requestAnimationFrame: () => 0 });
  return { exports, contexts, callbacks, shared };
}
function providers(node: any): any[] {
  if (!node || typeof node !== 'object') return [];
  return [node.type === 'Provider' ? node : null, ...(node.props?.children ?? []).flat().flatMap(providers)].filter(Boolean);
}
test('native handle, header and compact body own different handlers but share dismissal state', () => {
  const { exports, contexts, callbacks, shared } = loadSheet();
  let closed = 0;
  const tree = exports.ForgeBottomSheet({ visible: true, onClose: () => closed++, children: 'Content', dismissThreshold: 80 });
  const factory = providers(tree)[0].props.value;
  contexts[0].value = factory;
  const handle = exports.ForgeBottomSheetHandle();
  const header = exports.ForgeBottomSheetDragArea({ children: 'Header' });
  const body = exports.ForgeBottomSheetDragArea({ children: 'Choices' });
  expect(handle.props.gesture).not.toBe(header.props.gesture);
  expect(header.props.gesture).not.toBe(body.props.gesture);
  expect(body.props.gesture).not.toBe(handle.props.gesture);
  const pans = callbacks.filter((callback) => callback.onUpdate);
  expect(pans).toHaveLength(3);
  shared[0].value = 0;
  pans[0].onStart();
  pans[0].onUpdate({ translationY: 10 });
  expect(shared[0].value).toBe(10);
  pans[2].onStart();
  pans[2].onUpdate({ translationY: 90 });
  expect(shared[0].value).toBe(100);
  pans[2].onEnd({ translationY: 90, velocityY: 0 });
  expect(closed).toBe(1);
});
