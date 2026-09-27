import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ExerciseCatalogItem } from '../data/exerciseCatalog';
import type { ForgeTheme } from '../types';
import type { WorkoutTypePreference } from '../types/settings';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import { workoutTypeIcon } from '../screens/settings/workoutTypeIcon';
import { ForgeCard, ForgeText as Text, Icon, lightHaptic, pressedFeedback } from './ui';

/** Human tracking label, e.g. "Weight + reps". Shared with the exercise library. */
export function formatTrackingType(type: ExerciseCatalogItem['trackingType']): string {
  return (type ?? 'weight-reps')
    .split('-')
    .map((part) => (part === 'reps' ? 'reps' : part[0].toUpperCase() + part.slice(1)))
    .join(' + ');
}

/**
 * The shared exercise-detail body: a rest-time card, an ESSENTIALS fact grid,
 * and a TRAINING PROFILE card. Used both by the Exercise Library detail and the
 * live-workout "Exercise info" so the two read identically. Pass `onPressRest`
 * to make the rest card interactive; omit it for a static readout.
 */
export function ExerciseDetailBody({
  detail,
  workoutTypes,
  restLabel,
  onPressRest,
  secondaryRest,
  footer,
  bottomPadding,
}: {
  detail: ExerciseCatalogItem;
  workoutTypes: readonly WorkoutTypePreference[];
  restLabel: string;
  onPressRest?: () => void;
  /** A second rest row grouped with the primary one (e.g. unilateral between-sides). */
  secondaryRest?: { title: string; value: string; onPress?: () => void };
  /** Extra content appended after the profile card (e.g. the unilateral section). */
  footer?: React.ReactNode;
  /** Override the content's own bottom padding — a hosting sheet may already
   * provide clearance, so the default 30 would otherwise stack into dead space. */
  bottomPadding?: number;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
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
                    <Icon name={type ? workoutTypeIcon(type) : 'layers'} size={17} color={theme.textSecondary} />
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

function RestRow({ title, value, onPress }: { title: string; value: string; onPress?: () => void }) {
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
      style={({ pressed }) => [styles.restTimeCardPressable, pressed && onPress && pressedFeedback]}
    >
      <View style={styles.restTimeCardIcon}>
        <Icon name="stopwatch-outline" size={20} color={theme.textSecondary} />
      </View>
      <View style={styles.restTimeCardCopy}>
        <Text style={styles.restTimeCardTitle}>{title}</Text>
      </View>
      <View style={styles.detailAction}>
        <Text style={styles.detailSelectableValue}>{value}</Text>
        {onPress ? <Icon name="chevron-forward" size={21} color={theme.textSecondary} /> : null}
      </View>
    </Pressable>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.detailFact}>
      <Text style={styles.detailFactLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.detailFactValue}>{value}</Text>
    </View>
  );
}

const createStyles = (theme: ForgeTheme) =>
  StyleSheet.create({
    detailContent: { paddingHorizontal: 20, paddingBottom: 30, paddingTop: 2, gap: 8 },
    detailSectionLabel: { marginTop: 8, marginLeft: 6, color: theme.textPrimary, ...typeScale.sectionTitle },
    restTimeCard: { overflow: 'hidden', borderRadius: 18 },
    restRowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider, marginLeft: 64 },
    restTimeCardPressable: { minHeight: 64, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
    restTimeCardIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted },
    restTimeCardCopy: { flex: 1, minWidth: 0 },
    restTimeCardTitle: { ...typeScale.cardTitle, color: theme.textPrimary },
    detailAction: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    detailSelectableValue: { ...typeScale.body, color: theme.textSecondary, textAlign: 'right', flexShrink: 1, marginLeft: 16 },
    detailFactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 8 },
    detailFact: { flexBasis: '48%', flexGrow: 1, minWidth: 124, minHeight: 56, padding: 8, gap: 1, justifyContent: 'flex-start' },
    detailFactLabel: { ...typeScale.body, color: theme.textSecondary },
    detailFactValue: { ...typeScale.body, color: theme.textPrimary },
    detailProfileCard: { overflow: 'hidden', borderRadius: 18, paddingVertical: 2 },
    detailProfileRow: { minHeight: 42, paddingHorizontal: 14, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
    detailProfileLabel: { flex: 1, ...typeScale.body, color: theme.textSecondary },
    detailProfileValue: { flexShrink: 1, maxWidth: '62%', textAlign: 'right', ...typeScale.body, color: theme.textPrimary },
    sectionTypes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, flexShrink: 1, marginLeft: 16 },
    sectionType: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    sectionTypeName: { ...typeScale.body, color: theme.ink },
  });
