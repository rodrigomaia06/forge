import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { ForgeNumericRangeInput, ForgeText as Text, ForgeTextInput as TextInput } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { forgeMotion, forgeMotionDuration, useForgeReducedMotion } from '../../theme/motion';
import { errorHaptic } from './activeWorkoutFeedback';
import { CompletionCheck, SplitCompletionCheck } from './CompletionCheck';
import type { SetRowProps } from './activeWorkoutTypes';
import { measurementText, measurementUnit, trackingFieldLabel, trackingFields, updateMeasurement } from '../../domain/exercises/tracking';
import { hasNextSessionTarget, setTagPresentation } from '../../domain/workouts/setPresentation';

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
  const previous = set.previous || '—';
  const tag = setTagPresentation(set.tag);
  const rpe = measurementText(set, 'rpe');
  const hasNextTarget = hasNextSessionTarget(set);

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
    const required = trackingFields[trackingType];
    const missingWeight = required.some((kind) => kind !== 'reps' && !measurementText(set, kind).trim());
    const missingReps = required.includes('reps') && !measurementText(set, 'reps').trim();
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
    borderRadius: progress.interpolate({ inputRange: [0, 1], outputRange: [9, 8] }),
  });
  const reportInputFocus = (): void => {
    onInputFocus?.((onMeasured) => {
      setRowRef.current?.measureInWindow((_x, y, _width, height) => onMeasured({ y, height }));
    });
  };

  return (
    <View
      ref={setRowRef}
      style={[
        styles.setRow,
        set.completed && styles.setCompleted,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open details for set ${index + 1}`}
        accessibilityHint={setTargetMode === 'routine' ? 'Opens set type, comments, effort, and routine interval' : 'Opens set tags, comments, and next-time targets'}
        accessibilityActions={[{ name: 'delete', label: 'Delete set' }]}
        onPress={onOpenDetails}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') onDelete();
        }}
        style={styles.setNumberWrap}
      >
        <View testID={`live-set-number-chip-${index + 1}`} style={styles.setNumberChip}>
          <Text
            style={[
              styles.setNumber,
              tag && { color: tag.color, backgroundColor: `${tag.color}20` },
            ]}
          >
            {tag?.letter ?? index + 1}
          </Text>
          {hasNextTarget ? (
            <View accessibilityLabel={`Set ${index + 1} has a next session target`} style={styles.targetIndicator} />
          ) : null}
          {rpe ? (
            <Text accessibilityLabel={`Set ${index + 1} RPE ${rpe}`} style={styles.rpeIndicator}>{rpe}</Text>
          ) : null}
          {set.comment?.trim() ? (
            <View accessibilityLabel={`Set ${index + 1} has a comment`} style={styles.commentIndicator} />
          ) : null}
        </View>
      </Pressable>
      {showPrevious ? <Text style={styles.previous} numberOfLines={1}>{previous}</Text> : null}
      {trackingFields[trackingType].map((kind) => {
        const planned = plannedIntervalText(set, kind);
        const allowsRange = setTargetMode === 'routine' && (kind === 'reps' || kind === 'duration');
        // Prefer the raw legacy string so a decimal being typed ("9.5", "9,5")
        // is preserved as-is; formatting through the parsed number would drop a
        // trailing separator mid-entry. Fall back to the structured value only
        // when there is no legacy text (e.g. migrated, measurement-only data).
        const legacyRaw = kind === 'reps' ? set.reps : kind === 'weight' || kind === 'addedWeight' ? set.weight : '';
        const storedValue = allowsRange ? planned : legacyRaw && legacyRaw.length ? legacyRaw : measurementText(set, kind);
        const draftValue = routineRangeDrafts[kind];
        const value = allowsRange && draftValue !== undefined ? draftValue : storedValue;
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
          <React.Fragment key={kind}>
            {allowsRange ? (
              <ForgeNumericRangeInput
                accessibilityLabel={`${trackingFieldLabel(trackingType, kind)} for set ${index + 1}${planned ? `, routine interval ${planned}` : ''}`}
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
                  styles.inputFilled,
                  inputFocused && styles.inputFocused,
                  { color: inputTextColor },
                ]}
              />
            ) : (
              <AnimatedTextInput
              accessibilityLabel={`${trackingFieldLabel(trackingType, kind)} for set ${index + 1}${planned ? `, routine interval ${planned}` : ''}`}
              value={value}
              selection={{ start: value.length, end: value.length }}
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
                if (!allowsRange) return;
                setRoutineRangeDrafts((current) => {
                  const next = { ...current };
                  delete next[kind];
                  return next;
                });
              }}
              keyboardType={kind === 'duration' ? 'number-pad' : 'decimal-pad'}
              selectTextOnFocus={false}
              placeholder={planned || '—'}
              placeholderTextColor={theme.textDisabled}
              style={[
                styles.input,
                styles.inputColumn,
                styles.inputFilled,
                inputFocused && styles.inputFocused,
                { color: inputTextColor },
                invalidStyle(kind === 'reps' ? repsInvalidProgress : weightInvalidProgress),
              ]}
            />
            )}
          </React.Fragment>
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
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setCompleted: {},
  setNumberWrap: { position: 'relative', width: 46, height: 44, alignItems: 'center', justifyContent: 'center' },
  setNumberChip: { position: 'relative', width: 32, height: 32 },
  setNumber: {
    width: 32,
    height: 32,
    borderRadius: 9,
    textAlign: 'center',
    backgroundColor: dashboardTheme.surfaceMuted,
    color: dashboardTheme.ink,
    ...typeScale.controlLabel,
    lineHeight: 32,
  },
  previous: {
    flex: 1,
    color: dashboardTheme.ink,
    // Previous performance is a primary scanning value, not compact metadata,
    // so it reads a step larger than the body text elsewhere.
    ...typeScale.body,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  inputColumn: { width: 60 },
  firstInputWithoutPrevious: { marginLeft: 'auto' },
  input: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 8,
    ...typeScale.body,
    textAlign: 'center',
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
  checkPressable: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  commentIndicator: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: dashboardTheme.ink,
  },
  targetIndicator: {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: dashboardTheme.setTargetIndicator,
  },
  rpeIndicator: {
    position: 'absolute',
    bottom: 1,
    left: 3,
    color: dashboardTheme.ink,
    ...typeScale.caption,
  },
  });
};
