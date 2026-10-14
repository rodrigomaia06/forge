import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function renderRow(props: Record<string, unknown>) {
  const theme = { ink: '#111', divider: '#ddd', surfaceMuted: '#eee' };
  const element = (type: unknown, props: any, ...children: any[]) => ({
    type,
    props: props ?? {},
    children: children.flat().filter(Boolean),
  });
  const mocks: Record<string, any> = {
    react: { createElement: element },
    'react-native': {
      View: 'View',
      StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
    },
    '../../components/ui/ForgePressable': { ForgePressable: 'Pressable' },
    '../../components/ui': { ForgeText: 'Text' },
    '../../domain/exercises/tracking': {
      measurementDisplay: (set: any, kind: string) => set[kind] ?? '',
      measurementText: (set: any, kind: string) => set[kind] ?? '',
      trackingFieldLabel: (_tracking: string, kind: string) => kind,
      trackingFields: { 'weight-reps': ['weight', 'reps'], reps: ['reps'] },
    },
    './SetNumberBadge': {
      SetNumberBadge: 'Badge',
      useSetNumberBadgeLayout: (effort: boolean) => ({ height: effort ? 48 : 32, feedback: {} }),
    },
    '../../theme/ThemeProvider': { useForgeTheme: () => theme },
    '../../theme/useThemedStyles': { useThemedStyles: (factory: any) => factory(theme) },
    '../../theme/tokens': { typeScale: {} },
    '../../theme/scale': { scaleUI: (value: number) => value },
    './CompletionCheck': { CompletionCheck: 'Completion' },
    './activeWorkoutFeedback': { selectionHaptic: () => undefined },
  };
  const exports: any = {};
  const source = ts.transpileModule(
    readFileSync('src/screens/activeWorkout/HistorySetRow.tsx', 'utf8'),
    {
      compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS },
    },
  ).outputText;
  runInNewContext(source, {
    exports,
    require: (name: string) => {
      if (!mocks[name]) throw new Error(`Unmocked import ${name}`);
      return mocks[name];
    },
  });
  return exports.HistorySetRow({
    index: 0,
    trackingType: 'weight-reps',
    onOpenDetails: () => undefined,
    ...props,
  });
}

function collect(tree: any, type: string): any[] {
  return [
    ...(tree.type === type ? [tree] : []),
    ...tree.children.flatMap((child: any) =>
      typeof child === 'object' ? collect(child, type) : [],
    ),
  ];
}

const set = { id: 'one', weight: '25', reps: '8', rpe: '9', comment: 'Keep form', completed: true };

test('previous sessions and routine previews share left-hand properties and boxed values without completion', () => {
  for (const compact of [true, false]) {
    let inspections = 0;
    const row = renderRow({
      set,
      compact,
      showCompletion: false,
      onOpenDetails: () => (inspections += 1),
    });
    expect(row.children[0].type).toBe('Pressable');
    expect(collect(row, 'Completion')).toHaveLength(0);
    const badge = collect(row, 'Badge')[0];
    expect(badge.props.set).toBe(set);
    expect(badge.props.showEffort).toBeUndefined();
    const cells = collect(row, 'View').filter(
      (node) =>
        node.props.accessibilityLabel === 'weight' || node.props.accessibilityLabel === 'reps',
    );
    expect(cells.map((node) => node.children[0].children[0])).toEqual(['25', '8']);
    expect(cells.every((node) => node.props.style[0].borderWidth === 1)).toBe(true);
    row.children[0].props.onPress();
    expect(inspections).toBe(1);
    expect(collect(row, 'Text').some((node) => node.children.includes('Keep form'))).toBe(false);
  }
});

test('compact defaults omit checks while recorded history keeps completion and Previous', () => {
  expect(collect(renderRow({ set, compact: true }), 'Completion')).toHaveLength(0);
  const history = renderRow({ set: { ...set, previous: '20 × 8' }, showPrevious: true });
  expect(collect(history, 'Completion')[0].props.selected).toBe(true);
  expect(collect(history, 'Text').some((node) => node.children.includes('20 × 8'))).toBe(true);
});

test('recorded measurements take precedence and routine intervals remain available without recordings', () => {
  const row = renderRow({
    set: {
      ...set,
      reps: '',
      plannedTargets: [
        { kind: 'weight', minValue: 15, maxValue: 20 },
        { kind: 'reps', minValue: 8, maxValue: 12 },
      ],
    },
    compact: true,
  });
  const text = collect(row, 'Text').flatMap((node) => node.children);
  expect(text).toContain('25');
  expect(text).toContain('8–12');
  expect(text).not.toContain('15–20');
});
