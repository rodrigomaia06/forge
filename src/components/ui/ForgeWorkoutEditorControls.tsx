import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, UIManager, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import type { IconName, WorkoutTypePreference } from '../../types';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { ForgeCard } from './ForgeCard';
import { ForgeBottomSheet, ForgeBottomSheetHandle } from './ForgeBottomSheet';
import { ForgeSheetHeader } from './ForgeSheetHeader';
import { ForgeText, ForgeTextInput } from './ForgeText';
import { ForgeBackButton, HeaderAction } from './HeaderAction';
import { Icon } from './Icon';
import { errorHaptic, lightHaptic, mediumHaptic, selectionHaptic } from './haptics';
import { pressedFeedback } from './pressFeedback';

export interface ForgeAttributeDraft {
  original?: string;
  label: string;
  value: string;
  icon: IconName;
}

const attributeIcons: IconName[] = [
  'mood', 'focus', 'energy', 'recovery', 'sleep', 'heart', 'location', 'home',
  'weather', 'temperature', 'hydration', 'nutrition', 'music', 'shoe', 'goal',
  'note', 'calendar', 'time', 'measure', 'settings',
];

/** Shared Forge editor for one custom workout attribute. */
export function ForgeAttributeEditorSheet({
  value,
  onClose,
  onSave,
  onDelete,
}: {
  value: ForgeAttributeDraft;
  onClose: () => void;
  onSave: (value: ForgeAttributeDraft) => void;
  onDelete?: () => void;
}) {
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  const [draft, setDraft] = useState(value);
  const [selectingIcon, setSelectingIcon] = useState(false);
  // Ease the sheet height with a classic LayoutAnimation as the icon grid expands
  // and collapses. The host sheets disable the reanimated layout transition, which
  // fails to shrink a native Modal surface back and left dead space beneath.
  const easeIconGrid = (): void => {
    if (reducedMotion || Platform.OS === 'web') return;
    if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
    LayoutAnimation.configureNext({
      duration: forgeMotion.transition,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  };
  return (
    <>
      <ForgeBottomSheetHandle />
      <ForgeSheetHeader
        title={value.original ? 'Edit attribute' : 'Add attribute'}
        onClose={undefined}
        closePosition={onDelete ? 'left' : 'right'}
        leading={<ForgeEditorBackButton onPress={onClose} />}
        trailing={onDelete ? <HeaderAction accessibilityLabel="Remove attribute" icon="trash" iconOnly tone="destructive" haptic="none" onPress={() => { errorHaptic(); onDelete(); }} /> : undefined}
      />
      <ScrollView style={styles.editorScroll} contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
        <View style={styles.attributeEditorLayout}>
          <ForgeCard variant="nested" style={styles.iconFieldCard}>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose attribute icon" onPress={() => { lightHaptic(); easeIconGrid(); setSelectingIcon((current) => !current); }} style={styles.iconFieldButton}>
              <View testID="attribute-editor-icon-preview" style={styles.iconFieldPreview}>
                <View testID="attribute-editor-icon-glyph" style={styles.iconFieldGlyph}>
                  <Icon name={draft.icon} size={38} color={theme.textPrimary} />
                </View>
              </View>
              <View testID="attribute-editor-icon-change" style={[styles.iconFieldChange, { backgroundColor: theme.surface }]}>
                <ForgeText style={[styles.iconFieldChangeLabel, { color: theme.textPrimary }]}>Change</ForgeText>
                <Icon name={selectingIcon ? 'chevron-down' : 'chevron-forward'} size={18} color={theme.slate} />
              </View>
            </Pressable>
          </ForgeCard>
          <View style={styles.attributeFields}>
            <ForgeCard variant="nested" style={styles.fieldCard}>
              <ForgeTextInput accessibilityLabel="Attribute label" value={draft.label} onChangeText={(label) => setDraft((current) => ({ ...current, label }))} placeholder="Attribute name" placeholderTextColor={theme.textDisabled} style={[styles.input, { color: theme.textPrimary }]} />
            </ForgeCard>
            <ForgeCard variant="nested" style={styles.fieldCard}>
              <ForgeTextInput accessibilityLabel="Attribute value" value={draft.value} onChangeText={(nextValue) => setDraft((current) => ({ ...current, value: nextValue }))} placeholder="Value (optional)" placeholderTextColor={theme.textDisabled} style={[styles.input, { color: theme.textPrimary }]} />
            </ForgeCard>
          </View>
        </View>
        {selectingIcon ? <ForgeCard variant="nested">
          <View style={styles.iconChoices} accessibilityRole="radiogroup">
            {attributeIcons.map((icon) => <Pressable key={icon} testID={icon === draft.icon ? `attribute-icon-choice-${icon}-selected` : `attribute-icon-choice-${icon}`} accessibilityRole="radio" accessibilityLabel={`Use ${icon} icon`} accessibilityState={{ checked: icon === draft.icon }} onPress={() => { selectionHaptic(); easeIconGrid(); setDraft((current) => ({ ...current, icon })); setSelectingIcon(false); }} style={({ pressed }) => [styles.iconChoice, pressed && pressedFeedback]}><Icon name={icon} size={22} color={theme.textPrimary} />{icon === draft.icon ? <Icon name="check" size={16} color={theme.selectionIndicator} weight="bold" /> : null}</Pressable>)}
          </View>
        </ForgeCard> : null}
        <Button label="Save attribute" accessibilityLabel="Save attribute" icon="check" onPress={() => onSave(draft)} disabled={!draft.label.trim()} tone="success" variant="outline" style={styles.inlineSaveButton} />
      </ScrollView>
    </>
  );
}

/** Swipe-to-delete presentation used by live and historical workout attributes. */
export function ForgeSwipeableAttributeRow({
  label,
  value,
  icon,
  divider,
  compact = false,
  onEdit,
  onDelete,
  valueInput,
}: {
  label: string;
  value: string;
  icon: IconName;
  divider: boolean;
  /** Live Workout retains the same row language in its denser running view. */
  compact?: boolean;
  onEdit?: () => void;
  onDelete: () => void;
  /** Live Workout supplies a direct value field while labels/icons remain editable. */
  valueInput?: React.ReactNode;
}) {
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  const [deleteRevealed, setDeleteRevealed] = useState(false);
  const translateX = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const swipeActivated = useSharedValue(false);
  const deleteWidth = 56;
  useEffect(() => {
    translateX.value = reducedMotion
      ? (deleteRevealed ? -deleteWidth : 0)
      : withSpring(deleteRevealed ? -deleteWidth : 0, forgeMotion.swipeSpring);
  }, [deleteRevealed, reducedMotion, translateX]);
  const settle = useCallback((shouldOpen: boolean): void => {
    if (shouldOpen !== deleteRevealed) mediumHaptic();
    setDeleteRevealed(shouldOpen);
  }, [deleteRevealed]);
  const swipe = useMemo(() => Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-6, 6])
    .onBegin(() => { swipeActivated.set(false); })
    .onStart(() => { swipeActivated.set(true); dragStart.set(translateX.get()); })
    .onUpdate((event) => {
      translateX.set(Math.max(-deleteWidth, Math.min(0, dragStart.get() + event.translationX)));
    })
    .onEnd((event) => {
      const shouldOpen = event.velocityX < -500 || (event.velocityX <= 500 && translateX.get() < -deleteWidth * 0.58);
      translateX.set(reducedMotion ? (shouldOpen ? -deleteWidth : 0) : withSpring(shouldOpen ? -deleteWidth : 0, forgeMotion.swipeSpring));
      scheduleOnRN(settle, shouldOpen);
    })
    .onFinalize((_event, success) => {
      if (!success) translateX.set(reducedMotion ? (deleteRevealed ? -deleteWidth : 0) : withSpring(deleteRevealed ? -deleteWidth : 0, forgeMotion.swipeSpring));
    }), [deleteRevealed, dragStart, reducedMotion, translateX, settle, swipeActivated]);
  const swipeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  return (
    <GestureDetector gesture={swipe}>
    <View style={styles.swipeAttributeRow}>
      <View style={[styles.attributeDeleteAction, { backgroundColor: theme.destructiveSurface, pointerEvents: deleteRevealed ? 'auto' : 'none' }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${label} attribute`} onPress={() => { errorHaptic(); onDelete(); }} style={({ pressed }) => [styles.attributeDeleteButton, pressed && { backgroundColor: theme.destructiveSurfacePressed }]}>
          <Icon name="trash" size={18} color={theme.textDestructive} />
        </Pressable>
      </View>
      <Animated.View style={[styles.swipeAttributeContent, { backgroundColor: theme.surface }, swipeStyle]}>
        {valueInput ? (
          <View style={[styles.row, compact && styles.rowCompact, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }]}>
            <View style={styles.directAttributeMeta}>
              <Icon name={icon} size={22} color={theme.textPrimary} />
              <ForgeText numberOfLines={2} style={[styles.directAttributeLabel, { color: theme.textPrimary }]}>{label}</ForgeText>
            </View>
            <View style={styles.directAttributeValue}>{valueInput}</View>
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label} attribute`} onPress={() => { if (swipeActivated.get()) return; lightHaptic(); onEdit?.(); }} style={[styles.row, compact && styles.rowCompact, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }]}>
            <Icon name={icon} size={22} color={theme.textPrimary} />
            <ForgeText numberOfLines={2} style={[styles.rowLabel, { color: theme.textPrimary }]}>{label}</ForgeText>
            <ForgeText style={[styles.rowValue, { color: theme.slate }]}>{value || 'Add value'}</ForgeText>
            <Icon name="chevron-forward" size={20} color={theme.slate} />
          </Pressable>
        )}
      </Animated.View>
    </View>
    </GestureDetector>
  );
}

