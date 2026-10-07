import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as tracking from '../../src/domain/exercises/tracking';
import * as changes from '../../src/domain/exercises/trackingChanges';
import type { WorkoutExercise } from '../../src/types';

// Exercise the callback handoff with native views stubbed; this does not emulate UIKit.
function choicesHarness(onSelect: (...args: any[]) => any) {
  const slots: any[] = [];
  let cursor = 0;
  let closed = 0;
  let confirmation: any = null;
  let effects: (() => void)[] = [];
  const onConfirmationChange = (value: any) => {
    confirmation = value;
  };
  const react = {
    createElement: (type: any, props: any, ...children: any[]) => ({
      type,
      props: { ...props, children },
    }),
    useState: (initial: any) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (value: any) => {
          slots[index] = value;
        },
      ];
    },
    useRef: (initial: any) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect: (effect: () => void) => {
      effects.push(effect);
    },
  };
  const mocks: Record<string, any> = {
    react,
    'react-native': { View: 'View' },
    '../../theme/scale': { scaleUI: (value: number) => value },
    '../../theme/tokens': { spacing: { screen: 20 }, typeScale: { supporting: {} } },
    '../../theme/ThemeProvider': { useForgeTheme: () => ({ textDestructive: '#000000' }) },
    '../../components/ui': {
      Button: 'Button',
      ForgeSingleSelectList: 'Choices',
      ForgeCard: 'Card',
      ForgeSheetScrollView: 'Scroll',
      ForgeText: 'Text',
    },
    '../../domain/exercises/tracking': tracking,
    '../../domain/exercises/trackingChanges': changes,
  };
  const exports: any = {};
  const source = ts.transpileModule(
    readFileSync('src/screens/activeWorkout/TrackingChoices.tsx', 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    },
  ).outputText;
  runInNewContext(source, {
    exports,
    require: (name: string) => {
      if (!(name in mocks)) throw new Error(`Unstubbed import: ${name}`);
      return mocks[name];
    },
  });
  const exercise: WorkoutExercise = {
    id: 'block',
    name: 'Pull-Up',
    trackingType: 'weighted-bodyweight',
    trackingOverride: 'weighted-bodyweight-duration',
    sets: [{ id: 'set', weight: '15', reps: '', completed: false }],
  };
  return {
    render: () => {
      cursor = 0;
      effects = [];
      const node = exports.TrackingChoices({
        onConfirmationChange,
        exercise,
        onSelect,
        resolveSelection: true,
        onApplied: () => {
          closed++;
        },
      });
      effects.forEach((effect) => effect());
      return node;
    },
    confirmation: () => confirmation,
    closed: () => closed,
    exercise,
  };
}
function find(node: any, type: string, label?: string): any {
  if (!node || typeof node !== 'object') return undefined;
  if (
    node.type === type &&
    (!label || node.props.accessibilityLabel === label || node.props.label === label)
  )
    return node;
  for (const child of (node.props?.children ?? []).flat()) {
    const found = find(child, type, label);
    if (found) return found;
  }
}
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test('a fresher confirmation result stays open; only a committed change dismisses', async () => {
  let resolve!: (result: changes.TrackingChangeResult) => void;
  const calls: any[][] = [];
  const harness = choicesHarness((...args) => {
    calls.push(args);
    return new Promise((done) => {
      resolve = done;
    });
  });
  find(harness.render(), 'Choices').props.onSelect('weighted-bodyweight');
  find(harness.render(), 'Choices').props.onSelect('weighted-bodyweight');
  expect(calls).toEqual([['weighted-bodyweight', false]]);
  expect(harness.closed()).toBe(0);
  resolve({
    status: 'confirmation',
    exercise: {
      ...harness.exercise,
      sets: [
        {
          ...harness.exercise.sets[0],
          measurements: [{ id: 'time', kind: 'duration', unit: 'sec', value: 45 }],
        },
      ],
    },
  });
  await settle();
  harness.render();
  const confirm = harness.confirmation();
  expect(confirm.mode).toBe('weighted-bodyweight');
  expect(harness.closed()).toBe(0);
  confirm.onConfirm();
  expect(calls).toHaveLength(2);
  expect(calls[1]).toEqual(['weighted-bodyweight', true]);
  expect(harness.closed()).toBe(0);
  resolve({ status: 'applied', blockId: 'block', mode: 'weighted-bodyweight' });
  await settle();
  expect(harness.closed()).toBe(1);
});

