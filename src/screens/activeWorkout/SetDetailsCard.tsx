import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Button,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeBackButton,
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
import { SET_TAG_PRESENTATIONS, setTagPresentation } from '../../domain/workouts/setPresentation';

const SET_TYPES = SET_TAG_PRESENTATIONS;
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
  /** Routines edit their own interval, never the next-session target. */
  targetMode?: 'next-session' | 'routine';
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
  targetMode = 'next-session',
}: SetDetailsCardProps) {
  const styles = useThemedStyles(createStyles);
  const [dismissTextKeyboardOnTap, setDismissTextKeyboardOnTap] = React.useState(true);
  const [editorView, setEditorView] = useState<'details' | 'set-kind'>('details');
  const setLabel = `Set ${index + 1}`;

  useEffect(() => {
    if (!visible) setEditorView('details');
  }, [visible]);

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
          {editorView === 'set-kind' ? (
            <SetKindPicker
              setLabel={setLabel}
              value={set.tag || ''}
              onBack={() => setEditorView('details')}
              onClose={closeSheet}
              onChange={(tag) => {
                selectionHaptic();
                onChange({ tag });
                setEditorView('details');
              }}
            />
          ) : (
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
                <SetKindSection
                  value={set.tag || ''}
                  editable={editable}
                  onChange={() => setEditorView('set-kind')}
                  onClear={() => {
                    onChange({ tag: '' });
                  }}
                />
                <SessionNoteEffortSection
                  set={set}
                  editable={editable}
                  setLabel={setLabel}
                  onChange={onChange}
                  onTextFocus={() => setDismissTextKeyboardOnTap(true)}
                />
                <TargetsSection
                  set={set}
                  trackingType={trackingType}
                  editable={editable}
                  setLabel={setLabel}
                  mode={targetMode}
                  onChange={onChange}
                  onNumberFocus={() => setDismissTextKeyboardOnTap(false)}
                />
              </ScrollView>
            </View>
          )}
        </>
      )}
    </ForgeBottomSheet>
  );
}

function SessionNoteEffortSection({
  set,
  editable,
  setLabel,
  onChange,
  onTextFocus,
}: {
  set: WorkoutSet;
  editable: boolean;
  setLabel: string;
  onChange: (changes: WorkoutSetChanges) => void;
  onTextFocus: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  const recorded = measurementText(set, 'rpe');
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>SESSION NOTE &amp; EFFORT</Text>
      <View testID="set-session-note-effort-card">
      <ForgeCard variant="outlined" style={styles.sessionCard}>
        <View style={styles.sessionNoteSection}>
          <Text style={styles.subsectionLabel}>COMMENT</Text>
          {editable ? (
            <TextInput
              accessibilityLabel={`Comment for ${setLabel.toLowerCase()}`}
              value={set.comment || ''}
              onChangeText={(comment) => onChange({ comment })}
              onFocus={onTextFocus}
              onTouchStart={(event) => event.stopPropagation()}
              maxLength={120}
              multiline
              placeholder="Add a comment..."
              placeholderTextColor={theme.muted}
              style={styles.commentInput}
            />
          ) : (
            <Text style={styles.recordedComment}>{set.comment || 'No comment recorded'}</Text>
          )}
        </View>
        <View style={styles.sessionDivider} />
        <View style={styles.sessionEffortSection}>
          <Text style={styles.subsectionLabel}>EFFORT (RPE)</Text>
          {editable ? (
            <EffortSelector set={set} onChange={onChange} />
          ) : (
            <Text style={styles.recordedValue}>{recorded ? `RPE ${recorded}` : 'No effort recorded'}</Text>
          )}
        </View>
      </ForgeCard>
      </View>
    </View>
  );
}

function EffortSelector({ set, onChange }: { set: WorkoutSet; onChange: (changes: WorkoutSetChanges) => void }) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  const recorded = measurementText(set, 'rpe');
  const selected = Number(recorded);
  const scrollRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const selectedIndex = RPE_OPTIONS.indexOf(selected as (typeof RPE_OPTIONS)[number]);

  useEffect(() => {
    if (selectedIndex < 0 || !viewportWidth) return;
    const optionStep = 60;
    const optionWidth = 52;
    scrollRef.current?.scrollTo({
      x: Math.max(0, selectedIndex * optionStep - (viewportWidth - optionWidth) / 2),
      animated: false,
    });
  }, [selectedIndex, viewportWidth]);

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Set effort">
      <ScrollView
        ref={scrollRef}
        testID="set-effort-scroll"
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        contentContainerStyle={styles.effortChoices}
      >
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
      </ScrollView>
    </View>
  );
}