/**
 * The read-only rendering of a saved attribute: `[icon] label … value`, with an
 * optional leading hairline for stacked rows. The static sibling of
 * `ForgeSwipeableAttributeRow`, so a routine's view mode, a workout summary, and
 * workout details all present attributes identically instead of each screen
 * hand-rolling the same layout.
 */
export function ForgeAttributeRow({
  icon,
  label,
  value,
  showDivider = false,
  flush = false,
  compact = false,
}: {
  icon: IconName;
  label: string;
  value?: string;
  showDivider?: boolean;
  /** Drop the row's own horizontal inset when the container already pads. */
  flush?: boolean;
  /** A denser row for compact display surfaces like the workout summary card. */
  compact?: boolean;
}) {
  const theme = useForgeTheme();
  return (
    <View
      style={[
        styles.attributeReadRow,
        compact && styles.attributeReadRowCompact,
        flush && styles.attributeReadRowFlush,
        showDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
      ]}
    >
      <Icon name={icon} size={18} color={theme.slate} />
      <ForgeText numberOfLines={1} style={[styles.attributeReadLabel, { color: theme.slate }]}>{label}</ForgeText>
      {value ? (
        <ForgeText numberOfLines={1} style={[styles.attributeReadValue, { color: theme.textPrimary }]}>{value}</ForgeText>
      ) : null}
    </View>
  );
}

