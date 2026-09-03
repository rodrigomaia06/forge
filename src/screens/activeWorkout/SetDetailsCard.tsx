import React, { useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  type TextInputProps,
  type TextInput as NativeTextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  ForgeText as Text,
  ForgeTextInput as TextInput,
  HeaderAction,
  Icon,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeSheetHeader,
  pressedFeedback,
  pressedFeedbackSubtle,
} from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
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
  editable?: boolean;
}

export function SetDetailsCard({
  visible,
  set,
  index,
  onChange,
  onDelete,
  onDone,
  editable = true,
}: SetDetailsCardProps) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const [infoOpen, setInfoOpen] = React.useState<'type' | 'target' | null>(null);
  const [dismissTextKeyboardOnTap, setDismissTextKeyboardOnTap] = React.useState(true);

  const toggleInfo = (key: 'type' | 'target'): void => {
    selectionHaptic();
    setInfoOpen((current) => (current === key ? null : key));
  };

  return (
    <ForgeBottomSheet
      visible={visible}
      onClose={onDone}
      accessibilityLabel="Close set details"
      testID="set-details-sheet"
      style={styles.setDetailsSheet}
      dismissTextKeyboardOnTap={dismissTextKeyboardOnTap}
    >{(closeSheet) => <>
            <ForgeBottomSheetHandle />
            <View accessibilityLabel={`Details for set ${index + 1}`}>
            <View onTouchStart={() => setInfoOpen(null)} style={styles.topBar}>
              <ForgeSheetHeader
                title={
                  set.weight || set.reps
                    ? `${set.weight || ''}${set.weight ? ' kg' : ''}${set.weight && set.reps ? ' × ' : ''}${set.reps || ''}`
                    : `Set ${index + 1}`
                }
                onClose={closeSheet}
                closeAccessibilityLabel="Done"
                closePosition={editable ? 'left' : 'right'}
                trailing={
                  editable ? (
                    <HeaderAction
                      accessibilityLabel={`Delete set ${index + 1}`}
                      icon="trash"
                      iconOnly
                      tone="destructive"
                      onPress={onDelete}
                    />
                  ) : undefined
                }
              />
            </View>
            <View style={styles.sheetContent}>
              {editable ? (
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
                        disabled={!editable}
                      />
                    );
                  })}
                </View>
              ) : (
                <RecordedDetail label="TYPE" value={set.tag || 'No type recorded'} />
              )}
              {editable ? (
                <View style={styles.section}>
                  <Text style={[styles.label, styles.commentLabel]}>COMMENT</Text>
                  <View style={styles.commentField}>
                    <TextInput
                      accessibilityLabel={`Comment for set ${index + 1}`}
                      value={set.comment || ''}
                      onChangeText={(comment) => onChange({ comment })}
                      editable={editable}
                      onFocus={() => {
                        setDismissTextKeyboardOnTap(true);
                        setInfoOpen(null);
                      }}
                      onTouchStart={(event) => event.stopPropagation()}
                      maxLength={120}
                      placeholder="Add a comment..."
                      placeholderTextColor={theme.muted}
                      style={styles.commentInput}
                    />
                    <Text style={styles.commentCount}>{`${(set.comment || '').length}/120`}</Text>
                  </View>
                </View>
              ) : (
                <RecordedDetail label="COMMENT" value={set.comment || 'No comment recorded'} />
              )}
              {editable ? (
                <View style={[styles.section, styles.targetSection]}>
                  <View style={[styles.sectionHeader, styles.targetHeader]}>
                    <Text style={styles.label}>NEXT-TIME TARGET</Text>
                    <InfoButton
                      label="Next-time target help"
                      onPress={() => toggleInfo('target')}
                    />
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
                      onFocus={() => {
                        setDismissTextKeyboardOnTap(false);
                        setInfoOpen(null);
                      }}
                      editable={editable}
                    />
                    <TargetRow
                      label="Reps"
                      value={set.targetReps || ''}
                      placeholder="—"
                      unit="reps"
                      keyboardType="number-pad"
                      accessibilityLabel={`Next-time reps target for set ${index + 1}`}
                      onChangeText={(targetReps) => onChange({ targetReps })}
                      onFocus={() => {
                        setDismissTextKeyboardOnTap(false);
                        setInfoOpen(null);
                      }}
                      editable={editable}
                    />
                  </View>
                </View>
              ) : (
                <RecordedTarget set={set} />
              )}
            </View>
            </View>
    </>}</ForgeBottomSheet>
  );
}

