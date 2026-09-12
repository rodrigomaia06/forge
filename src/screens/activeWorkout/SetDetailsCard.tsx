import React, { useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInput as NativeTextInput,
  type TextInputProps,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeCard,
  ForgeSheetHeader,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  HeaderAction,
  pressedFeedbackSubtle,
} from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { SetMeasurementKind, TrackingType, WorkoutSet, WorkoutSetChanges } from '../../types';
import { selectionHaptic } from './activeWorkoutFeedback';
import { measurementText, measurementUnit, trackingFieldLabel, trackingFields, updateMeasurement } from '../../domain/exercises/tracking';

const SET_TYPES = [
  { label: 'Warm Up', color: '#FF8A2A' },
  { label: 'Drop Set', color: '#9637DD' },
  { label: 'Failure', color: '#F0444D' },
  { label: 'Back-Off', color: '#2C78E8' },
] as const;
const RPE_OPTIONS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6] as const;

interface SetDetailsCardProps {
  visible: boolean;
  set: WorkoutSet;
  index: number;
  onChange: (changes: WorkoutSetChanges) => void;
  onDelete: () => void;
  onDone: () => void;
  editable?: boolean;
  trackingType?: TrackingType;
}

/** Detail editor shared by active-workout sets and read-only history sets. */
export function SetDetailsCard({
  visible,
  set,
  index,
  onChange,
  onDelete,
  onDone,
  editable = true,
  trackingType = 'weight-reps',
}: SetDetailsCardProps) {
  const styles = useThemedStyles(createStyles);
  const [dismissTextKeyboardOnTap, setDismissTextKeyboardOnTap] = React.useState(true);
  const setLabel = `Set ${index + 1}`;

  return (
    <ForgeBottomSheet
      visible={visible}
      onClose={onDone}
      accessibilityLabel="Close set details"
      testID="set-details-sheet"
      style={styles.setDetailsSheet}
      dismissTextKeyboardOnTap={dismissTextKeyboardOnTap}
    >
      {(closeSheet) => (
        <>
          <ForgeBottomSheetHandle />
          <View accessibilityLabel={`Details for ${setLabel}`} style={styles.sheetBody}>
            <ForgeSheetHeader
              title={setLabel}
              onClose={closeSheet}
              closeAccessibilityLabel={editable ? `Close ${setLabel}` : `Close ${setLabel} details`}
              closePosition={editable ? 'left' : 'right'}
              trailing={
                editable ? (
                  <HeaderAction
                    accessibilityLabel={`Delete ${setLabel}`}
                    icon="trash"
                    iconOnly
                    tone="destructive"
                    onPress={onDelete}
                  />
                ) : undefined
              }
            />
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <SetTypeSection
                value={set.tag || ''}
                editable={editable}
                onChange={(tag) => {
                  selectionHaptic();
                  onChange({ tag });
                }}
              />
              <CommentSection
                value={set.comment || ''}
                editable={editable}
                setLabel={setLabel}
                onChange={(comment) => onChange({ comment })}
                onTextFocus={() => setDismissTextKeyboardOnTap(true)}
              />
              <EffortSection
                set={set}
                editable={editable}
                onChange={onChange}
              />
              <TargetsSection
                set={set}
                trackingType={trackingType}
                editable={editable}
                setLabel={setLabel}
                onChange={onChange}
                onNumberFocus={() => setDismissTextKeyboardOnTap(false)}
              />
            </ScrollView>
          </View>
        </>
      )}
    </ForgeBottomSheet>
  );
}

