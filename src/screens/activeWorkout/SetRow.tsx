import { useSetRowLayout } from './useSetRowLayout';
import { ForgePressable as Pressable, centeredPressFeedback } from '../../components/ui/ForgePressable';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { ForgeNumericRangeInput, ForgeText as Text, ForgeTextInput as TextInput } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { scaleUI } from '../../theme/scale';
import { forgeMotion, forgeMotionDuration, useForgeReducedMotion } from '../../theme/motion';
import { errorHaptic } from './activeWorkoutFeedback';
import { CompletionCheck, SplitCompletionCheck } from './CompletionCheck';
import type { SetRowProps } from './activeWorkoutTypes';
import {
  missingTrackingFields,
  formatDuration,
  parseDuration,
  measurementText, measurementUnit, trackingFieldLabel, trackingFields, updateMeasurement,
} from '../../domain/exercises/tracking';
import { SetNumberBadge, useSetNumberBadgeLayout } from './SetNumberBadge';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export function SetRow({
  set,
  index,
  onChange,
  onToggle,
  unilateral = false,
  leadSide = 'left',
  onSetSides,
  onDelete,
  onOpenDetails,
  onInputTouchStart,
  onInputTouchMove,
  onInputTouchEnd,
  onInputFocus,
  showCompletion = true,
  showPrevious = true,
  trackingType = 'weight-reps',
  setTargetMode = 'next-session',
}: SetRowProps) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const weightInvalidProgress = useRef(new Animated.Value(0)).current;
  const repsInvalidProgress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useForgeReducedMotion();
  const invalidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setRowRef = useRef<View>(null);
  const [routineRangeDrafts, setRoutineRangeDrafts] = useState<Partial<Record<import('../../types').SetMeasurementKind, string>>>({});
  const [focusedInputs, setFocusedInputs] = useState<Partial<Record<import('../../types').SetMeasurementKind, boolean>>>({});
  const { stacked, onLayout, probe } = useSetRowLayout(trackingFields[trackingType].length, showPrevious);
  const previous = set.previous || '—';
  const badgeLayout = useSetNumberBadgeLayout();

  useEffect(
    () => () => {
      if (invalidTimerRef.current) clearTimeout(invalidTimerRef.current);
      weightInvalidProgress.stopAnimation();
      repsInvalidProgress.stopAnimation();
    },
    [repsInvalidProgress, weightInvalidProgress],
  );

  useEffect(() => {
    setRoutineRangeDrafts({});
  }, [set.id]);

  const animateInvalidField = (field: 'weight' | 'reps', value: number, duration: number = forgeMotion.feedback): void => {
    Animated.timing(field === 'weight' ? weightInvalidProgress : repsInvalidProgress, {
      toValue: value,
      duration: forgeMotionDuration(reducedMotion, duration),
      useNativeDriver: false,
    }).start();
  };

  const updateField = (field: 'weight' | 'reps', value: string): void => {
    animateInvalidField(field, 0, forgeMotion.transition);
    onChange({ [field]: value });
  };

  const validateForCompletion = (): boolean => {
    const missing = missingTrackingFields(trackingType, set);
    const missingWeight =
      missing.some((kind) => kind !== 'reps') ||
      (routineRangeDrafts.duration !== undefined && !Number.isFinite(parseDuration(routineRangeDrafts.duration)));
    const missingReps = missing.includes('reps');
    if (missingWeight || missingReps) {
      animateInvalidField('weight', missingWeight ? 1 : 0);
      animateInvalidField('reps', missingReps ? 1 : 0);
      if (invalidTimerRef.current) clearTimeout(invalidTimerRef.current);
      invalidTimerRef.current = setTimeout(() => {
        animateInvalidField('weight', 0, forgeMotion.transition);
        animateInvalidField('reps', 0, forgeMotion.transition);
        invalidTimerRef.current = null;
      }, 1200);
      errorHaptic();
      return false;
    }
    return true;
  };

  const handleToggle = (): void => {
    if (!set.completed && !validateForCompletion()) return;
    onToggle();
  };

  // One tap advances the unilateral completion: none -> left -> both -> none.
  // Validation runs only while adding a side, mirroring the full-set rule.
  const handleUnilateralAdvance = (): void => {
    const sides = set.sideCompletion ?? { left: false, right: false };
    const both = sides.left && sides.right;
    const anyDone = sides.left || sides.right;
    // none -> lead side -> both -> none, so the favoured side is completed first.
    const next = both
      ? { left: false, right: false }
      : anyDone
        ? { left: true, right: true }
        : leadSide === 'right'
          ? { left: false, right: true }
          : { left: true, right: false };
    const adding = (next.left && !sides.left) || (next.right && !sides.right);
    if (adding && !validateForCompletion()) return;
    onSetSides?.(next);
  };
  const sidesDone = (set.sideCompletion?.left ? 1 : 0) + (set.sideCompletion?.right ? 1 : 0);
  const firstSideName = leadSide === 'right' ? 'right' : 'left';
  const secondSideName = leadSide === 'right' ? 'left' : 'right';
  const unilateralLabel =
    sidesDone >= 2
      ? `Set ${index + 1} completed`
      : sidesDone === 1
        ? `Complete ${secondSideName} side of set ${index + 1}`
        : `Complete ${firstSideName} side of set ${index + 1}`;

  const invalidStyle = (progress: Animated.Value) => ({
    borderColor: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.divider, theme.textDestructive],
    }),
    borderWidth: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }),
    borderRadius: progress.interpolate({ inputRange: [0, 1], outputRange: [scaleUI(9), scaleUI(8)] }),
  });
  const reportInputFocus = (): void => {
    onInputFocus?.((onMeasured) => {
      setRowRef.current?.measureInWindow((_x, y, _width, height) => onMeasured({ y, height }));
    });
  };

  return (
    <View
      ref={setRowRef}
      onLayout={onLayout}
      testID={`set-row-${index + 1}`}
      style={[
        styles.setRow,
        stacked && styles.stackedRow,
        set.completed && styles.setCompleted,
      ]}
    >
      {probe}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open details for set ${index + 1}`}
        accessibilityHint={setTargetMode === 'routine' ? 'Opens set type, comments, effort, and routine interval' : 'Opens set tags, comments, and next-time targets'}
        accessibilityActions={[{ name: 'delete', label: 'Delete set' }]}
        onPress={onOpenDetails}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') onDelete();
        }}
        style={[styles.setNumberWrap, { minHeight: Math.max(44, badgeLayout.height + 4) }]}
        pressFeedbackStyle={badgeLayout.feedback}
      >
        <SetNumberBadge set={set} index={index} testID={`live-set-number-chip-${index + 1}`} />
      </Pressable>
      {showPrevious ? (
        <Text style={[styles.previous, stacked && styles.stackedPrevious]}>
          {stacked ? `Previous: ${previous}` : previous}
        </Text>
      ) : null}
      {trackingFields[trackingType].map((kind) => {
        const planned = plannedIntervalText(set, kind);
        const allowsRange = setTargetMode === 'routine' && (kind === 'reps' || kind === 'duration' || kind === 'distance');
        // Prefer the raw legacy string so a decimal being typed ("9.5", "9,5")
        // is preserved as-is; formatting through the parsed number would drop a
        // trailing separator mid-entry. Fall back to the structured value only
        // when there is no legacy text (e.g. migrated, measurement-only data).
        const legacyRaw = kind === 'reps' ? set.reps : kind === 'weight' || kind === 'addedWeight' ? set.weight : '';
        const storedValue =
          kind === 'duration' && !allowsRange && measurementText(set, kind)
            ? formatDuration(Number(measurementText(set, kind)))
            : allowsRange ? planned : legacyRaw && legacyRaw.length ? legacyRaw : measurementText(set, kind);
        const draftValue = routineRangeDrafts[kind];
        const value = draftValue !== undefined ? draftValue : storedValue;
        // Every set field keeps its normal neutral box. A live empty field is
        // guidance rather than a recorded value, so only its text hierarchy
        // changes; completion remains exclusively with the check control.
        const quietValue = setTargetMode !== 'routine' && !value.trim();
        const inputFocused = focusedInputs[kind] === true;
        const inputTextColor = quietValue ? theme.textSecondary : theme.ink;
        const writeMeasurement = (text: string): void => {
          if (allowsRange) {
            const draft = numericRangeText(text);
            setRoutineRangeDrafts((current) => ({ ...current, [kind]: draft }));
            onChange({ plannedTargets: updateRoutineRangeTargets(set.plannedTargets, set.id, kind, draft) });
            return;
          }
          if (kind === 'duration') {
            text = text.replace(/[,.]/g, ':').replace(/[^0-9:]/g, '');
          }
          setRoutineRangeDrafts((current) => ({ ...current, [kind]: text }));
          onChange({
            // Legacy rows still read weight/reps when their structured entry
            // is absent. Use the incoming text—not the previous rendered
            // value—so deleting the final digit persists an actual empty
            // legacy field instead of resurrecting that digit on rerender.
            ...(kind === 'reps'
              ? { reps: text }
              : kind === 'weight' || kind === 'addedWeight'
                ? { weight: text }
                : {}),
            measurements: updateMeasurement(set, kind, text),
          });
        };
        return (
          <View key={kind} style={stacked ? styles.stackedField : undefined}>
            {stacked ? <Text style={styles.fieldLabel}>{trackingFieldLabel(trackingType, kind)}</Text> : null}
            {allowsRange ? (
              <ForgeNumericRangeInput
                accessibilityLabel={`${kind === 'duration' ? 'Sec' : trackingFieldLabel(trackingType, kind)} for set ${index + 1}${planned ? `, routine interval ${planned}` : ''}`}
                value={value}
                onChangeText={writeMeasurement}
                onTouchStart={onInputTouchStart}
                onTouchMove={onInputTouchMove}
                onTouchEnd={onInputTouchEnd}
                onFocus={() => {
                  setFocusedInputs((current) => ({ ...current, [kind]: true }));
                  reportInputFocus();
                }}
                onBlur={() => {
                  setFocusedInputs((current) => ({ ...current, [kind]: false }));
                  setRoutineRangeDrafts((current) => {
                    const next = { ...current };
                    delete next[kind];
                    return next;
                  });
                }}
                placeholder={planned || '—'}
                placeholderTextColor={theme.textDisabled}
                textAlign="center"
                textColor={inputTextColor}
                fontSize={typeScale.body.fontSize}
                style={[
                  styles.input,
                  styles.inputColumn,
                  stacked && styles.stackedInput,
                  styles.inputFilled,
                  inputFocused && styles.inputFocused,
                  { color: inputTextColor },
                ]}
              />
            ) : (
              <AnimatedTextInput
              accessibilityLabel={`${trackingFieldLabel(trackingType, kind)} for set ${index + 1}${planned ? `, routine interval ${planned}` : ''}`}
              value={value}
              lockCursorToEnd
              onChangeText={writeMeasurement}
              onTouchStart={onInputTouchStart}
              onTouchMove={onInputTouchMove}
              onTouchEnd={onInputTouchEnd}
              onFocus={() => {
                  setFocusedInputs((current) => ({ ...current, [kind]: true }));
                  reportInputFocus();
                }}
              onBlur={() => {
                setFocusedInputs((current) => ({ ...current, [kind]: false }));
                setRoutineRangeDrafts((current) => {
                    const next = { ...current };
                    delete next[kind];
                    return next;
                  });
              }}
              inputMode="decimal"
              keyboardType="decimal-pad"
              selectTextOnFocus={false}
              placeholder={planned || '—'}
              placeholderTextColor={theme.textDisabled}
              style={[
                styles.input,
                styles.inputColumn,
                stacked && styles.stackedInput,
                styles.inputFilled,
                inputFocused && styles.inputFocused,
                { color: inputTextColor },
                invalidStyle(kind === 'reps' ? repsInvalidProgress : weightInvalidProgress),
              ]}
            />
            )}
          </View>
        );
      })}
      <View style={styles.check}>
        {showCompletion ? (
          unilateral ? (
            <SplitCompletionCheck
              testID={`set-split-check-${index + 1}`}
              done={sidesDone}
              leadSide={leadSide}
              accessibilityLabel={unilateralLabel}
              onAdvance={handleUnilateralAdvance}
            />
          ) : (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: set.completed }}
              accessibilityLabel={
                set.completed ? `Set ${index + 1} completed` : `Complete set ${index + 1}`
              }
              onPress={handleToggle}
              style={styles.checkPressable}
              pressFeedbackStyle={styles.checkFeedback}
            >
              <CompletionCheck selected={set.completed} />
            </Pressable>
          )
        ) : null}
      </View>
    </View>
  );
}

function numericRangeText(value: string): string {
  let separatorFound = false;
  return Array.from(value).reduce((result, character) => {
    if (/\d/.test(character)) return `${result}${character}`;
    if ((character === ',' || character === '-' || character === '–' || character === '—') && !separatorFound) {
      separatorFound = true;
      return `${result}-`;
    }
    return result;
  }, '');
}

function updateRoutineRangeTargets(
  targets: import('../../types').WorkoutSet['plannedTargets'],
  setId: string,
  kind: import('../../types').SetMeasurementKind,
  text: string,
): NonNullable<import('../../types').WorkoutSet['plannedTargets']> {
  const values = numericRangeValues(text);
  const retained = (targets ?? []).filter((target) => target.kind !== kind);
  if (!values.length) return retained;
  return [
    ...retained,
    {
      id: `${setId}-planned-${kind}`,
      kind,
      unit: measurementUnit[kind],
      minValue: values[0],
      maxValue: values[1] ?? values[0],
    },
  ];
}

function numericRangeValues(value: string): number[] {
  return value
    .split('-')
    // `Number('')` is zero. Ignore empty sides so clearing a routine range
    // removes its planned target instead of silently replacing it with `0`.
    .filter((part) => part.trim().length > 0)
    .map((part) => Number(part.trim()))
    .filter(Number.isFinite);
}

function plannedIntervalText(set: import('../../types').WorkoutSet, kind: import('../../types').SetMeasurementKind): string {
  const target = set.plannedTargets?.find((item) => item.kind === kind);
  if (target?.minValue === undefined) return '';
  return target.maxValue !== undefined && target.maxValue !== target.minValue
    ? `${target.minValue}–${target.maxValue}`
    : String(target.minValue);
}

const createStyles = (theme: import('../../types').ForgeTheme) => {
  const dashboardTheme = theme;
  return StyleSheet.create({
  setRow: {
    position: 'relative',
    minHeight: scaleUI(48),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleUI(6),
  },
  stackedRow: { flexWrap: 'wrap', alignItems: 'flex-start', paddingVertical: scaleUI(8) },
  stackedField: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: scaleUI(12) },
  stackedPrevious: { flexBasis: '70%', textAlign: 'left' },
  fieldLabel: { flex: 1, ...typeScale.body, color: theme.textSecondary },
  stackedInput: { flex: 1, minWidth: 0, width: undefined, minHeight: 44, paddingVertical: scaleUI(8) },
  setCompleted: {},
  // Keep the touch target accessible while the badge grows with text scaling.
  setNumberWrap: { position: 'relative', minWidth: 46, flexShrink: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  checkFeedback: centeredPressFeedback(scaleUI(30), scaleUI(15)),
  previous: {
    flex: 1,
    color: dashboardTheme.ink,
    // Previous performance is a primary scanning value, not compact metadata,
    // so it reads a step larger than the body text elsewhere.
    ...typeScale.body,
    fontSize: scaleUI(16),
    lineHeight: scaleUI(22),
    textAlign: 'center',
  },
  inputColumn: { width: scaleUI(60) },
  firstInputWithoutPrevious: { marginLeft: 'auto' },
  input: {
    minHeight: scaleUI(36),
    borderWidth: 1,
    borderRadius: scaleUI(8),
    ...typeScale.body,
    textAlign: 'center',
    // Center the value within the cell on Android, where the default font
    // padding otherwise pushes it off-centre and inflates the row.
    textAlignVertical: 'center',
    includeFontPadding: false,
    paddingVertical: 0,
    paddingHorizontal: 3,
  },
  inputFilled: {
    backgroundColor: dashboardTheme.surfaceMuted,
    borderColor: dashboardTheme.divider,
  },
  inputFocused: {
    backgroundColor: dashboardTheme.surfaceMuted,
    borderColor: dashboardTheme.focus,
  },
  check: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  checkPressable: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  });
};
