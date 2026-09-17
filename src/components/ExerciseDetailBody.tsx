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
}: {
  detail: ExerciseCatalogItem;
  workoutTypes: readonly WorkoutTypePreference[];
  restLabel: string;
  onPressRest?: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.detailContent}>
      <ForgeCard variant="nested" style={styles.restTimeCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Change rest time, currently ${restLabel}`}
          accessibilityHint="Opens the rest duration picker"
          disabled={!onPressRest}
          onPress={() => {
            if (!onPressRest) return;
            lightHaptic();
            onPressRest();
          }}
          style={({ pressed }) => [styles.restTimeCardPressable, pressed && onPressRest && pressedFeedback]}
        >
          <View style={styles.restTimeCardIcon}>
            <Icon name="stopwatch-outline" size={20} color={theme.textSecondary} />
          </View>
          <View style={styles.restTimeCardCopy}>
            <Text style={styles.restTimeCardTitle}>Rest time</Text>
          </View>
          <View style={styles.detailAction}>
            <Text style={styles.detailSelectableValue}>{restLabel}</Text>
            {onPressRest ? <Icon name="chevron-forward" size={21} color={theme.textSecondary} /> : null}
          </View>
        </Pressable>
      </ForgeCard>

      <Text style={styles.detailSectionLabel}>ESSENTIALS</Text>
      <ForgeCard variant="nested" size="compact" style={styles.detailFactGrid}>
        <Fact label="Category" value={detail.category} />
        <Fact label="Equipment" value={detail.equipment} />
        <Fact label="Tracking" value={formatTrackingType(detail.trackingType)} />
        <Fact label="Movement family" value={detail.group} />
      </ForgeCard>

      <Text style={styles.detailSectionLabel}>TRAINING PROFILE</Text>
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
    </View>
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
    detailSectionLabel: { marginTop: 6, paddingHorizontal: 4, color: theme.textSecondary, ...typeScale.caption },
    restTimeCard: { overflow: 'hidden', borderRadius: 18 },
    restTimeCardPressable: { minHeight: 64, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
    restTimeCardIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted },
    restTimeCardCopy: { flex: 1, minWidth: 0 },
    restTimeCardTitle: { ...typeScale.cardTitle, color: theme.textPrimary },
    detailAction: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    detailSelectableValue: { ...typeScale.body, color: theme.textSecondary, textAlign: 'right', flexShrink: 1, marginLeft: 16 },
    detailFactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 8 },
    detailFact: { flexBasis: '48%', flexGrow: 1, minWidth: 124, minHeight: 56, padding: 8, gap: 1, justifyContent: 'flex-start' },
    detailFactLabel: { ...typeScale.caption, color: theme.textSecondary },
    detailFactValue: { ...typeScale.label, color: theme.textPrimary },
    detailProfileCard: { overflow: 'hidden', borderRadius: 18 },
    detailProfileRow: { minHeight: 54, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
    detailProfileLabel: { flex: 1, ...typeScale.label, color: theme.textSecondary },
    detailProfileValue: { flexShrink: 1, maxWidth: '62%', textAlign: 'right', ...typeScale.label, color: theme.textPrimary },
    sectionTypes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, flexShrink: 1, marginLeft: 16 },
    sectionType: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    sectionTypeName: { ...typeScale.body, color: theme.ink },
  });
