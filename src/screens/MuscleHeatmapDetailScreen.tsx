import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen, ForgeCard, ForgeText as Text, HeaderAction, pressedFeedback, selectionHaptic } from '../components/ui';
import { SettingsDetailHeader } from './settings/SettingsScreenChrome';
import { MuscleMap } from '../components/anatomy/MuscleMap';
import { HEATMAP_ACCENT, MUSCLE_GROUP_COLORS } from './dashboard/DashboardWidgetTiles';
import { muscleBalance, muscleBalanceByMuscle, muscleHeatBySlug, MUSCLES_BY_GROUP } from '../domain/dashboard/widgetMetrics';
import { useWorkouts } from '../state/WorkoutContext';
import { useSettings } from '../state/SettingsContext';
import { TREND_DAY_OPTIONS, trendDayLabel } from '../domain/trends';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import type { ForgeTheme, MuscleHeatmapView, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'MuscleHeatmapDetail'>;

const WINDOWS = TREND_DAY_OPTIONS;

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const int = parseInt(h, 16);
  const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function MuscleHeatmapDetailScreen({ navigation }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { completedWorkouts } = useWorkouts();
  const { preferences, updatePreferences } = useSettings();
  const view = preferences.muscleHeatmap;
  const { windowDays, gender, breakdown } = view;
  const [editing, setEditing] = useState(false);
  const [elevated, setElevated] = useState(false);
  const accent = HEATMAP_ACCENT;
  const setView = (patch: Partial<MuscleHeatmapView>) => {
    selectionHaptic();
    updatePreferences({ muscleHeatmap: { ...view, ...patch } });
  };

  const { heat, ranking } = useMemo(() => {
    const now = new Date();
    const weeks = Math.ceil(windowDays / 7);
    const balance = breakdown === 'muscle'
      ? muscleBalanceByMuscle(completedWorkouts, weeks, now, MUSCLES_BY_GROUP.flatMap((s) => s.slugs)).filter((r) => r.sets > 0)
      : muscleBalance(completedWorkouts, weeks, now);
    return {
      heat: muscleHeatBySlug(completedWorkouts, windowDays, now),
      ranking: [...balance].sort((a, b) => b.sets - a.sets),
    };
  }, [completedWorkouts, windowDays, breakdown]);

  const maxSets = Math.max(1, ...ranking.map((r) => r.sets));
  const anyData = Object.values(heat).some((v) => v > 0);

  function Segmented<T>({ options, value, onChange, format }: { options: readonly T[]; value: T; onChange: (v: T) => void; format: (v: T) => string }) {
    return (
      <View style={styles.segmented}>
        {options.map((opt) => {
          const active = opt === value;
          return (
            <Pressable
              key={String(opt)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={format(opt)}
              onPress={() => onChange(opt)}
              style={({ pressed }) => [styles.segment, { backgroundColor: active ? theme.selectionIndicator : theme.surfaceMuted }, pressed && !active && pressedFeedback]}
            >
              <Text style={[styles.segmentText, { color: active ? (theme.onActionPrimary ?? theme.surface) : theme.slate }]}>{format(opt)}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={styles.screen}>
        <SettingsDetailHeader
          title="Muscle heatmap"
          navigation={navigation}
          elevated={elevated}
          rightAction={
            <HeaderAction
              accessibilityLabel={editing ? 'Done editing' : 'Edit view'}
              icon={editing ? 'check' : 'note'}
              iconSize={editing ? 22 : 20}
              iconOnly
              variant="ghost"
              onPress={() => { selectionHaptic(); setEditing((e) => !e); }}
            />
          }
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: 24 + bottomInset }]}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => setElevated(e.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
        >
          {editing ? (
            <ForgeCard style={styles.controlsCard}>
              <Text style={styles.controlLabel}>Window</Text>
              <Segmented options={WINDOWS} value={windowDays} onChange={(v) => setView({ windowDays: v })} format={(v) => trendDayLabel(v)} />
              <Text style={styles.controlLabel}>Body model</Text>
              <Segmented options={['male', 'female'] as const} value={gender} onChange={(v) => setView({ gender: v })} format={(v) => (v === 'male' ? 'Male' : 'Female')} />
              <Text style={styles.controlLabel}>Working sets</Text>
              <Segmented options={['group', 'muscle'] as const} value={breakdown} onChange={(v) => setView({ breakdown: v })} format={(v) => (v === 'group' ? 'Groups' : 'Muscles')} />
            </ForgeCard>
          ) : null}

          <ForgeCard style={styles.figuresCard}>
            {anyData ? (
              <>
                <View style={styles.figures}>
                  <View style={styles.figureCol}>
                    <MuscleMap heat={heat} side="front" color={accent} height={300} gender={gender} />
                    <Text style={styles.figureLabel}>Front</Text>
                  </View>
                  <View style={styles.figureCol}>
                    <MuscleMap heat={heat} side="back" color={accent} height={300} gender={gender} />
                    <Text style={styles.figureLabel}>Back</Text>
                  </View>
                </View>
                <View style={styles.legend}>
                  <Text style={styles.sub}>Low</Text>
                  {[0.16, 0.4, 0.64, 0.85, 1].map((a) => (
                    <View key={a} style={[styles.legendChip, { backgroundColor: hexToRgba(accent, a) }]} />
                  ))}
                  <Text style={styles.sub}>High</Text>
                </View>
              </>
            ) : (
              <Text style={styles.empty}>Train to light up your muscle map for this window.</Text>
            )}
          </ForgeCard>

          <ForgeCard style={styles.rankCard}>
            <Text style={styles.rankTitle}>Working sets by {breakdown === 'muscle' ? 'muscle' : 'group'}</Text>
            {ranking.length ? ranking.map((r, i) => (
              <View key={`${r.label}-${i}`} style={styles.rankRow}>
                <View style={[styles.rankDot, { backgroundColor: MUSCLE_GROUP_COLORS[r.group] }]} />
                <Text style={styles.rankLabel} numberOfLines={1}>{breakdown === 'muscle' ? r.label : r.group}</Text>
                <View style={[styles.rankTrack, { backgroundColor: theme.surfaceMuted }]}>
                  <View style={[styles.rankFill, { width: `${Math.round((r.sets / maxSets) * 100)}%`, backgroundColor: MUSCLE_GROUP_COLORS[r.group] }]} />
                </View>
                <Text style={styles.rankValue}>{r.sets}</Text>
              </View>
            )) : (
              <Text style={styles.sub}>No sets logged in this window.</Text>
            )}
          </ForgeCard>
        </ScrollView>
      </View>
    </AppScreen>
  );
}

const createStyles = (theme: ForgeTheme) => StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  segmented: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segmentText: { ...typeScale.controlLabel },
  controlsCard: { padding: 16, gap: 8 },
  controlLabel: { ...typeScale.caption, color: theme.textSecondary, letterSpacing: 0.6, marginTop: 4 },
  figuresCard: { padding: 16, gap: 12 },
  figures: { flexDirection: 'row', gap: 8 },
  figureCol: { flex: 1, alignItems: 'center', gap: 4 },
  figureLabel: { color: theme.slate, ...typeScale.caption },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  legendChip: { width: 16, height: 16, borderRadius: 4 },
  sub: { color: theme.muted, ...typeScale.caption },
  empty: { color: theme.muted, textAlign: 'center', paddingVertical: 40, ...typeScale.body },
  rankCard: { padding: 16, gap: 12 },
  rankHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rankTitle: { color: theme.ink, ...typeScale.controlLabel },
  breakdownToggle: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 11, backgroundColor: theme.surfaceMuted },
  breakdownSeg: { paddingHorizontal: 12, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  breakdownText: { ...typeScale.caption, fontWeight: '700' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankDot: { width: 10, height: 10, borderRadius: 5 },
  rankLabel: { width: 74, color: theme.slate, ...typeScale.caption },
  rankTrack: { flex: 1, height: 10, borderRadius: 999, overflow: 'hidden' },
  rankFill: { height: '100%', borderRadius: 999 },
  rankValue: { width: 26, textAlign: 'right', color: theme.ink, fontVariant: ['tabular-nums'], ...typeScale.caption },
});
