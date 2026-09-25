import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen, ForgeCard, ForgeText as Text, pressedFeedback, selectionHaptic } from '../components/ui';
import { SettingsDetailHeader } from './settings/SettingsScreenChrome';
import { MuscleMap } from '../components/anatomy/MuscleMap';
import { HEATMAP_ACCENT, MUSCLE_GROUP_COLORS } from './dashboard/DashboardWidgetTiles';
import { muscleBalance, muscleHeatBySlug } from '../domain/dashboard/widgetMetrics';
import { useWorkouts } from '../state/WorkoutContext';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import type { ForgeTheme, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'MuscleHeatmapDetail'>;

const WINDOWS = [7, 14, 30, 90] as const;

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
  const [windowDays, setWindowDays] = useState<number>(30);
  const [elevated, setElevated] = useState(false);
  const accent = HEATMAP_ACCENT;

  const { heat, ranking } = useMemo(() => {
    const now = new Date();
    const balance = muscleBalance(completedWorkouts, Math.ceil(windowDays / 7), now);
    return {
      heat: muscleHeatBySlug(completedWorkouts, windowDays, now),
      ranking: [...balance].sort((a, b) => b.sets - a.sets),
    };
  }, [completedWorkouts, windowDays]);

  const maxSets = Math.max(1, ...ranking.map((r) => r.sets));
  const anyData = Object.values(heat).some((v) => v > 0);

  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={styles.screen}>
        <SettingsDetailHeader title="Muscle heatmap" navigation={navigation} elevated={elevated} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: 24 + bottomInset }]}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => setElevated(e.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
        >
          <View style={styles.segmented}>
            {WINDOWS.map((days) => {
              const active = days === windowDays;
              return (
                <Pressable
                  key={days}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Last ${days} days`}
                  onPress={() => { selectionHaptic(); setWindowDays(days); }}
                  style={({ pressed }) => [
                    styles.segment,
                    { backgroundColor: active ? theme.selectionIndicator : theme.surfaceMuted },
                    pressed && !active && pressedFeedback,
                  ]}
                >
                  <Text style={[styles.segmentText, { color: active ? (theme.onActionPrimary ?? theme.surface) : theme.slate }]}>
                    {days}d
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ForgeCard style={styles.figuresCard}>
            {anyData ? (
              <>
                <View style={styles.figures}>
                  <View style={styles.figureCol}>
                    <MuscleMap heat={heat} side="front" color={accent} height={300} />
                    <Text style={styles.figureLabel}>Front</Text>
                  </View>
                  <View style={styles.figureCol}>
                    <MuscleMap heat={heat} side="back" color={accent} height={300} />
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
            <Text style={styles.rankTitle}>Working sets by group</Text>
            {ranking.map((r) => (
              <View key={r.group} style={styles.rankRow}>
                <View style={[styles.rankDot, { backgroundColor: MUSCLE_GROUP_COLORS[r.group] }]} />
                <Text style={styles.rankLabel}>{r.group}</Text>
                <View style={[styles.rankTrack, { backgroundColor: theme.surfaceMuted }]}>
                  <View style={[styles.rankFill, { width: `${Math.round((r.sets / maxSets) * 100)}%`, backgroundColor: MUSCLE_GROUP_COLORS[r.group] }]} />
                </View>
                <Text style={styles.rankValue}>{r.sets}</Text>
              </View>
            ))}
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
  figuresCard: { padding: 16, gap: 12 },
  figures: { flexDirection: 'row', gap: 8 },
  figureCol: { flex: 1, alignItems: 'center', gap: 4 },
  figureLabel: { color: theme.slate, ...typeScale.caption },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  legendChip: { width: 16, height: 16, borderRadius: 4 },
  sub: { color: theme.muted, ...typeScale.caption },
  empty: { color: theme.muted, textAlign: 'center', paddingVertical: 40, ...typeScale.body },
  rankCard: { padding: 16, gap: 12 },
  rankTitle: { color: theme.ink, ...typeScale.controlLabel },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankDot: { width: 10, height: 10, borderRadius: 5 },
  rankLabel: { width: 74, color: theme.slate, ...typeScale.caption },
  rankTrack: { flex: 1, height: 10, borderRadius: 999, overflow: 'hidden' },
  rankFill: { height: '100%', borderRadius: 999 },
  rankValue: { width: 26, textAlign: 'right', color: theme.ink, fontVariant: ['tabular-nums'], ...typeScale.caption },
});