function InfoButton({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={11}
      onPress={onPress}
      style={({ pressed }) => [styles.helpButton, pressed && pressedFeedback]}
    >
      <Text style={styles.helpText}>?</Text>
    </Pressable>
  );
}

function RecordedDetail({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.recordedSection}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.recordedValue}>{value}</Text>
    </View>
  );
}

function RecordedTarget({ set }: { set: WorkoutSet }) {
  const styles = useThemedStyles(createStyles);
  const target = [
    set.targetWeight && `${set.targetWeight} kg`,
    set.targetReps && `${set.targetReps} reps`,
  ]
    .filter(Boolean)
    .join(' · ');
  return <RecordedDetail label="NEXT-TIME TARGET" value={target || 'No target recorded'} />;
}

function TypeOption({
  label,
  color,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  color: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
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
      disabled={disabled}
      style={({ pressed }) => [styles.tagRow, pressed && pressedFeedbackSubtle]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.tagSelectedOverlay, selectedOverlayStyle]}
      />
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.tagText}>{label}</Text>
      <Animated.View style={checkStyle}>
        <Icon name="check" size={15} color={theme.marker} />
      </Animated.View>
    </Pressable>
  );
}

function InfoPopover({ visible, text }: { visible: boolean; text: string }) {
  const styles = useThemedStyles(createStyles);
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
  editable = true,
}: {
  label: string;
  value: string;
  placeholder: string;
  unit: string;
  keyboardType: TextInputProps['keyboardType'];
  accessibilityLabel: string;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  editable?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  const inputRef = useRef<NativeTextInput>(null);
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    requestAnimationFrame(() => inputRef.current?.setSelection(value.length, value.length));
  }, [value.length]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={focusInput}
      disabled={!editable}
      style={({ pressed }) => [styles.targetCard, pressed && pressedFeedbackSubtle]}
    >
      <View style={styles.targetCardHeader}>
        <Text style={styles.targetLabel}>{label}</Text>
      </View>
      <View style={styles.targetValue}>
        <TextInput
          ref={inputRef}
          accessibilityLabel={accessibilityLabel}
          value={value}
          selection={{ start: value.length, end: value.length }}
          onChangeText={onChangeText}
          editable={editable}
          onFocus={() => {
            onFocus();
            requestAnimationFrame(() => inputRef.current?.setSelection(value.length, value.length));
          }}
          onTouchStart={(event) => event.stopPropagation()}
          keyboardType={keyboardType}
          inputMode={keyboardType === 'decimal-pad' ? 'decimal' : 'numeric'}
          selectTextOnFocus={false}
          placeholder={placeholder}
          placeholderTextColor={theme.ink}
          style={styles.targetInput}
        />
        <Text style={styles.targetUnit}>{unit}</Text>
      </View>
    </Pressable>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) => {
  const dashboardTheme = theme;
  return StyleSheet.create({
  sheetContent: { flexGrow: 0 },
  setDetailsSheet: {
    minHeight: 0,
    maxHeight: '100%',
    paddingBottom: 20,
  },
  topBar: {
    minHeight: 40,
    marginHorizontal: 2,
    position: 'relative',
    transform: [{ translateY: -4 }],
  },
  setNumberBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: dashboardTheme.surfaceMuted,
  },
  setNumberBadgeText: { color: dashboardTheme.ink, ...typeScale.cardTitle },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    color: dashboardTheme.ink,
    ...typeScale.sectionTitle,
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
  recordedSection: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: dashboardTheme.divider,
  },
  recordedValue: { color: dashboardTheme.ink, ...typeScale.body },
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
  label: { color: dashboardTheme.slate, ...typeScale.label, transform: [{ translateX: -8 }] },
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
  helpText: { color: dashboardTheme.slate, ...typeScale.label },
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
  infoPopoverText: { color: dashboardTheme.surface, ...typeScale.caption },
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
    ...StyleSheet.absoluteFill,
    borderRadius: 10,
    backgroundColor: 'rgba(77,123,103,0.15)',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  tagText: { flex: 1, color: dashboardTheme.ink, ...typeScale.label },
  commentInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 0,
    paddingVertical: 0,
    color: dashboardTheme.ink,
    ...typeScale.label,
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
  commentCount: { color: dashboardTheme.slate, ...typeScale.caption },
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
  targetLabel: { color: dashboardTheme.ink, ...typeScale.label },
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
    ...typeScale.sectionTitle,
    textAlign: 'right',
    textAlignVertical: 'center',
    paddingVertical: 2,
  },
  targetUnit: {
    minWidth: 0,
    color: dashboardTheme.muted,
    ...typeScale.label,
  },
  });
};