function SetKindSection({
  value,
  editable,
  onChange,
  onClear,
}: {
  value: string;
  editable: boolean;
  onChange: () => void;
  onClear: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  const recordedType = setTagPresentation(value);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>SET KIND</Text>
      {editable ? (
        <ForgeCard variant="outlined" style={styles.setKindCard}>
          <View style={styles.setKindSummary}>
            <View style={[styles.typeDot, { backgroundColor: recordedType?.color ?? theme.slate }]} />
            <Text style={styles.setKindValue}>{value || 'No type'}</Text>
            <View style={styles.setKindActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change set kind"
              onPress={() => { selectionHaptic(); onChange(); }}
              style={({ pressed }) => [styles.changeKindButton, pressed && pressedFeedbackSubtle]}
            >
              <Text style={styles.changeKindText}>Change</Text>
            </Pressable>
            {value ? (
              <Button
                accessibilityLabel="Clear set kind"
                label="Clear"
                variant="outline"
                tone="destructive"
                onPress={onClear}
                style={styles.clearKindButton}
              />
            ) : null}
            </View>
          </View>
        </ForgeCard>
      ) : (
        <ForgeCard variant="outlined" style={styles.recordedCard}>
          <View style={styles.recordedTypeRow}>
            <View
              style={[
                styles.typeDot,
                { backgroundColor: recordedType?.color ?? theme.slate },
              ]}
            />
            <Text style={styles.recordedValue}>{value || 'No type recorded'}</Text>
          </View>
        </ForgeCard>
      )}
    </View>
  );
}

function SetKindPicker({
  setLabel,
  value,
  onBack,
  onClose,
  onChange,
}: {
  setLabel: string;
  value: string;
  onBack: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View accessibilityLabel={`Choose type for ${setLabel}`} style={styles.sheetBody}>
      <ForgeSheetHeader
        title="Set kind"
        onClose={onClose}
        closeAccessibilityLabel={`Close ${setLabel}`}
        leading={<ForgeBackButton accessibilityLabel={`Back to ${setLabel}`} onPress={onBack} />}
      />
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.sheetContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <ForgeCard variant="outlined" style={styles.typeCard}>
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
      </ScrollView>
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
      {showSeparator ? <View style={[styles.typeSeparator, { pointerEvents: 'none' }]} /> : null}
    </Pressable>
  );
}

function TargetsSection({
  set,
  trackingType,
  editable,
  setLabel,
  mode,
  onChange,
  onNumberFocus,
}: {
  set: WorkoutSet;
  trackingType: TrackingType;
  editable: boolean;
  setLabel: string;
  mode: 'next-session' | 'routine';
  onChange: (changes: WorkoutSetChanges) => void;
  onNumberFocus: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const isRoutineInterval = mode === 'routine';
  const applicableFields = isRoutineInterval
    ? trackingFields[trackingType].filter((kind) => kind !== 'weight' && kind !== 'addedWeight')
    : trackingFields[trackingType];
  const targetList = isRoutineInterval ? set.plannedTargets : set.targets;
  return (
    <View testID="set-next-session-section" style={[styles.section, styles.targetSection]}>
      <Text style={styles.sectionLabel}>{isRoutineInterval ? 'ROUTINE INTERVAL' : 'NEXT SESSION'}</Text>
      <ForgeCard variant="outlined" style={styles.targetCardGroup}>
        {applicableFields.map((kind, index) => (
          <TargetRow
            key={kind}
            showDivider={index > 0}
            label={isRoutineInterval ? `${trackingFieldLabel(trackingType, kind)} interval` : trackingFieldLabel(trackingType, kind)}
            value={targetText(targetList, set, kind, isRoutineInterval)}
            placeholder={isRoutineInterval ? 'e.g. 8–12' : '—'}
            unit={targetUnitLabel(kind)}
            editable={editable}
            keyboardType={kind === 'reps' || kind === 'duration' ? 'number-pad' : 'decimal-pad'}
            accessibilityLabel={`${isRoutineInterval ? 'Routine' : 'Next-time'} ${trackingFieldLabel(trackingType, kind).toLowerCase()} ${isRoutineInterval ? 'interval' : 'target'} for ${setLabel.toLowerCase()}`}
            onChangeText={(value) => onChange({
              ...(isRoutineInterval
                ? { plannedTargets: updateTargets(targetList, set.id, kind, value) }
                : {
                    ...(kind === 'reps' ? { targetReps: value } : kind === 'weight' || kind === 'addedWeight' ? { targetWeight: value } : {}),
                    targets: updateTargets(targetList, set.id, kind, value),
                  }),
            })}
            onFocus={onNumberFocus}
          />
        ))}
      </ForgeCard>
    </View>
  );
}

function targetText(targets: WorkoutSet['targets'] | undefined, set: WorkoutSet, kind: SetMeasurementKind, isRoutineInterval: boolean): string {
  const target = targets?.find((item) => item.kind === kind);
  if (target?.minValue !== undefined) return formatTargetValues(target.minValue, target.maxValue);
  if (isRoutineInterval) return '';
  return kind === 'reps' ? set.targetReps ?? '' : kind === 'weight' || kind === 'addedWeight' ? set.targetWeight ?? '' : '';
}
function targetUnitLabel(kind: SetMeasurementKind): string {
  return kind === 'reps' ? 'reps' : measurementUnit[kind];
}
function updateTargets(targets: WorkoutSet['targets'] | undefined, setId: string, kind: SetMeasurementKind, text: string): NonNullable<WorkoutSet['targets']> {
  const values = targetValues(text);
  const retained = (targets ?? []).filter((target) => target.kind !== kind);
  if (!values.length) return retained;
  return [...retained, { id: `${setId}-target-${kind}`, kind, unit: measurementUnit[kind], minValue: values[0], maxValue: values[1] ?? values[0] }];
}

function targetValues(text: string): number[] {
  return text.split(/[-–—]/).map((value) => Number(value.trim())).filter(Number.isFinite);
}

function formatTargetValues(minValue: number, maxValue?: number): string {
  return maxValue !== undefined && maxValue !== minValue ? `${minValue}–${maxValue}` : String(minValue);
}

function normalizedTargetText(text: string): string {
  const [minValue, maxValue] = targetValues(text);
  return minValue === undefined ? '' : formatTargetValues(minValue, maxValue);
}

function TargetRow({
  label,
  value,
  placeholder,
  unit,
  editable,
  keyboardType,
  accessibilityLabel,
  onChangeText,
  onFocus,
  showDivider,
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
  showDivider: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  const inputRef = useRef<NativeTextInput>(null);
  // Targets are normalized to numeric values as the routine draft changes.
  // Keep the raw focused text locally so an incomplete range such as `8–`
  // is not immediately reformatted to `8` before its upper bound can be
  // entered. This also lets users use either a hyphen or an en dash.
  const [draftValue, setDraftValue] = useState(value);
  const draftValueRef = useRef(value);
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) {
      draftValueRef.current = value;
      setDraftValue(value);
    }
  }, [value]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    requestAnimationFrame(() => inputRef.current?.setSelection(draftValueRef.current.length, draftValueRef.current.length));
  }, []);

  return (
    <Pressable
      accessibilityRole={editable ? 'button' : undefined}
      accessibilityLabel={editable ? accessibilityLabel : undefined}
      onPress={editable ? focusInput : undefined}
      disabled={!editable}
      style={({ pressed }) => [styles.targetRow, showDivider && styles.targetRowDivider, pressed && pressedFeedbackSubtle]}
    >
      <Text style={styles.targetLabel}>{label}</Text>
      <View style={styles.targetValue}>
        {editable ? (
          <TextInput
            ref={inputRef}
            accessibilityLabel={accessibilityLabel}
            value={draftValue}
            selection={{ start: draftValue.length, end: draftValue.length }}
            onChangeText={(nextValue) => {
              draftValueRef.current = nextValue;
              setDraftValue(nextValue);
              onChangeText(nextValue);
            }}
            onFocus={() => {
              editingRef.current = true;
              onFocus();
              requestAnimationFrame(() => inputRef.current?.setSelection(draftValueRef.current.length, draftValueRef.current.length));
            }}
            onBlur={() => {
              editingRef.current = false;
              const rawValue = draftValueRef.current;
              const canonicalValue = normalizedTargetText(rawValue);
              // Preserve natural entry while focused, then use one canonical
              // format after leaving the field (for example `8–12`).
              draftValueRef.current = canonicalValue;
              setDraftValue(canonicalValue);
              onChangeText(rawValue);
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
      // This breathing room also increases the natural sheet height, lifting
      // the editor slightly while keeping its final rows clear of the bottom edge.
      paddingBottom: 45,
    },
    section: { marginTop: 14 },
    targetSection: { marginTop: 8, paddingBottom: 4 },
    sectionLabel: {
      marginBottom: 9,
      color: theme.slate,
      ...typeScale.label,
    },
    typeCard: { borderRadius: 16 },
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
    setKindCard: { borderRadius: 16 },
    setKindSummary: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, gap: 12 },
    setKindValue: { flex: 1, color: theme.ink, ...typeScale.label },
    setKindActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    changeKindButton: { minWidth: 78, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    changeKindText: { color: theme.ink, ...typeScale.label },
    clearKindButton: { minWidth: 68, paddingHorizontal: 10, borderRadius: 12 },
    sessionCard: { overflow: 'hidden', borderRadius: 16 },
    sessionNoteSection: { padding: 14, gap: 8 },
    sessionEffortSection: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 10 },
    subsectionLabel: { color: theme.slate, ...typeScale.caption, letterSpacing: 0.7 },
    sessionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider },
    commentInput: {
      minHeight: 80,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.surfaceMuted,
      color: theme.ink,
      ...typeScale.label,
      textAlignVertical: 'top',
    },
    recordedComment: { minHeight: 80, color: theme.ink, ...typeScale.label, textAlignVertical: 'center' },
    effortChoices: { paddingRight: 8, gap: 8 },
    effortChoice: {
      width: 52,
      height: 44,
      borderWidth: 1,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    effortValue: { color: theme.ink, ...typeScale.label },
    targetCardGroup: { overflow: 'hidden', borderRadius: 14 },
    targetRow: {
      minHeight: 56,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      gap: 6,
    },
    targetRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
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
