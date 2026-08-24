import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Icon } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { typography } from '../../theme/tokens';
import { errorHaptic } from './activeWorkoutFeedback';
import type { SetRowProps } from './activeWorkoutTypes';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export function SetRow({
  set,
  index,
  onChange,
  onToggle,
  onDelete,
  onInputTouchStart,
  onInputTouchMove,
  onInputTouchEnd,
}: SetRowProps) {
  const completedProgress = useRef(new Animated.Value(set.completed ? 1 : 0)).current;
  const weightInvalidProgress = useRef(new Animated.Value(0)).current;
  const repsInvalidProgress = useRef(new Animated.Value(0)).current;
  const invalidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previous = set.previous || '—';

  useEffect(
    () => () => {
      if (invalidTimerRef.current) clearTimeout(invalidTimerRef.current);
      weightInvalidProgress.stopAnimation();
      repsInvalidProgress.stopAnimation();
      completedProgress.stopAnimation();
    },
    [completedProgress, repsInvalidProgress, weightInvalidProgress],
  );

  useEffect(() => {
    Animated.timing(completedProgress, {
      toValue: set.completed ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [completedProgress, set.completed]);

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
      const missingWeight = !String(set.weight || '').trim();
      const missingReps = !String(set.reps || '').trim();
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
      outputRange: [dashboardTheme.divider, '#FF3B30'],
    }),
    borderWidth: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }),
    borderRadius: progress.interpolate({ inputRange: [0, 1], outputRange: [9, 8] }),
  });

  return (
    <View style={[styles.setRow, set.completed && styles.setCompleted]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Set ${index + 1} options`}
        accessibilityHint="Use the accessibility actions to delete this set"
        accessibilityActions={[{ name: 'delete', label: 'Delete set' }]}
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
      <AnimatedTextInput
        accessibilityLabel={`Weight for set ${index + 1}`}
        value={String(set.weight)}
        onChangeText={(weight: string) => updateField('weight', weight)}
        onTouchStart={onInputTouchStart}
        onTouchMove={onInputTouchMove}
        onTouchEnd={onInputTouchEnd}
        keyboardType="decimal-pad"
        placeholder={set.targetWeight || '—'}
        style={[styles.input, styles.inputColumn, invalidStyle(weightInvalidProgress)]}
      />
      <AnimatedTextInput
        accessibilityLabel={`Reps for set ${index + 1}`}
        value={String(set.reps)}
        onChangeText={(reps: string) => updateField('reps', reps)}
        onTouchStart={onInputTouchStart}
        onTouchMove={onInputTouchMove}
        onTouchEnd={onInputTouchEnd}
        keyboardType="number-pad"
        placeholder={set.targetReps || '—'}
        style={[styles.input, styles.inputColumn, invalidStyle(repsInvalidProgress)]}
      />
      <View style={styles.check}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: set.completed }}
          accessibilityLabel={
            set.completed ? `Set ${index + 1} completed` : `Complete set ${index + 1}`
          }
          onPress={handleToggle}
          style={styles.checkPressable}
        >
          <Animated.View
            style={[
              styles.checkVisual,
              set.completed && styles.checkActive,
              {
                transform: [
                  {
                    scale: completedProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.82, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Animated.View
              style={{
                opacity: completedProgress,
                transform: [
                  {
                    scale: completedProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
              }}
            >
              <Icon name="check" size={15} color={dashboardTheme.surface} />
            </Animated.View>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  setRow: {
    position: 'relative',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setCompleted: {},
  setNumberWrap: { width: 46, height: 44, alignItems: 'center', justifyContent: 'center' },
  setNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    textAlign: 'center',
    lineHeight: 30,
    backgroundColor: dashboardTheme.surfaceMuted,
    color: dashboardTheme.ink,
    fontFamily: typography.medium,
    fontSize: 12,
  },
  previous: {
    flex: 1,
    color: dashboardTheme.ink,
    fontFamily: typography.medium,
    fontSize: 13,
    textAlign: 'center',
  },
  inputColumn: { width: 52 },
  input: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: dashboardTheme.divider,
    borderRadius: 8,
    backgroundColor: dashboardTheme.surfaceMuted,
    color: dashboardTheme.ink,
    fontFamily: typography.medium,
    fontSize: 14,
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
  checkVisual: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: dashboardTheme.slate,
    borderRadius: 13,
  },
  checkActive: { backgroundColor: dashboardTheme.iconSport, borderColor: dashboardTheme.iconSport },
});
