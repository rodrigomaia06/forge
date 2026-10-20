import { ForgePressable as Pressable } from './ui/ForgePressable';
import { trackingModeLabel } from '../domain/exercises/tracking';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { ExerciseCatalogItem } from '../data/exerciseCatalog';
import type { ForgeTheme, IconName, WorkoutSide } from '../types';
import type { WorkoutTypePreference } from '../types/settings';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import { scaleUI } from '../theme/scale';
import { workoutTypeIcon } from '../screens/settings/workoutTypeIcon';
import { ForgeCard, ForgeText as Text, Icon, lightHaptic, pressedFeedback } from './ui';

/** Human tracking label, e.g. "Weight + reps". Shared with the exercise library. */
export function formatTrackingType(type: ExerciseCatalogItem['trackingType']): string {
  return trackingModeLabel((type ?? 'weight-reps'));
}

/** Exercise facts and settings shared by catalogue and workout details. */
export function ExerciseDetailBody({
  detail,
  workoutTypes,
  restLabel,
  onPressRest,
  secondaryRest,
  footer,
  settingsFooter,
  bottomPadding,
  presentation = 'sheet',
}: {
  presentation?: 'sheet' | 'screen';
  detail: ExerciseCatalogItem;
  workoutTypes: readonly WorkoutTypePreference[];
  restLabel: string;
  onPressRest?: () => void;
  /** A second rest row grouped with the primary one (e.g. unilateral between-sides). */
  secondaryRest?: { title: string; value: string; onPress?: () => void };
  /** Extra content appended after the profile card (e.g. the unilateral section). */
  footer?: React.ReactNode;
  settingsFooter?: React.ReactNode;
  /** Override the content's own bottom padding — a hosting sheet may already
   * provide clearance, so the default 30 would otherwise stack into dead space. */
  bottomPadding?: number;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  if (presentation === 'screen') {
    const essentials: DetailFact[] = [
      { label: 'Category', value: detail.category, icon: 'tag' },
      { label: 'Equipment', value: detail.equipment, icon: 'weight' },
      { label: 'Tracking', value: formatTrackingType(detail.trackingType), icon: 'task-list' },
      { label: 'Movement family', value: detail.group, icon: 'layers' },
    ];
    const muscles: DetailFact[] = [
      { label: 'Primary muscle', value: detail.primaryMuscle, icon: 'goal' },
      { label: 'Secondary muscles', value: detail.secondaryMuscles.join(', '), icon: 'fitness-outline' },
      { label: 'Workout types', value: detail.workoutTypeIds.map(id => workoutTypes.find(type => type.id === id)?.name ?? id).join(', '), icon: 'clipboard' },
    ];
    return (
      <View style={[styles.detailContent, styles.screenContent, bottomPadding !== undefined && { paddingBottom: bottomPadding }]}>
        <DetailFactSection title="Exercise essentials" facts={essentials} />
        <DetailFactSection title="Muscle profile" facts={muscles} />
        <View style={styles.screenSection}>
          <Text accessibilityRole="header" style={styles.screenSectionLabel}>Exercise settings</Text>
          <ForgeCard testID="exercise-settings-group">
            <RestRow title="Rest time" value={restLabel} onPress={onPressRest} presentation="screen" />
            {secondaryRest ? <><View style={styles.screenDivider} /><RestRow title={secondaryRest.title} value={secondaryRest.value} onPress={secondaryRest.onPress} presentation="screen" /></> : null}
            {settingsFooter ? <><View style={styles.screenDivider} />{settingsFooter}</> : null}
          </ForgeCard>
        </View>
        {footer}
      </View>
    );
  }
  return (
    <View style={[styles.detailContent, bottomPadding !== undefined && { paddingBottom: bottomPadding }]}>
      <Text style={styles.detailSectionLabel}>Rest</Text>
      <ForgeCard variant="nested" style={styles.restTimeCard}>
        <RestRow title="Rest time" value={restLabel} onPress={onPressRest} />
        {secondaryRest ? (
          <>
            <View style={styles.restRowDivider} />
            <RestRow title={secondaryRest.title} value={secondaryRest.value} onPress={secondaryRest.onPress} />
          </>
        ) : null}
      </ForgeCard>

      <Text style={styles.detailSectionLabel}>Essentials</Text>
      <ForgeCard variant="nested" size="compact" style={styles.detailFactGrid}>
        <Fact label="Category" value={detail.category} />
        <Fact label="Equipment" value={detail.equipment} />
        <Fact label="Tracking" value={formatTrackingType(detail.trackingType)} />
        <Fact label="Movement family" value={detail.group} />
      </ForgeCard>

      <Text style={styles.detailSectionLabel}>Training profile</Text>
      <ForgeCard variant="nested" size="compact" style={styles.detailProfileCard}>
        {detail.workoutTypeIds.length > 0 ? (
          <View style={styles.detailProfileRow}>
            <Text style={styles.detailProfileLabel}>Workout types</Text>
            <View style={styles.sectionTypes}>
              {detail.workoutTypeIds.map((id) => {
                const type = workoutTypes.find((item) => item.id === id);
                return (
                  <View key={id} testID={`exercise-section-type-${id}`} style={styles.sectionType}>
                    <Icon name={type ? workoutTypeIcon(type) : 'layers'} size={scaleUI(17)} color={theme.textSecondary} />
                    <Text style={styles.sectionTypeName}>{type?.name ?? id}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
        <View style={styles.detailProfileRow}>
          <Text style={styles.detailProfileLabel}>Primary muscle</Text>
          <Text style={styles.detailProfileValue}>{detail.primaryMuscle}</Text>
        </View>
        {detail.secondaryMuscles.length > 0 ? (
          <View style={styles.detailProfileRow}>
            <Text style={styles.detailProfileLabel}>Secondary muscles</Text>
            <Text style={styles.detailProfileValue}>{detail.secondaryMuscles.join(', ')}</Text>
          </View>
        ) : null}
      </ForgeCard>

      {footer}
    </View>
  );
}

type DetailFact = { label: string; value: string; icon: IconName };

function DetailFactSection({ title, facts }: { title: string; facts: DetailFact[] }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const available = facts.filter(({ value }) => value.trim().length > 0);
  if (!available.length) return null;
  return (
    <View style={styles.screenSection}>
      <Text accessibilityRole="header" style={styles.screenSectionLabel}>{title}</Text>
      <ForgeCard>
        {available.map(({ label, value, icon }, index) => (
          <React.Fragment key={label}>
            {index > 0 ? <View style={styles.screenDivider} /> : null}
            <View testID={`exercise-fact-${label.toLowerCase().replaceAll(' ', '-')}`} style={styles.screenFact}>
              <View style={styles.screenFactCopy}>
                <Icon name={icon} size={scaleUI(20)} color={theme.textSecondary} />
                <Text style={styles.screenFactLabel}>{label}</Text>
              </View>
              <Text style={styles.screenFactValue}>{value}</Text>
            </View>
          </React.Fragment>
        ))}
      </ForgeCard>
    </View>
  );
}

function RestRow({ title, value, onPress, presentation = 'sheet' }: { title: string; value: string; onPress?: () => void; presentation?: 'sheet' | 'screen' }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Change ${title.toLowerCase()}, currently ${value}`}
      accessibilityHint="Opens the duration picker"
      disabled={!onPress}
      onPress={() => {
        if (!onPress) return;
        lightHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.restTimeCardPressable, presentation === 'screen' && styles.screenSetting, pressed && onPress && pressedFeedback]}
    >
      <View style={[styles.restTimeCardIcon, presentation === 'screen' && styles.screenSettingIcon]}>
        <Icon name="stopwatch-outline" size={scaleUI(20)} color={theme.textSecondary} />
      </View>
      <View style={styles.restTimeCardCopy}>
        <Text style={[styles.restTimeCardTitle, presentation === 'screen' && styles.screenSettingTitle]}>{title}</Text>
      </View>
      <View style={styles.detailAction}>
        <Text style={styles.detailSelectableValue}>{value}</Text>
        {onPress ? <Icon name="chevron-forward" size={scaleUI(21)} color={theme.textSecondary} /> : null}
      </View>
    </Pressable>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.detailFact}>
      <Text style={styles.detailFactLabel}>{label}</Text>
      <Text style={styles.detailFactValue}>
        {value}
      </Text>
    </View>
  );
}

/**
 * The shared unilateral section appended to a unilateral exercise's detail — the
 * `UnilateralBadge`, a "complete one side at a time" note, and a leading-side
 * choice. Rendered identically by the Exercise Library detail and the live-workout
 * "Exercise info" so the two read the same. Pass `onToggleLeadSide` to make the
 * side choice editable; omit it for a static readout.
 */
export function UnilateralDetailSection({
  leadSide,
  onToggleLeadSide,
  presentation = 'sheet',
}: {
  presentation?: 'sheet' | 'screen';
  leadSide: WorkoutSide;
  onToggleLeadSide?: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const row = (
    <View style={[styles.uniRow, presentation === 'screen' && styles.screenSetting]}>
      <View style={[styles.uniRowIcon, presentation === 'screen' && styles.screenSettingIcon]}>
        <Icon name="square-rounded-letter-s" size={scaleUI(20)} color={theme.textSecondary} />
      </View>
      <Text style={[styles.uniRowTitle, presentation === 'screen' && styles.screenSettingTitle]}>Leading side</Text>
      {onToggleLeadSide ? (
        <LeadingSideToggle value={leadSide} onChange={(side) => { if (side !== leadSide) onToggleLeadSide(); }} />
      ) : <Text style={styles.uniRowValue}>{leadSide === 'right' ? 'Right' : 'Left'}</Text>}
    </View>
  );
  return presentation === 'screen' ? row : (
    <>
      <Text style={styles.detailSectionLabel}>Unilateral</Text>
      <ForgeCard variant="nested" style={styles.uniCard}>{row}</ForgeCard>
    </>
  );
}

/** A two-option segmented control whose selected pill slides between sides. */
function LeadingSideToggle({ value, onChange }: { value: WorkoutSide; onChange: (side: WorkoutSide) => void }) {
  const styles = useThemedStyles(createStyles);
  const [innerWidth, setInnerWidth] = useState(0);
  const progress = useSharedValue(value === 'right' ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(value === 'right' ? 1 : 0, { duration: 190 });
  }, [progress, value]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * (innerWidth / 2) }] }));
  return (
    <View
      style={styles.sideToggle}
      onLayout={(event) => setInnerWidth(event.nativeEvent.layout.width - 4)}
    >
      {innerWidth > 0 ? <Animated.View style={[styles.sidePill, { width: innerWidth / 2 }, pillStyle]} /> : null}
      {(['left', 'right'] as const).map((side) => (
        <Pressable
          key={side}
          accessibilityRole="button"
          accessibilityState={{ selected: value === side }}
          accessibilityLabel={`Lead with the ${side} side`}
          onPress={() => onChange(side)}
          style={styles.sideOption}
        >
          <Text style={[styles.sideOptionText, value === side && styles.sideOptionTextActive]}>
            {side === 'left' ? 'Left' : 'Right'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (theme: ForgeTheme) =>
  StyleSheet.create({
    screenContent: { paddingHorizontal: scaleUI(20), paddingTop: scaleUI(16), gap: scaleUI(24) },
    screenSection: { gap: scaleUI(8) },
    screenSectionLabel: { marginLeft: scaleUI(4), ...typeScale.sectionTitle, color: theme.textPrimary },
    screenFact: { flexDirection: 'row', alignItems: 'center', gap: scaleUI(16), minHeight: Math.max(44, scaleUI(64)), padding: scaleUI(16) },
    screenFactCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: scaleUI(12) },
    screenFactLabel: { flex: 1, minWidth: 0, ...typeScale.body, color: theme.textSecondary },
    screenFactValue: { flex: 1.15, minWidth: 0, textAlign: 'right', ...typeScale.body, color: theme.textPrimary },
    screenDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider, marginHorizontal: scaleUI(16) },
    screenSetting: { padding: scaleUI(16), gap: scaleUI(12), minHeight: Math.max(44, scaleUI(64)) },
    screenSettingIcon: { width: scaleUI(20), height: scaleUI(24), backgroundColor: 'transparent', borderRadius: 0 },
    screenSettingTitle: { ...typeScale.body, color: theme.textPrimary },
    detailContent: { paddingHorizontal: 20, paddingBottom: 30, paddingTop: 2, gap: 8 },
    detailSectionLabel: { marginTop: 8, marginLeft: 6, color: theme.textPrimary, ...typeScale.sectionTitle },
    restTimeCard: { overflow: 'hidden', borderRadius: scaleUI(18) },
    restRowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider, marginLeft: 64 },
    restTimeCardPressable: { minHeight: Math.max(44, scaleUI(64)), paddingHorizontal: scaleUI(14), flexDirection: 'row', alignItems: 'center', gap: 12 },
    restTimeCardIcon: { width: scaleUI(38), height: scaleUI(38), borderRadius: scaleUI(12), alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted },
    restTimeCardCopy: { flex: 1, minWidth: 0 },
    restTimeCardTitle: { ...typeScale.cardTitle, color: theme.textPrimary },
    detailAction: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    detailSelectableValue: { ...typeScale.body, color: theme.textSecondary, textAlign: 'right', flexShrink: 1, marginLeft: 16 },
    detailFactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 8 },
    detailFact: { flexBasis: '48%', flexGrow: 1, minWidth: scaleUI(124), minHeight: scaleUI(56), padding: scaleUI(8), gap: 1, justifyContent: 'flex-start' },
    detailFactLabel: { ...typeScale.body, color: theme.textSecondary },
    detailFactValue: { ...typeScale.body, color: theme.textPrimary },
    detailProfileCard: { overflow: 'hidden', borderRadius: scaleUI(18), paddingVertical: 2 },
    detailProfileRow: { minHeight: scaleUI(42), paddingHorizontal: 14, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
    detailProfileLabel: { flex: 1, ...typeScale.body, color: theme.textSecondary },
    detailProfileValue: { flexShrink: 1, maxWidth: '62%', textAlign: 'right', ...typeScale.body, color: theme.textPrimary },
    sectionTypes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, flexShrink: 1, marginLeft: 16 },
    sectionType: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    sectionTypeName: { ...typeScale.body, color: theme.ink },
    uniCard: { overflow: 'hidden', borderRadius: scaleUI(18) },
    uniRow: { minHeight: scaleUI(64), flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12 },
    uniRowIcon: { width: scaleUI(38), height: scaleUI(38), borderRadius: scaleUI(12), alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted },
    uniRowTitle: { flex: 1, color: theme.textPrimary, ...typeScale.cardTitle },
    uniRowValue: { color: theme.textSecondary, ...typeScale.body },
    sideToggle: { width: scaleUI(132), flexDirection: 'row', borderRadius: scaleUI(10), padding: scaleUI(2), position: 'relative', backgroundColor: theme.surfaceMuted, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
    sidePill: { position: 'absolute', top: 2, bottom: 2, left: 2, borderRadius: scaleUI(8), backgroundColor: theme.surface },
    sideOption: { flex: 1, borderRadius: scaleUI(8), paddingVertical: scaleUI(7), alignItems: 'center' },
    sideOptionText: { color: theme.textSecondary, ...typeScale.label },
    sideOptionTextActive: { color: theme.ink, fontWeight: '600' },
  });