/** A type list with semantic icons and a current hidden type retained for editing. */
export function ForgeWorkoutTypePicker({
  selectedType,
  workoutTypes,
  onBack,
  onClose,
  onSelect,
  iconForType,
}: {
  selectedType: string;
  workoutTypes: WorkoutTypePreference[];
  onBack: () => void;
  onClose: () => void;
  onSelect: (type: string) => void;
  iconForType: (type: WorkoutTypePreference) => IconName;
}) {
  const theme = useForgeTheme();
  return (
    <>
      <ForgeBottomSheetHandle />
      <ForgeSheetHeader title="Workout type" onClose={onClose} closeAccessibilityLabel="Close workout type picker" leading={<ForgeEditorBackButton onPress={onBack} />} />
      <ScrollView style={styles.editorScroll} contentContainerStyle={styles.typePickerContent} showsVerticalScrollIndicator={false}>
        <View accessibilityRole="radiogroup">
          <ForgeCard variant="nested">
            {workoutTypes.map((type, index) => {
              const selected = type.name === selectedType;
              return <Pressable key={type.id} accessibilityRole="radio" accessibilityLabel={type.name} accessibilityState={{ checked: selected }} onPress={() => { selectionHaptic(); onSelect(type.name); }} style={[styles.typeChoice, selected && { backgroundColor: theme.successSurface }, index > 0 ? { borderTopColor: theme.divider } : { borderTopWidth: 0 }]}>
                <Icon name={iconForType(type)} size={20} color={theme.textPrimary} />
                <ForgeText style={[styles.rowLabel, { color: theme.textPrimary }]}>{type.name}</ForgeText>
                {selected ? <Icon name="check" size={20} color={theme.selectionIndicator} weight="bold" /> : null}
              </Pressable>;
            })}
          </ForgeCard>
        </View>
      </ScrollView>
    </>
  );
}

export function ForgeEditorBackButton({ onPress, accessibilityLabel = 'Back to edit workout' }: { onPress: () => void; accessibilityLabel?: string }) {
  return <ForgeBackButton accessibilityLabel={accessibilityLabel} onPress={onPress} />;
}

/**
 * The canonical workout-type picker: a Forge bottom sheet with a colour-dotted
 * single-select list. Shared by the routine and history editors so the type
 * choice is presented one way instead of as differing anchored dropdowns.
 */
