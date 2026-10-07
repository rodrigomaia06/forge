import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function keyboardLift() {
  const events = new Map<string, (event: unknown) => void>();
  const frames: (() => void)[] = [];
  const measurements: ((frame: { y: number; height: number }) => void)[] = [];
  const scrolls: { offset: number; animated: boolean }[] = [];
  const keyboard = { screenY: 500, height: 350 };
  const offset = { get: () => 240, set: () => undefined };
  const mocks: Record<string, unknown> = {
    react: {
      useCallback: (fn: unknown) => fn,
      useEffect: (effect: () => void) => effect(),
      useRef: (value: unknown) => ({ current: value }),
      useState: (value: unknown) => [value, () => undefined],
    },
    'react-native-reanimated': { useSharedValue: () => offset },
    'react-native': {
      Platform: { OS: 'ios' },
      Keyboard: {
        metrics: () => keyboard,
        addListener: (name: string, callback: (event: unknown) => void) => {
          events.set(name, callback);
          return { remove: () => events.delete(name) };
        },
      },
    },
  };
  const exports: Record<string, any> = {};
  const source = ts.transpileModule(
    readFileSync('src/screens/activeWorkout/useFocusedSetKeyboardLift.ts', 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  runInNewContext(source, {
    exports,
    require: (name: string) => {
      if (!(name in mocks)) throw new Error(`Unstubbed import: ${name}`);
      return mocks[name];
    },
    requestAnimationFrame: (callback: () => void) => frames.push(callback),
  });
  const hook = exports.useFocusedSetKeyboardLift(
    {
      current: { scrollToOffset: (request: (typeof scrolls)[number]) => scrolls.push(request) },
    },
    offset,
  );
  return {
    focus: () => {
      hook.onSetInputFocus((callback: (typeof measurements)[number]) =>
        measurements.push(callback),
      );
      frames.splice(0).forEach((frame) => frame());
    },
    hide: () => events.get('keyboardWillHide')!({ endCoordinates: keyboard }),
    measurements,
    scrolls,
  };
}

test('a native measure arriving after keyboard dismissal cannot lift the list again', () => {
  const lift = keyboardLift();
  lift.focus();
  lift.hide();
  lift.measurements[0]({ y: 650, height: 44 });
  expect(lift.scrolls).toEqual([]);
});

test('a measure for a previously focused set cannot override the current input', () => {
  const lift = keyboardLift();
  lift.focus();
  lift.focus();
  lift.measurements[0]({ y: 650, height: 44 });
  expect(lift.scrolls).toEqual([]);
  lift.measurements[1]({ y: 750, height: 44 });
  expect(lift.scrolls).toHaveLength(1);
  expect(lift.scrolls[0].offset).toBe(730);
});

test('a valid lift restores the pre-focus offset when the keyboard hides', () => {
  const lift = keyboardLift();
  lift.focus();
  lift.measurements[0]({ y: 650, height: 44 });
  lift.hide();
  expect(lift.scrolls).toEqual([
    { offset: 630, animated: true },
    { offset: 240, animated: true },
  ]);
});
