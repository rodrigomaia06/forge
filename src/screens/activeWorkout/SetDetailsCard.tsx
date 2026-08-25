import React, { useCallback, useEffect, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { typography } from '../../theme/tokens';
import { styles as workoutSheetStyles } from './activeWorkoutStyles';
import { selectionHaptic } from './activeWorkoutFeedback';
import type { WorkoutSet, WorkoutSetChanges } from '../../types';

const TYPES = [
  { label: 'Warm Up', color: '#FF8A2A' },
  { label: 'Drop Set', color: '#9637DD' },
  { label: 'Failure', color: '#F0444D' },
  { label: 'Back-Off', color: '#2C78E8' },
];

interface SetDetailsCardProps {
  visible: boolean;
  set: WorkoutSet;
  index: number;
  onChange: (changes: WorkoutSetChanges) => void;
  onDelete: () => void;
  onDone: () => void;
}

export function SetDetailsCard({
  visible,
  set,
  index,
  onChange,
  onDelete,
  onDone,
}: SetDetailsCardProps) {
  const [infoOpen, setInfoOpen] = React.useState<'type' | 'target' | null>(null);

  const toggleInfo = (key: 'type' | 'target'): void => {
    setInfoOpen((current) => (current === key ? null : key));
  };

  const translateY = useSharedValue(420);
  const backdropOpacity = useSharedValue(0);
  const closing = useSharedValue(false);
  const dragStartOffset = useSharedValue(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finishClose = useCallback(() => onDoneRef.current(), []);
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
  }, [backdropOpacity, closing, translateY, visible]);

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
      <Animated.View style={[workoutSheetStyles.restTimerBackdrop, backdropAnimatedStyle]}>
        <Pressable
          testID="set-details-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Close set details"
          onPress={closeSheet}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardFrame}
        >
          <Animated.View
            onTouchStart={() => Keyboard.dismiss()}
            style={[workoutSheetStyles.restTimerSheet, styles.setDetailsSheet, sheetAnimatedStyle]}
            accessibilityLabel={`Details for set ${index + 1}`}
          >
            <GestureDetector gesture={sheetGesture}>
              <View style={styles.dragArea}>
                <View style={workoutSheetStyles.sheetHandle} />
              </View>
            </GestureDetector>
            <View
              onTouchStart={() => {
                setInfoOpen(null);
                Keyboard.dismiss();
              }}
              style={[workoutSheetStyles.restTimerHeader, styles.topBar]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete set ${index + 1}`}
                onPress={onDelete}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteText}>Delete set</Text>
              </Pressable>
              {set.weight || set.reps ? (
                <Text style={styles.title}>
                  {`${set.weight || ''}${set.weight ? ' kg' : ''}${set.weight && set.reps ? ' × ' : ''}${set.reps || ''}`}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Done"
                onPress={closeSheet}
                style={({ pressed }) => [
                  workoutSheetStyles.restCloseButton,
                  pressed && workoutSheetStyles.restClosePressed,
                ]}
              >
                <Icon name="close" size={20} color={dashboardTheme.slate} />
              </Pressable>
            </View>
            <View style={styles.sheetContent}>
              <View style={[styles.section, styles.typeSection]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.label}>TYPE</Text>
                  <InfoButton label="Type help" onPress={() => toggleInfo('type')} />
                </View>
                <InfoPopover
                  visible={infoOpen === 'type'}
                  text="Choose a type to describe this set."
                />
                {TYPES.map((tag) => {
                  const selected = set.tag === tag.label;
                  return (
                    <TypeOption
                      key={tag.label}
                      label={tag.label}
                      color={tag.color}
                      selected={selected}
                      onPress={() => {
                        setInfoOpen(null);
                        selectionHaptic();
                        onChange({ tag: selected ? '' : tag.label });
                      }}
                    />
                  );
                })}
              </View>
              <View style={styles.section}>
                <Text style={[styles.label, styles.commentLabel]}>COMMENT</Text>
                <View style={styles.commentField}>
                  <TextInput
                    accessibilityLabel={`Comment for set ${index + 1}`}
                    value={set.comment || ''}
                    onChangeText={(comment) => onChange({ comment })}
                    onFocus={() => setInfoOpen(null)}
                    onTouchStart={(event) => event.stopPropagation()}
                    maxLength={120}
                    placeholder="Add a comment..."
                    placeholderTextColor={dashboardTheme.muted}
                    style={styles.commentInput}
                  />
                  <Text style={styles.commentCount}>{`${(set.comment || '').length}/120`}</Text>
                </View>
              </View>
              <View style={[styles.section, styles.targetSection]}>
                <View style={[styles.sectionHeader, styles.targetHeader]}>
                  <Text style={styles.label}>NEXT-TIME TARGET</Text>
                  <InfoButton label="Next-time target help" onPress={() => toggleInfo('target')} />
                </View>
                <InfoPopover
                  visible={infoOpen === 'target'}
                  text="This target pre-fills the set next time. It does not change this set."
                />
                <View style={styles.targetCards}>
                  <TargetRow
                    label="Weight"
                    value={set.targetWeight || ''}
                    placeholder="—"
                    unit="kg"
                    keyboardType="decimal-pad"
                    accessibilityLabel={`Next-time weight target for set ${index + 1}`}
                    onChangeText={(targetWeight) => onChange({ targetWeight })}
                    onFocus={() => setInfoOpen(null)}
                  />
                  <TargetRow
                    label="Reps"
                    value={set.targetReps || ''}
                    placeholder="—"
                    unit="reps"
                    keyboardType="number-pad"
                    accessibilityLabel={`Next-time reps target for set ${index + 1}`}
                    onChangeText={(targetReps) => onChange({ targetReps })}
                    onFocus={() => setInfoOpen(null)}
                  />
                </View>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

function InfoButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.helpButton}
    >
      <Text style={styles.helpText}>?</Text>
    </Pressable>
  );
}

function TypeOption({
  label,
  color,
  selected,
  onPress,
}: {
  label: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: 180 });
  }, [progress, selected]);

  const selectedOverlayStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.65 + progress.value * 0.35 }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${selected ? 'Remove' : 'Select'} ${label} type`}
      onPress={onPress}
      style={styles.tagRow}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.tagSelectedOverlay, selectedOverlayStyle]}
      />
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.tagText}>{label}</Text>
      <Animated.View style={checkStyle}>
        <Icon name="check" size={15} color={dashboardTheme.marker} />
      </Animated.View>
    </Pressable>
  );
}