export function ForgeWorkoutTypeSheet({
  visible,
  onClose,
  types,
  selectedType,
  onSelect,
  testID = 'workout-type-sheet',
}: {
  visible: boolean;
  onClose: () => void;
  types: WorkoutTypePreference[];
  selectedType: string;
  onSelect: (type: string) => void;
  testID?: string;
}) {
  const theme = useForgeTheme();
  const insets = useSafeAreaInsets();
  return (
    <ForgeBottomSheet visible={visible} onClose={onClose} accessibilityLabel="Close workout type picker" testID={testID}>
      {(close) => (
        <View testID={`${testID}-surface`} style={[styles.typeSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader title="Workout type" onClose={close} closeAccessibilityLabel="Close workout type picker" />
          <ScrollView testID={`${testID}-scroll`} style={styles.editorScroll} contentContainerStyle={styles.typeSheetContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <ForgeCard variant="nested">
              <View accessibilityRole="radiogroup">
                {types.map((type, index) => {
                  const selected = type.name === selectedType;
                  return (
                    <Pressable
                      key={type.id}
                      accessibilityRole="radio"
                      accessibilityLabel={`Use ${type.name} workout type`}
                      accessibilityState={{ checked: selected, selected }}
                      onPress={() => { selectionHaptic(); onSelect(type.name); close(); }}
                      style={({ pressed }) => [styles.typeSheetRow, index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider } : null, pressed && pressedFeedback]}
                    >
                      <View style={[styles.typeSheetDot, { backgroundColor: type.color }]} />
                      <ForgeText style={[styles.typeSheetLabel, { color: theme.textPrimary }]}>{type.name}</ForgeText>
                      {selected ? <Icon name="check" size={20} color={theme.selectionIndicator} weight="bold" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </ForgeCard>
          </ScrollView>
        </View>
      )}
    </ForgeBottomSheet>
  );
}

const styles = StyleSheet.create({
  editorScroll: { flexGrow: 0, flexShrink: 1 },
  editorContent: { paddingTop: 14, paddingBottom: 24, paddingHorizontal: 20, gap: 12 },
  typePickerContent: { paddingTop: 22, paddingBottom: 20 },
  attributeEditorLayout: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  iconFieldCard: { width: 100, minWidth: 92, overflow: 'hidden' },
  iconFieldButton: { flex: 1, minHeight: 116, position: 'relative' },
  iconFieldPreview: { position: 'absolute', top: 0, right: 0, bottom: 44, left: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  iconFieldGlyph: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', transform: [{ translateY: 4 }] },
  iconFieldChange: { position: 'absolute', right: 0, bottom: 0, left: 0, minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconFieldChangeLabel: { flexShrink: 1, ...typeScale.label },
  attributeFields: { flex: 1, minWidth: 0, gap: 12 },
  fieldCard: { minHeight: 52, paddingHorizontal: 14, justifyContent: 'center' },
  input: { flex: 1, minHeight: 52, paddingVertical: 0, textAlignVertical: 'center', ...typeScale.body },
  inlineSaveButton: { width: '100%', minHeight: 46, borderRadius: 16 },
  row: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowCompact: { minHeight: 48, paddingVertical: 4 },
  directAttributeMeta: { maxWidth: '48%', minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  directAttributeLabel: { flexShrink: 1, ...typeScale.label },
  directAttributeValue: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  typeChoice: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  rowLabel: { flexBasis: '28%', flexShrink: 1, ...typeScale.label },
  rowValue: { flex: 1, flexShrink: 1, ...typeScale.supporting, textAlign: 'right' },
  swipeAttributeRow: { position: 'relative', overflow: 'hidden' },
  swipeAttributeContent: { zIndex: 1 },
  attributeDeleteAction: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 56 },
  attributeDeleteButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  typeSheet: { flexShrink: 1, paddingHorizontal: 16 },
  typeSheetContent: { paddingTop: 4, paddingBottom: 8 },
  typeSheetRow: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeSheetDot: { width: 12, height: 12, borderRadius: 6 },
  typeSheetLabel: { flex: 1, minWidth: 0, ...typeScale.body },
  attributeReadRow: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  attributeReadRowCompact: { minHeight: 44 },
  attributeReadRowFlush: { paddingHorizontal: 0 },
  attributeReadLabel: { flexShrink: 1, ...typeScale.body },
  attributeReadValue: { flex: 1, minWidth: 0, textAlign: 'right', ...typeScale.body },
  iconChoices: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconChoice: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, position: 'relative' },
});