function EffortSection({
  set,
  editable,
  onChange,
}: {
  set: WorkoutSet;
  editable: boolean;
  onChange: (changes: WorkoutSetChanges) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  const recorded = measurementText(set, 'rpe');
  const selected = Number(recorded);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>EFFORT (RPE)</Text>
      {editable ? (
        <ForgeCard variant="outlined" style={styles.effortCard}>
          <Text style={styles.effortHint}>Rate how hard this set felt.</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Set effort" style={styles.effortChoices}>
            {RPE_OPTIONS.map((value) => {
              const isSelected = selected === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={`RPE ${value}`}
                  accessibilityState={{ checked: isSelected }}
                  aria-checked={isSelected}
                  onPress={() => {
                    selectionHaptic();
                    onChange({ measurements: updateMeasurement(set, 'rpe', isSelected ? '' : String(value)) });
                  }}
                  style={({ pressed }) => [
                    styles.effortChoice,
                    { borderColor: isSelected ? (theme.marker ?? theme.success) : theme.border },
                    isSelected && { backgroundColor: theme.successSurface },
                    pressed && pressedFeedbackSubtle,
                  ]}
                >
                  <Text style={[styles.effortValue, isSelected && { color: theme.selectionIndicator }]}>{value}</Text>
                </Pressable>
              );
            })}
          </View>
        </ForgeCard>
      ) : (
        <ForgeCard variant="outlined" style={styles.recordedCard}>
          <Text style={styles.recordedValue}>{recorded ? `RPE ${recorded}` : 'No effort recorded'}</Text>
        </ForgeCard>
      )}
    </View>
  );
}

function SetTypeSection({
  value,
  editable,
  onChange,
}: {
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  const recordedType = SET_TYPES.find((type) => type.label === value);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>TYPE</Text>
      {editable ? (
        <ForgeCard
          variant="outlined"
          style={[styles.typeCard, value && styles.typeCardSelected]}
        >
          <View accessibilityRole="radiogroup" accessibilityLabel="Set type">
            {SET_TYPES.map((type, typeIndex) => (
              <SetTypeOption
                key={type.label}
                {...type}
                selected={value === type.label}
                first={typeIndex === 0}
                last={typeIndex === SET_TYPES.length - 1}
                showSeparator={typeIndex < SET_TYPES.length - 1}
                onPress={() => onChange(value === type.label ? '' : type.label)}
              />
            ))}
          </View>
        </ForgeCard>
      ) : (
        <ForgeCard variant="outlined" style={styles.recordedCard}>
          <View style={styles.recordedTypeRow}>
            <View
              style={[
                styles.typeDot,
                { backgroundColor: recordedType?.color ?? theme.marker ?? theme.slate },
              ]}
            />
            <Text style={styles.recordedValue}>{value || 'No type recorded'}</Text>
          </View>
        </ForgeCard>
      )}
    </View>
  );
}

function SetTypeOption({
  label,
  color,
  selected,
  first,
  last,
  showSeparator,
  onPress,
}: {
  label: string;
  color: string;
  selected: boolean;
  first: boolean;
  last: boolean;
  showSeparator: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: 150 });
  }, [progress, selected]);

  const selectedStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const radioDotStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.7 + progress.value * 0.3 }],
  }));

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={({ pressed }) => [styles.typeRow, pressed && pressedFeedbackSubtle]}
    >
      <Animated.View
        style={[
          styles.selectedTypeOverlay,
          first && styles.firstTypeSelection,
          last && styles.lastTypeSelection,
          selectedStyle,
        ]}
      />
      <View style={[styles.typeDot, { backgroundColor: color }]} />
      <Text style={styles.typeText}>{label}</Text>
      <View style={[styles.radio, { borderColor: selected ? (theme.marker ?? theme.success) : theme.slate }]}>
        <Animated.View style={[styles.radioDot, radioDotStyle]} />
      </View>
      {showSeparator ? <View pointerEvents="none" style={styles.typeSeparator} /> : null}
    </Pressable>
  );
}

