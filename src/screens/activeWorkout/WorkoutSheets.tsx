import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Button, Icon } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { typography } from '../../theme/tokens';
import type { WorkoutExercise } from '../../types';

export function AddExerciseSheet({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Add exercise</Text>
          <TextInput
            autoFocus
            accessibilityLabel="Exercise name"
            placeholder="Exercise name"
            value={name}
            onChangeText={setName}
            style={styles.nameInput}
            returnKeyType="done"
            onSubmitEditing={() => name.trim() && onSubmit(name)}
          />
          <View style={styles.sheetActions}>
            <Button label="Cancel" variant="secondary" onPress={onClose} theme={dashboardTheme} />
            <Button
              label="Add exercise"
              disabled={!name.trim()}
              onPress={() => onSubmit(name)}
              theme={dashboardTheme}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ExerciseOptionsSheet({
  visible,
  exercise,
  onClose,
  onRemove,
}: {
  visible: boolean;
  exercise: WorkoutExercise;
  onClose: () => void;
  onRemove: () => void;
}) {
  const translateY = useSharedValue(420);
  const backdropOpacity = useSharedValue(0);
  const closing = useSharedValue(false);
  const dragStartOffset = useSharedValue(0);

  const finishClose = useCallback(() => onClose(), [onClose]);
  const closeSheet = useCallback(() => {
    if (closing.value) return;
    closing.value = true;
    translateY.value = withTiming(520, { duration: 200 }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
    backdropOpacity.value = withTiming(0, { duration: 160 });
  }, [backdropOpacity, closing, finishClose, translateY]);

  useEffect(() => {
    if (!visible) return undefined;
    closing.value = false;
    translateY.value = 420;
    backdropOpacity.value = 0;
    const frame = requestAnimationFrame(() => {
      translateY.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 });
      backdropOpacity.value = withTiming(1, { duration: 180 });
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, translateY, backdropOpacity]);

  const sheetGesture = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .failOffsetX([-24, 24])
    .onStart(() => {
      dragStartOffset.value = translateY.value;
    })
    .onUpdate((event) => {
      translateY.value = Math.max(0, dragStartOffset.value + event.translationY);
    })
    .onEnd((event) => {
      const projectedOffset = Math.max(
        0,
        dragStartOffset.value + event.translationY + event.velocityY * 0.12,
      );
      if (projectedOffset >= 260 || event.velocityY > 900) {
        closing.value = true;
        translateY.value = withTiming(520, { duration: 200 }, (finished) => {
          if (finished) runOnJS(finishClose)();
        });
        backdropOpacity.value = withTiming(0, { duration: 160 });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropAnimatedStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={closeSheet}>
      <Animated.View style={[styles.optionsBackdrop, backdropAnimatedStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close options"
          onPress={closeSheet}
          style={StyleSheet.absoluteFill}
        />
        <GestureDetector gesture={sheetGesture}>
          <Animated.View style={[styles.optionsSheet, sheetAnimatedStyle]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Options</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close options"
                onPress={closeSheet}
                style={({ pressed }) => [styles.sheetClose, pressed && styles.sheetClosePressed]}
              >
                <Icon name="close" size={24} color={dashboardTheme.slate} />
              </Pressable>
            </View>
            <View style={styles.optionList}>
              <OptionRow icon="measure" label="Measure by" onPress={closeSheet} showArrow />
              <OptionRow icon="note" label="Add note" onPress={closeSheet} />
              <OptionRow icon="history" label="Previous sessions" onPress={closeSheet} />
              <OptionRow icon="warm-up" label="Warm-up sets" onPress={closeSheet} />
              <OptionRow icon="info" label="Exercise info" onPress={closeSheet} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${exercise.name}`}
              onPress={onRemove}
              style={({ pressed }) => [
                styles.destructiveAction,
                pressed && styles.destructivePressed,
              ]}
            >
              <Icon name="trash" size={22} color="#FF3B30" />
              <Text style={styles.destructiveText}>Remove exercise</Text>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </Modal>
  );
}

function OptionRow({
  icon,
  label,
  onPress,
  showArrow = false,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
  showArrow?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
    >
      <Icon name={icon} size={23} color={dashboardTheme.ink} />
      <Text style={styles.optionLabel}>{label}</Text>
      {showArrow && <Icon name="arrow-forward" size={19} color={dashboardTheme.slate} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,25,28,0.22)' },
  optionsBackdrop: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(23,25,28,0.12)',
  },
  optionsSheet: {
    backgroundColor: dashboardTheme.surface,
    borderRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 22,
    paddingBottom: 24,
    gap: 0,
    width: '100%',
    maxWidth: 430,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: dashboardTheme.divider,
  },
  sheetTitle: {
    color: dashboardTheme.ink,
    fontFamily: typography.semibold,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
  },
  nameInput: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: dashboardTheme.divider,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: dashboardTheme.ink,
    fontFamily: typography.regular,
    fontSize: 16,
  },
  sheet: {
    backgroundColor: dashboardTheme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
  },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  sheetHeader: { height: 44, alignItems: 'center', justifyContent: 'center' },
  sheetClose: {
    position: 'absolute',
    right: 0,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: dashboardTheme.surfaceMuted,
  },
  sheetClosePressed: { transform: [{ scale: 0.92 }], opacity: 0.72 },
  optionList: {
    marginTop: 10,
  },
  optionRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    borderBottomWidth: 1,
    borderBottomColor: dashboardTheme.divider,
  },
  optionRowPressed: { backgroundColor: dashboardTheme.surfaceMuted, opacity: 0.8 },
  optionLabel: {
    flex: 1,
    color: dashboardTheme.ink,
    fontFamily: typography.regular,
    fontSize: 16,
  },
  destructiveAction: {
    minHeight: 65,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  destructivePressed: { backgroundColor: 'rgba(255,59,48,0.08)', opacity: 0.8 },
  destructiveText: {
    color: '#FF3B30',
    fontFamily: typography.semibold,
    fontSize: 16,
    fontWeight: '600',
  },
});