test('failed or missing applications retain the sheet with an inline error', async () => {
  for (const status of ['missing', 'failed'] as const) {
    const harness = choicesHarness(() => Promise.resolve({ status }));
    find(harness.render(), 'Choices').props.onSelect('weighted-bodyweight');
    await settle();
    expect(harness.closed()).toBe(0);
    const error = find(harness.render(), 'Text');
    expect(error.props.accessibilityRole).toBe('alert');
    expect(error.props.children[0]).toContain(status === 'missing' ? 'no longer' : 'Try again');
  }
});

test('a current mode returned by the live resolver leaves the sheet open', async () => {
  const harness = choicesHarness(() =>
    Promise.resolve({ status: 'unchanged', blockId: 'block', mode: 'weighted-bodyweight' }),
  );
  find(harness.render(), 'Choices').props.onSelect('weighted-bodyweight');
  await settle();
  expect(harness.closed()).toBe(0);
  expect(find(harness.render(), 'Text')).toBeUndefined();
});

test('live selection requires an acknowledgement for the requested mode before dismissal', async () => {
  for (const result of [
    undefined,
    { status: 'applied', blockId: 'block', mode: 'duration' },
    { status: 'applied', blockId: 'other', mode: 'weighted-bodyweight' },
  ]) {
    const harness = choicesHarness(() => Promise.resolve(result));
    find(harness.render(), 'Choices').props.onSelect('weighted-bodyweight');
    await settle();
    expect(harness.closed()).toBe(0);
    expect(find(harness.render(), 'Text').props.children[0]).toContain('Try again');
  }
});

test('centered confirmation cancellation keeps the current block untouched', async () => {
  const calls: any[][] = [];
  const harness = choicesHarness((...args) => {
    calls.push(args);
    return Promise.resolve({ status: 'confirmation', exercise: harness.exercise });
  });
  find(harness.render(), 'Choices').props.onSelect('weighted-bodyweight');
  await settle();
  harness.render();
  harness.confirmation().onCancel();
  harness.render();
  expect(harness.confirmation()).toBeNull();
  expect(calls).toEqual([['weighted-bodyweight', false]]);
  expect(harness.closed()).toBe(0);
});

test('a failed discard retains the centered warning and can retry; repeated submits are ignored', async () => {
  let complete!: (result: changes.TrackingChangeResult) => void;
  const calls: any[][] = [];
  const harness = choicesHarness((...args) => {
    calls.push(args);
    if (!args[1]) return Promise.resolve({ status: 'confirmation', exercise: harness.exercise });
    return new Promise((resolve) => {
      complete = resolve;
    });
  });
  find(harness.render(), 'Choices').props.onSelect('weighted-bodyweight');
  await settle();
  harness.render();
  const confirmation = harness.confirmation();
  confirmation.onConfirm();
  confirmation.onConfirm();
  confirmation.onCancel();
  harness.render();
  expect(harness.confirmation().busy).toBe(true);
  expect(calls).toHaveLength(2);
  complete({ status: 'failed' });
  await settle();
  harness.render();
  expect(harness.confirmation().error).toContain('Try again');
  expect(harness.closed()).toBe(0);
  harness.confirmation().onConfirm();
  complete({ status: 'applied', blockId: 'block', mode: 'weighted-bodyweight' });
  await settle();
  harness.render();
  expect(harness.closed()).toBe(1);
  expect(harness.confirmation()).toBeNull();
});