function CommentSection({
  value,
  editable,
  setLabel,
  onChange,
  onTextFocus,
}: {
  value: string;
  editable: boolean;
  setLabel: string;
  onChange: (value: string) => void;
  onTextFocus: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>COMMENT</Text>
      <ForgeCard variant="outlined" style={styles.commentCard}>
        {editable ? (
          <View style={styles.commentField}>
            <TextInput
              accessibilityLabel={`Comment for ${setLabel.toLowerCase()}`}
              value={value}
              onChangeText={onChange}
              onFocus={onTextFocus}
              onTouchStart={(event) => event.stopPropagation()}
              maxLength={120}
              placeholder="Add a comment..."
              placeholderTextColor={theme.muted}
              style={styles.commentInput}
            />
            <Text style={styles.commentCount}>{`${value.length}/120`}</Text>
          </View>
        ) : (
          <Text style={styles.recordedValue}>{value || 'No comment recorded'}</Text>
        )}
      </ForgeCard>
    </View>
  );
}

function TargetsSection({
  set,
  trackingType,
  editable,
  setLabel,
  onChange,
  onNumberFocus,
}: {
  set: WorkoutSet;
  trackingType: TrackingType;
  editable: boolean;
  setLabel: string;
  onChange: (changes: WorkoutSetChanges) => void;
  onNumberFocus: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.section, styles.targetSection]}>
      <Text style={styles.sectionLabel}>NEXT-TIME TARGET</Text>
      <View style={styles.targetCards}>
        {trackingFields[trackingType].map((kind) => (
          <TargetCard
            key={kind}
            label={trackingFieldLabel(trackingType, kind)}
            value={targetText(set, kind)}
            placeholder="—"
            unit={targetUnitLabel(kind)}
            editable={editable}
            keyboardType={kind === 'reps' || kind === 'duration' ? 'number-pad' : 'decimal-pad'}
            accessibilityLabel={`Next-time ${trackingFieldLabel(trackingType, kind).toLowerCase()} target for ${setLabel.toLowerCase()}`}
            onChangeText={(value) => onChange({
              ...(kind === 'reps' ? { targetReps: value } : kind === 'weight' || kind === 'addedWeight' ? { targetWeight: value } : {}),
              targets: updateTargets(set, kind, value),
            })}
            onFocus={onNumberFocus}
          />
        ))}
      </View>
    </View>
  );
}

function targetText(set: WorkoutSet, kind: SetMeasurementKind): string {
  const target = set.targets?.find((item) => item.kind === kind);
  if (target?.minValue !== undefined) return target.maxValue !== undefined && target.maxValue !== target.minValue ? `${target.minValue}–${target.maxValue}` : String(target.minValue);
  return kind === 'reps' ? set.targetReps ?? '' : kind === 'weight' || kind === 'addedWeight' ? set.targetWeight ?? '' : '';
}
function targetUnitLabel(kind: SetMeasurementKind): string {
  return kind === 'reps' ? 'reps' : measurementUnit[kind];
}
function updateTargets(set: WorkoutSet, kind: SetMeasurementKind, text: string): NonNullable<WorkoutSet['targets']> {
  const values = text.split(/[-–—]/).map((value) => Number(value.trim())).filter(Number.isFinite);
  const retained = (set.targets ?? []).filter((target) => target.kind !== kind);
  if (!values.length) return retained;
  return [...retained, { id: `${set.id}-target-${kind}`, kind, unit: measurementUnit[kind], minValue: values[0], maxValue: values[1] ?? values[0] }];
}