function InfoPopover({ visible, text }: { visible: boolean; text: string }) {
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={styles.infoPopover}>
      <Text style={styles.infoPopoverText}>{text}</Text>
    </View>
  );
}

function TargetRow({
  label,
  value,
  placeholder,
  unit,
  keyboardType,
  accessibilityLabel,
  onChangeText,
  onFocus,
}: {
  label: string;
  value: string;
  placeholder: string;
  unit: string;
  keyboardType: TextInputProps['keyboardType'];
  accessibilityLabel: string;
  onChangeText: (value: string) => void;
  onFocus: () => void;
}) {
  return (
    <View style={styles.targetCard}>
      <View style={styles.targetCardHeader}>
        <Text style={styles.targetLabel}>{label}</Text>
      </View>
      <View style={styles.targetValue}>
        <TextInput
          accessibilityLabel={accessibilityLabel}
          value={value}
          selection={{ start: value.length, end: value.length }}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onTouchStart={(event) => event.stopPropagation()}
          keyboardType={keyboardType}
          inputMode={keyboardType === 'decimal-pad' ? 'decimal' : 'numeric'}
          selectTextOnFocus={false}
          placeholder={placeholder}
          placeholderTextColor={dashboardTheme.ink}
          style={styles.targetInput}
        />
        <Text style={styles.targetUnit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardFrame: { flex: 1, justifyContent: 'flex-end' },
  sheetContent: { flexGrow: 0 },
  setDetailsSheet: {
    minHeight: 0,
    maxHeight: '100%',
    paddingBottom: 20,
  },
  dragArea: { minHeight: 8, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    minHeight: 40,
    marginHorizontal: 2,
    position: 'relative',
    transform: [{ translateY: -4 }],
  },
  deleteButton: {
    height: 36,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#FFF2F2',
  },
  deleteText: { color: '#F0444D', fontFamily: typography.semibold, fontSize: 13 },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    color: dashboardTheme.ink,
    fontFamily: typography.semibold,
    fontSize: 17,
    textAlign: 'center',
    zIndex: 1,
  },
  section: {
    position: 'relative',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: dashboardTheme.divider,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 7,
    marginRight: -14,
    transform: [{ translateX: -2 }],
  },
  typeSection: { position: 'relative' },
  targetHeader: { paddingBottom: 6, position: 'relative' },
  targetSection: { borderBottomWidth: 0 },
  label: {
    color: dashboardTheme.slate,
    fontFamily: typography.bold,
    fontSize: 13,
    letterSpacing: 0.3,
    transform: [{ translateX: -8 }],
  },
  commentLabel: { transform: [{ translateX: -10 }] },
  helpButton: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: dashboardTheme.slate,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpText: { color: dashboardTheme.slate, fontFamily: typography.bold, fontSize: 13 },
  infoPopover: {
    position: 'absolute',
    top: 30,
    right: 14,
    zIndex: 10,
    maxWidth: 230,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: 'rgba(29,37,45,0.88)',
    shadowColor: dashboardTheme.ink,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  infoPopoverText: {
    color: dashboardTheme.surface,
    fontFamily: typography.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  tagRow: {
    minHeight: 33,
    alignSelf: 'stretch',
    marginHorizontal: -14,
    paddingHorizontal: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tagSelectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    backgroundColor: 'rgba(77,123,103,0.15)',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  tagText: { flex: 1, color: dashboardTheme.ink, fontFamily: typography.medium, fontSize: 13 },
  commentInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 0,
    paddingVertical: 0,
    color: dashboardTheme.ink,
    fontFamily: typography.regular,
    fontSize: 13,
    textAlignVertical: 'center',
  },
  commentField: {
    height: 48,
    marginTop: 4,
    marginRight: -14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: dashboardTheme.divider,
    borderRadius: 10,
    backgroundColor: dashboardTheme.surface,
  },
  commentCount: {
    color: dashboardTheme.slate,
    fontFamily: typography.regular,
    fontSize: 11,
  },
  targetCards: {
    flexDirection: 'row',
    gap: 8,
    marginRight: -14,
  },
  targetCard: {
    flex: 1,
    height: 52,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: dashboardTheme.divider,
    borderRadius: 10,
    backgroundColor: dashboardTheme.surface,
  },
  targetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetLabel: {
    color: dashboardTheme.ink,
    fontFamily: typography.medium,
    fontSize: 13,
  },
  targetValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingLeft: 0,
    gap: 2,
  },
  targetInput: {
    width: 32,
    minWidth: 32,
    height: 27,
    paddingHorizontal: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: dashboardTheme.ink,
    fontFamily: typography.medium,
    fontSize: 20,
    textAlign: 'right',
    textAlignVertical: 'center',
    paddingVertical: 2,
  },
  targetUnit: {
    minWidth: 0,
    color: dashboardTheme.muted,
    fontFamily: typography.medium,
    fontSize: 13,
    lineHeight: 20,
  },
});
