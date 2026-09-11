import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { ForgeText as Text, ForgeTextInput as TextInput } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { errorHaptic } from './activeWorkoutFeedback';
import { CompletionCheck } from './CompletionCheck';
import type { SetRowProps } from './activeWorkoutTypes';
import { measurementText, trackingFieldLabel, trackingFields, updateMeasurement } from '../../domain/exercises/tracking';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export function SetRow({
  set,
  index,
  onChange,
  onToggle,
  onDelete,
  onOpenDetails,
  onInputTouchStart,
  onInputTouchMove,
  onInputTouchEnd,
  onInputFocus,
  showCompletion = true,
  trackingType = 'weight-reps',
}: SetRowProps) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const weightInvalidProgress = useRef(new Animated.Value(0)).current;
  const repsInvalidProgress = useRef(new Animated.Value(0)).current;
  const invalidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setRowRef = useRef<View>(null);
  const previous = set.previous || '—';

  useEffect(
    () => () => {
      if (invalidTimerRef.current) clearTimeout(invalidTimerRef.current);
      weightInvalidProgress.stopAnimation();
      repsInvalidProgress.stopAnimation();
    },
    [repsInvalidProgress, weightInvalidProgress],
  );

  const animateInvalidField = (field: 'weight' | 'reps', value: number, duration = 150): void => {
    Animated.timing(field === 'weight' ? weightInvalidProgress : repsInvalidProgress, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start();
  };

  const updateField = (field: 'weight' | 'reps', value: string): void => {
    animateInvalidField(field, 0, 300);
    onChange({ [field]: value });
  };

  const handleToggle = (): void => {
    if (!set.completed) {
      const required = trackingFields[trackingType];
      const missingWeight = required.some((kind) => kind !== 'reps' && !measurementText(set, kind).trim());
      const missingReps = required.includes('reps') && !measurementText(set, 'reps').trim();
      if (missingWeight || missingReps) {
        animateInvalidField('weight', missingWeight ? 1 : 0);
        animateInvalidField('reps', missingReps ? 1 : 0);
        if (invalidTimerRef.current) clearTimeout(invalidTimerRef.current);
        invalidTimerRef.current = setTimeout(() => {
          animateInvalidField('weight', 0, 300);
          animateInvalidField('reps', 0, 300);
          invalidTimerRef.current = null;
        }, 1200);
        errorHaptic();
        return;
      }
    }
    onToggle();
  };

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
        set.comment && styles.setRowWithComment,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open details for set ${index + 1}`}
        accessibilityHint="Opens set tags, comments, and next-time targets"
        accessibilityActions={[{ name: 'delete', label: 'Delete set' }]}
        onPress={onOpenDetails}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') onDelete();
        }}
        style={styles.setNumberWrap}
      >
        <Text style={styles.setNumber}>{index + 1}</Text>
      </Pressable>
      <Text style={styles.previous} numberOfLines={1}>
        {previous}
      </Text>
      {trackingFields[trackingType].map((kind) => {
        const value = measurementText(set, kind);
        const legacy = kind === 'reps' ? { reps: value } : kind === 'weight' || kind === 'addedWeight' ? { weight: value } : {};
        return <AnimatedTextInput key={kind} accessibilityLabel={`${trackingFieldLabel(trackingType, kind)} for set ${index + 1}`} value={value} selection={{ start: value.length, end: value.length }} onChangeText={(text: string) => onChange({ ...legacy, measurements: updateMeasurement(set, kind, text) })} onTouchStart={onInputTouchStart} onTouchMove={onInputTouchMove} onTouchEnd={onInputTouchEnd} onFocus={reportInputFocus} keyboardType={kind === 'reps' || kind === 'duration' ? 'number-pad' : 'decimal-pad'} selectTextOnFocus={false} placeholder="—" style={[styles.input, styles.inputColumn, { borderColor: theme.divider }, invalidStyle(kind === 'reps' ? repsInvalidProgress : weightInvalidProgress)]} />;
      })}
      <View style={styles.check}>
        {showCompletion ? (
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
        ) : null}
      </View>
      {set.comment ? (
        <Text style={styles.comment} numberOfLines={2}>
          {set.comment}
        </Text>
      ) : null}
    </View>
  );
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
  setRowWithComment: { minHeight: 66 },
  setNumberWrap: { width: 46, height: 44, alignItems: 'center', justifyContent: 'center' },
  setNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    textAlign: 'center',
    backgroundColor: dashboardTheme.surfaceMuted,
    color: dashboardTheme.ink,
    ...typeScale.caption,
    lineHeight: 30,
  },
  previous: {
    flex: 1,
    color: dashboardTheme.ink,
    ...typeScale.label,
    textAlign: 'center',
  },
  inputColumn: { width: 60 },
  input: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: dashboardTheme.surfaceMuted,
    color: dashboardTheme.ink,
    ...typeScale.supporting,
    textAlign: 'center',
    paddingHorizontal: 3,
  },
  check: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  checkPressable: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  comment: {
    position: 'absolute',
    right: 0,
    bottom: 3,
    left: 52,
    color: dashboardTheme.slate,
    ...typeScale.caption,
  },
  });
};