function TargetCard({
  label,
  value,
  placeholder,
  unit,
  editable,
  keyboardType,
  accessibilityLabel,
  onChangeText,
  onFocus,
}: {
  label: string;
  value: string;
  placeholder: string;
  unit: string;
  editable: boolean;
  keyboardType: TextInputProps['keyboardType'];
  accessibilityLabel: string;
  onChangeText: (value: string) => void;
  onFocus: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  const inputRef = useRef<NativeTextInput>(null);
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    requestAnimationFrame(() => inputRef.current?.setSelection(value.length, value.length));
  }, [value.length]);

  return (
    <ForgeCard variant="outlined" style={styles.targetCard}>
      <Pressable
        accessibilityRole={editable ? 'button' : undefined}
        accessibilityLabel={editable ? accessibilityLabel : undefined}
        onPress={editable ? focusInput : undefined}
        disabled={!editable}
        style={({ pressed }) => [styles.targetPressable, pressed && pressedFeedbackSubtle]}
      >
        <Text style={styles.targetLabel}>{label}</Text>
        <View style={styles.targetValue}>
          {editable ? (
            <TextInput
              ref={inputRef}
              accessibilityLabel={accessibilityLabel}
              value={value}
              selection={{ start: value.length, end: value.length }}
              onChangeText={onChangeText}
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
          ) : (
            <Text style={styles.targetStaticValue}>{value || placeholder}</Text>
          )}
          <Text style={styles.targetUnit}>{unit}</Text>
        </View>
      </Pressable>
    </ForgeCard>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) =>
  StyleSheet.create({
    setDetailsSheet: {
      minHeight: 0,
      maxHeight: '92%',
      paddingBottom: 20,
    },
    sheetBody: { flexShrink: 1 },
    contentScroll: { flexShrink: 1 },
    sheetContent: {
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    section: { marginTop: 14 },
    targetSection: { paddingBottom: 4 },
    sectionLabel: {
      marginBottom: 9,
      color: theme.slate,
      ...typeScale.label,
    },
    typeCard: { borderRadius: 16 },
    typeCardSelected: { borderColor: theme.marker ?? theme.success },
    typeRow: {
      position: 'relative',
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      gap: 14,
    },
    selectedTypeOverlay: {
      ...StyleSheet.absoluteFill,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderWidth: 1,
      borderColor: theme.marker ?? theme.success,
      backgroundColor: theme.successSurface,
      borderRadius: 8,
    },
    firstTypeSelection: { borderTopLeftRadius: 15, borderTopRightRadius: 15 },
    lastTypeSelection: { borderBottomLeftRadius: 15, borderBottomRightRadius: 15 },
    typeSeparator: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      left: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.divider,
    },
    typeDot: { width: 14, height: 14, borderRadius: 7 },
    typeText: { flex: 1, color: theme.ink, ...typeScale.body },
    radio: {
      width: 28,
      height: 28,
      borderWidth: 2,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: theme.marker ?? theme.success,
    },
    recordedCard: { minHeight: 56, borderRadius: 16, justifyContent: 'center' },
    recordedTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 },
    recordedValue: { color: theme.ink, ...typeScale.label },
    commentCard: { minHeight: 56, borderRadius: 14, justifyContent: 'center' },
    commentField: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 8,
    },
    commentInput: {
      flex: 1,
      minHeight: 48,
      paddingHorizontal: 0,
      paddingVertical: 0,
      color: theme.ink,
      ...typeScale.label,
      textAlignVertical: 'center',
    },
    commentCount: { color: theme.slate, ...typeScale.caption },
    effortCard: { borderRadius: 14, padding: 12, gap: 10 },
    effortHint: { color: theme.slate, ...typeScale.supporting },
    effortChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    effortChoice: {
      width: 48,
      height: 40,
      borderWidth: 1,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    effortValue: { color: theme.ink, ...typeScale.label },
    targetCards: { flexDirection: 'row', gap: 10 },
    targetCard: { flex: 1, minWidth: 0, height: 56, borderRadius: 14 },
    targetPressable: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      gap: 6,
    },
    targetLabel: { flexShrink: 1, color: theme.ink, ...typeScale.label },
    targetValue: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
    targetInput: {
      width: 44,
      minWidth: 32,
      height: 40,
      paddingHorizontal: 0,
      paddingVertical: 2,
      borderWidth: 0,
      backgroundColor: 'transparent',
      color: theme.ink,
      ...typeScale.sectionTitle,
      textAlign: 'right',
      textAlignVertical: 'center',
    },
    targetStaticValue: { color: theme.ink, ...typeScale.sectionTitle },
    targetUnit: { color: theme.muted, ...typeScale.label },
  });
