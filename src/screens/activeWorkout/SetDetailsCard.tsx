import { setRirText, updateSetRir } from '../../domain/workouts/setEffort';
import { ForgePressable as Pressable } from '../../components/ui/ForgePressable';
import { ForgeSheetScrollView } from '../../components/ui/ForgeSheetScrollView';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type KeyboardTypeOptions } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';

import {
  Button,
  ForgeBackButton,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeCard,
  ForgeNumericRangeInput,
  ForgeSheetHeader,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  HeaderAction,
  pressedFeedbackSubtle,
} from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { scaleUI } from '../../theme/scale';
import type { SetMeasurementKind, TrackingType, WorkoutSet, WorkoutSetChanges } from '../../types';
import { selectionHaptic } from './activeWorkoutFeedback';
import {
  formatDuration,
  parseDuration,
  measurementText,
  measurementUnit,
  trackingFieldLabel,
  trackingFields,
  updateMeasurement,
} from '../../domain/exercises/tracking';
import { SET_TAG_PRESENTATIONS, setTagPresentation } from '../../domain/workouts/setPresentation';

const SET_TYPES = SET_TAG_PRESENTATIONS;
const RIR_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4] as const;

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
  const detailsScrollRef = useRef<ScrollView>(null);
  const targetFocusedRef = useRef(false);
  const reducedMotion = useForgeReducedMotion();
  const setLabel = `Set ${index + 1}`;
  // A quick cross-fade between the details and set-kind views reads as one
  // sheet changing state, rather than an abrupt swap or a laggy delayed return.
  const viewEntering = reducedMotion ? undefined : FadeIn.duration(forgeMotion.state);

  useEffect(() => {
    if (!visible) {
      setEditorView('details');
      targetFocusedRef.current = false;
    }
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
            <Animated.View key="set-kind" entering={viewEntering} style={styles.sheetBody}>
            <SetKindPicker
              setLabel={setLabel}
              value={set.tag || ''}
              onBack={() => setEditorView('details')}
              onClose={closeSheet}
              onChange={(tag) => {
                selectionHaptic();
                onChange({ tag });
                // Return immediately; the cross-fade back to details is the
                // feedback, so there is no laggy per-option delay.
                setEditorView('details');
              }}
            />
            </Animated.View>
          ) : (
            <Animated.View key="details" entering={viewEntering} accessibilityLabel={`Details for ${setLabel}`} style={styles.sheetBody}>
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
              <ForgeSheetScrollView
                ref={detailsScrollRef}
                onLayout={() => {
                  if (targetFocusedRef.current) detailsScrollRef.current?.scrollToEnd({ animated: false });
                }}
                style={styles.contentScroll}
                contentContainerStyle={styles.sheetContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <SetKindSection
                  value={set.tag || ''}
                  editable={editable}
                  onChange={() => {
                    targetFocusedRef.current = false;
                    setEditorView('set-kind');
                  }}
                  onClear={() => {
                    onChange({ tag: '' });
                  }}
                />
                <SessionNoteEffortSection
                  set={set}
                  editable={editable}
                  setLabel={setLabel}
                  onChange={onChange}
                  onTextFocus={() => {
                    targetFocusedRef.current = false;
                    setDismissTextKeyboardOnTap(true);
                  }}
                />
                <TargetsSection
                  set={set}
                  trackingType={trackingType}
                  editable={editable}
                  setLabel={setLabel}
                  mode={targetMode}
                  onChange={onChange}
                  onNumberFocus={() => {
                    targetFocusedRef.current = true;
                    setDismissTextKeyboardOnTap(false);
                    detailsScrollRef.current?.scrollToEnd({ animated: false });
                  }}
                />
              </ForgeSheetScrollView>
            </Animated.View>
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
  const recorded = setRirText(set);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Session note &amp; effort</Text>
      <View testID="set-session-note-effort-card">
        <ForgeCard variant="nested" style={styles.sessionCard}>
          <View style={styles.sessionNoteSection}>
            <Text style={styles.subsectionLabel}>Comment</Text>
            {editable ? (
              <TextInput
                accessibilityLabel={`Comment for ${setLabel.toLowerCase()}`}
                value={set.comment || ''}
                onChangeText={(comment) => onChange({ comment })}
                onFocus={onTextFocus}
                onTouchStart={(event) => event.stopPropagation()}
                multiline
                scrollEnabled
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
            <Text style={styles.subsectionLabel}>Reps in reserve (RIR)</Text>
            {editable ? (
              <EffortSelector set={set} onChange={onChange} />
            ) : (
              <Text style={styles.recordedValue}>
                {recorded ? `RIR ${recorded}` : 'No effort recorded'}
              </Text>
            )}
          </View>
        </ForgeCard>
      </View>
    </View>
  );
}

function EffortSelector({
  set,
  onChange,
}: {
  set: WorkoutSet;
  onChange: (changes: WorkoutSetChanges) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const recorded = setRirText(set);
  const selected = recorded ? Number(recorded) : null;
  const scrollRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const selectedIndex = RIR_OPTIONS.indexOf(selected as (typeof RIR_OPTIONS)[number]);

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
        {RIR_OPTIONS.map((value) => {
          const isSelected = selected === value;
          return (
            <SetDetailChoice
              key={value}
              label={String(value)}
              numeric
              selected={isSelected}
              onPress={() => {
                selectionHaptic();
                onChange({ measurements: updateSetRir(set, isSelected ? '' : String(value)) });
              }}
            />
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
      <Text style={styles.sectionLabel}>Set kind</Text>
      {editable ? (
        <ForgeCard variant="nested" style={styles.setKindCard}>
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
        <ForgeCard variant="nested" style={styles.recordedCard}>
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
      <ForgeSheetScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.sheetContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <ForgeCard variant="nested" style={styles.typeCard}>
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
      </ForgeSheetScrollView>
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
  const reducedMotion = useForgeReducedMotion();

  useEffect(() => {
    progress.value = reducedMotion
      ? (selected ? 1 : 0)
      : withTiming(selected ? 1 : 0, { duration: forgeMotion.state });
  }, [progress, reducedMotion, selected]);

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
      {/* Selection reads from the filled green radio alone — no green row tint. */}
      <View style={[styles.typeDot, { backgroundColor: color }]} />
      <Text style={styles.typeText}>{label}</Text>
      <View style={[styles.radio, { borderColor: selected ? (theme.marker ?? theme.success) : theme.slate }]}>
        <Animated.View style={[styles.radioDot, radioDotStyle]} />
      </View>
      {showSeparator ? <View style={[styles.typeSeparator, { pointerEvents: 'none' }]} /> : null}
    </Pressable>
  );
}

function SetDetailChoice({
  label,
  selected,
  onPress,
  numeric = false,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  numeric?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? (numeric ? `RIR ${label}` : label)}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={[
        styles.choice,
        numeric && styles.numericChoice,
        {
          borderColor: selected ? theme.selectionIndicator : theme.border,
          backgroundColor: theme.surfaceMuted,
        },
      ]}
    >
      <Text
        style={[
          styles.choiceLabel,
          selected && styles.selectedChoiceLabel,
        ]}
      >
        {label}
      </Text>
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
  // Next-session targets are single values (allow a decimal via comma/period);
  // routine intervals are ranges that keep the dash-based keypad.
  const commaAsDecimal = !isRoutineInterval;
  return (
    <View testID="set-next-session-section" style={[styles.section, styles.targetSection]}>
      <Text style={styles.sectionLabel}>
        {isRoutineInterval ? 'Routine interval' : 'Next session target'}
      </Text>
      <ForgeCard
        variant="nested"
        style={[styles.targetCardGroup, !isRoutineInterval && styles.pairedTargets]}
      >
        {applicableFields.map((kind, index) => (
          <TargetRow
            key={kind}
            paired={!isRoutineInterval}
            showDivider={isRoutineInterval && index > 0}
            label={
              isRoutineInterval
                ? `${kind === 'duration' ? 'Sec' : trackingFieldLabel(trackingType, kind)} interval`
                : trackingFieldLabel(trackingType, kind)
            }
            value={targetText(targetList, set, kind, isRoutineInterval)}
            placeholder={isRoutineInterval ? 'e.g. 8–12' : '—'}
            unit={!isRoutineInterval && kind === 'duration' ? 'mm:ss' : targetUnitLabel(kind)}
            editable={editable}
            commaAsDecimal={commaAsDecimal}
            timeValue={!isRoutineInterval && kind === 'duration'}
            keyboardType={
              isRoutineInterval
                ? 'numbers-and-punctuation'
                : kind === 'reps'
                  ? 'number-pad'
                  : 'decimal-pad'
            }
            accessibilityLabel={`${isRoutineInterval ? 'Routine' : 'Next-time'} ${(isRoutineInterval && kind === 'duration' ? 'Sec' : trackingFieldLabel(trackingType, kind)).toLowerCase()} ${isRoutineInterval ? 'interval' : 'target'} for ${setLabel.toLowerCase()}`}
            onChangeText={(value) =>
              onChange({
                ...(isRoutineInterval
                  ? {
                      plannedTargets: updateTargets(
                        targetList,
                        set.id,
                        kind,
                        value,
                        commaAsDecimal,
                      ),
                    }
                  : {
                      ...(kind === 'reps'
                        ? { targetReps: value }
                        : kind === 'weight' || kind === 'addedWeight'
                          ? { targetWeight: value }
                          : {}),
                      targets: updateTargets(targetList, set.id, kind, value, commaAsDecimal),
                    }),
              })
            }
            onFocus={onNumberFocus}
          />
        ))}
      </ForgeCard>
    </View>
  );
}

function targetText(
  targets: WorkoutSet['targets'] | undefined,
  set: WorkoutSet,
  kind: SetMeasurementKind,
  isRoutineInterval: boolean,
): string {
  const target = targets?.find((item) => item.kind === kind);
  // The user's decimal separator lives on in the raw legacy string (written
  // alongside the numeric target). Reuse it so a comma target such as `82,5`
  // is not silently rewritten to `82.5` when re-rendered from the number.
  const legacyRaw =
    kind === 'reps'
      ? set.targetReps
      : kind === 'weight' || kind === 'addedWeight'
        ? set.targetWeight
        : undefined;
  if (target?.minValue !== undefined) {
    if (!isRoutineInterval && kind === 'duration')
      return formatTargetValues(target.minValue, target.maxValue, '.', true);
    return formatTargetValues(
      target.minValue,
      target.maxValue,
      isRoutineInterval ? '.' : decimalSeparatorOf(legacyRaw),
    );
  }
  if (isRoutineInterval) return '';
  return legacyRaw ?? '';
}
function targetUnitLabel(kind: SetMeasurementKind): string {
  return kind === 'reps' ? 'reps' : measurementUnit[kind];
}
function updateTargets(
  targets: WorkoutSet['targets'] | undefined,
  setId: string,
  kind: SetMeasurementKind,
  text: string,
  commaAsDecimal: boolean,
): NonNullable<WorkoutSet['targets']> {
  const values = targetValues(text, commaAsDecimal, commaAsDecimal && kind === 'duration');
  const retained = (targets ?? []).filter((target) => target.kind !== kind);
  if (!values.length) return retained;
  return [
    ...retained,
    {
      id: `${setId}-target-${kind}`,
      kind,
      unit: measurementUnit[kind],
      minValue: values[0],
      maxValue: values[1] ?? values[0],
    },
  ];
}

/**
 * Parse a target field into numbers. Ranges split on a dash only. When
 * `commaAsDecimal` is set (single next-session targets), a comma is a decimal
 * point (e.g. `82,5` → `82.5`) rather than a range separator, so a decimal
 * weight is never mangled into a `min–max` range.
 */
function targetValues(text: string, commaAsDecimal: boolean, timeValue = false): number[] {
  const separator = commaAsDecimal ? /[-–—]/ : /[,\-–—]/;
  return (
    text
      .split(separator)
      .map((part) =>
        (timeValue
          ? part.replace(/[,.]/g, ':')
          : commaAsDecimal
            ? part.replace(',', '.')
            : part
        ).trim(),
      )
      // `Number('')` is 0 and passes `isFinite`, so an empty side (a cleared field
      // or a half-typed range like "8-") would collapse the target to 0. Drop
      // empty parts first so clearing the field removes the target instead.
      .filter((part) => part.length > 0)
      .map((value) => (timeValue ? parseDuration(value) : Number(value)))
      .filter(Number.isFinite)
  );
}

/** Which decimal separator the user typed, so canonical text can preserve it. */
function decimalSeparatorOf(raw: string | undefined): ',' | '.' {
  return raw?.includes(',') && !raw.includes('.') ? ',' : '.';
}

function formatTargetValues(
  minValue: number,
  maxValue?: number,
  decimalSeparator: ',' | '.' = '.',
  timeValue = false,
): string {
  const format = (value: number): string =>
    timeValue
      ? formatDuration(value)
      : decimalSeparator === ','
        ? String(value).replace('.', ',')
        : String(value);
  return maxValue !== undefined && maxValue !== minValue
    ? `${format(minValue)}–${format(maxValue)}`
    : format(minValue);
}

function normalizedTargetText(text: string, commaAsDecimal: boolean, timeValue = false): string {
  const [minValue, maxValue] = targetValues(text, commaAsDecimal, timeValue);
  if (minValue === undefined) return '';
  // Keep the separator the user actually entered (comma stays comma) for single
  // next-session targets; routine ranges always canonicalise to a period.
  return formatTargetValues(
    minValue,
    maxValue,
    commaAsDecimal ? decimalSeparatorOf(text) : '.',
    timeValue,
  );
}

function TargetRow({
  label,
  value,
  placeholder,
  unit,
  editable,
  commaAsDecimal,
  timeValue = false,
  keyboardType,
  accessibilityLabel,
  onChangeText,
  onFocus,
  showDivider,
  paired = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  unit: string;
  editable: boolean;
  commaAsDecimal: boolean;
  timeValue?: boolean;
  keyboardType: KeyboardTypeOptions;
  accessibilityLabel: string;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  showDivider: boolean;
  paired?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  // Targets are normalized to numeric values as the routine draft changes.
  // Keep the raw focused text locally so an incomplete range such as `8–`
  // is not immediately reformatted to `8` before its upper bound can be
  // entered. This also lets users use either a hyphen or an en dash.
  const [draftValue, setDraftValue] = useState(value);
  const draftValueRef = useRef(value);
  const editingRef = useRef(false);
  const [focusRequest, setFocusRequest] = useState(0);

  useEffect(() => {
    if (!editingRef.current) {
      draftValueRef.current = value;
      setDraftValue(value);
    }
  }, [value]);

  const focusInput = useCallback(() => {
    setFocusRequest((request) => request + 1);
  }, []);
  const inputFit = targetInputFit(draftValue);

  return (
    <Pressable
      accessibilityRole={editable ? 'button' : undefined}
      accessibilityLabel={editable ? accessibilityLabel : undefined}
      onPress={editable ? focusInput : undefined}
      disabled={!editable}
      style={({ pressed }) => [
        styles.targetRow,
        paired && styles.pairedTarget,
        showDivider && styles.targetRowDivider,
        pressed && pressedFeedbackSubtle,
      ]}
    >
      <Text style={styles.targetLabel}>{label}</Text>
      <View style={[styles.targetValue, paired && styles.pairedTargetValue]}>
        {editable ? (
          <ForgeNumericRangeInput
            accessibilityLabel={accessibilityLabel}
            value={draftValue}
            onChangeText={(nextValue) => {
              // The number keypad is the primary input path; keep pasted or
              // hardware-keyboard text equally numeric so targets never
              // retain alphabetic characters.
              const numericValue = timeValue
                ? nextValue.replace(/[,.]/g, ':').replace(/[^0-9:]/g, '')
                : nextValue.replace(/[^0-9.,\-–—]/g, '');
              draftValueRef.current = numericValue;
              setDraftValue(numericValue);
              onChangeText(numericValue);
            }}
            onFocus={() => {
              editingRef.current = true;
              onFocus();
            }}
            onBlur={() => {
              editingRef.current = false;
              const rawValue = draftValueRef.current;
              const canonicalValue = normalizedTargetText(rawValue, commaAsDecimal, timeValue);
              // Preserve natural entry while focused, then use one canonical
              // format after leaving the field (for example `8–12`).
              draftValueRef.current = canonicalValue;
              setDraftValue(canonicalValue);
              onChangeText(rawValue);
            }}
            onTouchStart={(event) => event.stopPropagation()}
            focusRequest={focusRequest}
            keyboardType={keyboardType}
            placeholder={placeholder}
            placeholderTextColor={theme.ink}
            textColor={theme.ink}
            fontSize={inputFit.fontSize}
            style={[styles.targetInput, inputFit, paired && styles.pairedTargetInput]}
          />
        ) : (
          <Text style={styles.targetStaticValue}>{value || placeholder}</Text>
        )}
        <Text style={styles.targetUnit}>{unit}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Targets stay on one line. They first use spare row width, then reduce from
 * the section-title role down to the readable label role for longer decimal
 * intervals instead of wrapping or clipping a partial target.
 */
function targetInputFit(value: string) {
  const characterCount = Math.max(1, value.length);
  const width = Math.min(132, Math.max(56, 20 + characterCount * 11));
  const fontSize = Math.max(
    typeScale.label.fontSize,
    typeScale.sectionTitle.fontSize - Math.max(0, characterCount - 8) * 1.1,
  );
  return {
    width,
    fontSize,
    lineHeight: Math.max(typeScale.label.lineHeight, fontSize + 5),
  };
}

const createStyles = (theme: import('../../types').ForgeTheme) =>
  StyleSheet.create({
    setDetailsSheet: {
      minHeight: 0,
      maxHeight: '92%',
    },
    sheetBody: { flexShrink: 1 },
    contentScroll: { flexShrink: 1 },
    sheetContent: {
      paddingHorizontal: 20,
      paddingBottom: scaleUI(62),
    },
    section: { marginTop: 14 },
    targetSection: { marginTop: 8, paddingBottom: 4 },
    sectionLabel: {
      marginBottom: 9,
      color: theme.slate,
      ...typeScale.sectionTitle,
    },
    typeCard: { borderRadius: scaleUI(16) },
    typeRow: {
      position: 'relative',
      minHeight: Math.max(44, scaleUI(48)),
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: scaleUI(20),
      gap: scaleUI(14),
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
      borderRadius: scaleUI(8),
    },
    firstTypeSelection: { borderTopLeftRadius: scaleUI(15), borderTopRightRadius: scaleUI(15) },
    lastTypeSelection: { borderBottomLeftRadius: scaleUI(15), borderBottomRightRadius: scaleUI(15) },
    typeSeparator: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      left: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.divider,
    },
    // A rounded square echoing the live set-number chip, rather than a circle.
    typeDot: { width: scaleUI(16), height: scaleUI(16), borderRadius: scaleUI(5) },
    typeText: { flex: 1, color: theme.ink, ...typeScale.body },
    radio: {
      width: scaleUI(28),
      height: scaleUI(28),
      borderWidth: 2,
      borderRadius: scaleUI(14),
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioDot: {
      width: scaleUI(14),
      height: scaleUI(14),
      borderRadius: scaleUI(7),
      backgroundColor: theme.marker ?? theme.success,
    },
    recordedCard: { minHeight: scaleUI(56), borderRadius: scaleUI(16), justifyContent: 'center' },
    recordedTypeRow: { flexDirection: 'row', alignItems: 'center', gap: scaleUI(14), paddingHorizontal: scaleUI(20) },
    recordedValue: { color: theme.ink, ...typeScale.label },
    setKindCard: { borderRadius: scaleUI(16) },
    setKindSummary: { minHeight: scaleUI(56), flexDirection: 'row', alignItems: 'center', paddingLeft: scaleUI(16), paddingRight: scaleUI(8), gap: scaleUI(12) },
    setKindValue: { flex: 1, color: theme.ink, ...typeScale.label },
    setKindActions: { flexDirection: 'row', alignItems: 'center', gap: scaleUI(6) },
    changeKindButton: { minWidth: scaleUI(78), minHeight: 44, paddingHorizontal: scaleUI(12), borderRadius: scaleUI(12), borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    changeKindText: { color: theme.ink, ...typeScale.label },
    clearKindButton: { minWidth: scaleUI(68), paddingHorizontal: scaleUI(10), borderRadius: scaleUI(12) },
    sessionCard: { overflow: 'hidden', borderRadius: scaleUI(16) },
    sessionNoteSection: { padding: scaleUI(14), gap: scaleUI(8) },
    sessionEffortSection: {
      paddingHorizontal: scaleUI(14),
      paddingTop: scaleUI(12),
      paddingBottom: scaleUI(14),
      gap: scaleUI(10),
    },
    subsectionLabel: { color: theme.slate, ...typeScale.label },
    sessionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider },
    commentInput: {
      height: scaleUI(80),
      paddingHorizontal: scaleUI(12),
      paddingVertical: scaleUI(12),
      borderRadius: scaleUI(12),
      backgroundColor: theme.surfaceMuted,
      color: theme.ink,
      ...typeScale.body,
      textAlignVertical: 'top',
    },
    recordedComment: {
      minHeight: scaleUI(80),
      color: theme.ink,
      ...typeScale.label,
      textAlignVertical: 'center',
    },
    effortChoices: { paddingRight: scaleUI(8), gap: scaleUI(8) },
    choice: {
      minWidth: 44,
      minHeight: 44,
      paddingHorizontal: scaleUI(12),
      paddingVertical: scaleUI(8),
      borderWidth: 2,
      borderRadius: scaleUI(12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    choiceLabel: { color: theme.ink, ...typeScale.controlLabel },
    selectedChoiceLabel: { ...typeScale.cardTitle },
    numericChoice: {
      width: scaleUI(52),
      height: 44,
      borderWidth: 1,
      borderRadius: scaleUI(12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    effortValue: { color: theme.ink, ...typeScale.label },
    pairedTargets: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: scaleUI(12),
      padding: scaleUI(12),
    },
    pairedTarget: {
      flex: 1,
      minWidth: scaleUI(120),
      minHeight: scaleUI(84),
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: scaleUI(8),
      paddingHorizontal: 0,
      paddingVertical: scaleUI(4),
    },
    pairedTargetValue: {
      minHeight: 44,
      paddingHorizontal: scaleUI(10),
      backgroundColor: theme.surfaceMuted,
      borderRadius: scaleUI(12),
      minWidth: 0,
    },
    pairedTargetInput: { flex: 1, width: 0, minWidth: 0, textAlign: 'left' },
    targetCardGroup: { overflow: 'hidden', borderRadius: scaleUI(14) },
    targetRow: {
      minHeight: Math.max(44, scaleUI(56)),
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: scaleUI(14),
      gap: scaleUI(6),
    },
    targetRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
    targetLabel: { flexShrink: 1, color: theme.ink, ...typeScale.label },
    targetValue: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: scaleUI(3),
    },
    targetInput: {
      width: 44,
      minWidth: scaleUI(32),
      height: scaleUI(40),
      paddingHorizontal: 0,
      paddingVertical: scaleUI(2),
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
