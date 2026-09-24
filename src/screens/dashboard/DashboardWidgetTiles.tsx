import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Polyline, Rect, Stop } from 'react-native-svg';

import { ForgeText as Text, Icon, pressedFeedback, selectionHaptic } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { DailyMeasurementDefinition, ForgeTheme, IconName } from '../../types';
import { MUSCLE_GROUPS, type MeasurementSeries, type MuscleGroup, type RestStats, type Consistency, type StreakStats } from '../../domain/dashboard/widgetMetrics';

/** #rrggbb (or #rgb) → rgba() so a heat step blends over the card surface. */
function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const int = parseInt(h, 16);
  if (Number.isNaN(int) || h.length !== 6) return hex;
  const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Shared tile header: leading icon + title, with a trailing slot. */
function TileHead({ icon, title, trailing }: { icon: IconName; title: string; trailing?: React.ReactNode }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.head}>
      <View style={styles.headTitle}>
        <Icon name={icon} size={19} color={theme.slate} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {trailing ? <View style={styles.headTrailing}>{trailing}</View> : null}
    </View>
  );
}

/** A compact area sparkline (oldest → newest) with an emphasised endpoint. */
export function WidgetSparkline({ values, height = 42, color }: { values: number[]; height?: number; color?: string }) {
  const theme = useForgeTheme();
  const stroke = color ?? theme.selectionIndicator ?? theme.ink;
  const width = 260;
  const gid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  if (values.length < 2) return <View style={{ height }} />;
  const min = Math.min(...values), max = Math.max(...values), pad = 4;
  const xs = values.map((_, i) => pad + (i * (width - 2 * pad)) / (values.length - 1));
  const ys = values.map((v) => height - pad - (max === min ? 0.5 : (v - min) / (max - min)) * (height - 2 * pad));
  const line = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const area = `M${xs[0].toFixed(1)},${height} L${xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' L')} L${xs[xs.length - 1].toFixed(1)},${height} Z`;
  return (
    <Svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity={0.2} />
          <Stop offset="1" stopColor={stroke} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill={`url(#${gid})`} />
      <Polyline points={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3.2} fill={stroke} />
    </Svg>
  );
}

function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function formatMinutes(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function DashboardRestStatsTile({ stats, windowDays }: { stats: RestStats; windowDays: number }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.block}>
      <TileHead icon="stopwatch-outline" title="Rest timer" trailing={<Text style={styles.sub}>{windowDays}d</Text>} />
      {stats.avgRestSeconds !== null ? (
        <>
          <View style={styles.bigRow}>
            <Text style={styles.big}>{formatRest(stats.avgRestSeconds)}</Text>
            <Text style={styles.unit}>avg rest</Text>
            {stats.deltaSeconds !== null && stats.deltaSeconds !== 0 ? (
              <View style={[styles.trendPill, { backgroundColor: theme.surfaceMuted }]}>
                <Icon name={stats.deltaSeconds > 0 ? 'arrow-up' : 'arrow-down'} size={13} color={theme.slate} />
                <Text style={[styles.trendText, { color: theme.slate }]}>
                  {formatRest(Math.abs(stats.deltaSeconds))}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.sub}>{formatMinutes(stats.totalRestSeconds)} resting · {stats.sessions} sessions</Text>
          {stats.recent.length >= 2 ? (
            <View style={styles.sparkWrap}><WidgetSparkline values={stats.recent} color={theme.slate} /></View>
          ) : null}
        </>
      ) : (
        <Text style={styles.empty}>No rest recorded yet</Text>
      )}
    </View>
  );
}

export function DashboardMuscleBalanceTile({ data, windowWeeks }: { data: { group: MuscleGroup; sets: number }[]; windowWeeks: number }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const max = Math.max(1, ...data.map((d) => d.sets));
  const total = data.reduce((sum, d) => sum + d.sets, 0);
  return (
    <View style={styles.block}>
      <TileHead icon="activity" title="Muscle balance" trailing={<Text style={styles.sub}>sets · {windowWeeks}w</Text>} />
      {total > 0 ? (
        <View style={styles.bars}>
          {data.map((d) => (
            <View key={d.group} style={styles.bar}>
              <Text style={styles.barLabel} numberOfLines={1}>{d.group}</Text>
              <View style={[styles.barTrack, { backgroundColor: theme.surfaceMuted }]}>
                <View style={[styles.barFill, { width: `${Math.round((d.sets / max) * 100)}%`, backgroundColor: theme.selectionIndicator }]} />
              </View>
              <Text style={styles.barValue}>{d.sets}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>Log some sets to see your balance</Text>
      )}
    </View>
  );
}

export function DashboardConsistencyTile({ data }: { data: Consistency }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const accent = theme.selectionIndicator ?? theme.ink;
  const heatColor = (count: number): string => {
    if (count < 0) return 'transparent'; // future day
    if (count === 0) return theme.surfaceMuted;
    return hexToRgba(accent, count >= 2 ? 1 : 0.55);
  };
  return (
    <View style={styles.block}>
      <TileHead icon="time-outline" title="Consistency" trailing={<Text style={styles.sub}>{data.weeks}w · {data.sessions}</Text>} />
      <View style={styles.cal}>
        {Array.from({ length: data.weeks }).map((_, week) => (
          <View key={week} style={styles.calCol}>
            {Array.from({ length: 7 }).map((__, d) => {
              const count = data.cells[week * 7 + d] ?? 0;
              return (
                <View
                  key={d}
                  style={[
                    styles.calCell,
                    { backgroundColor: heatColor(count) },
                    count < 0 && { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, backgroundColor: 'transparent' },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

export function DashboardStreakTile({ stats }: { stats: StreakStats }) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  return (
    <View style={styles.block}>
      <TileHead
        icon="energy"
        title="Streak"
        trailing={<Text style={styles.sub}>{stats.thisWeekCount}/{stats.thisWeekGoal} this wk</Text>}
      />
      <View style={styles.bigRow}>
        <Text style={styles.big}>{stats.streakWeeks}</Text>
        <Text style={styles.unit}>{stats.streakWeeks === 1 ? 'week' : 'weeks'} on goal</Text>
      </View>
      <View style={styles.goalDots}>
        {Array.from({ length: Math.max(stats.thisWeekGoal, stats.thisWeekCount, 1) }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.goalDot,
              { borderColor: theme.border },
              i < stats.thisWeekCount && { backgroundColor: theme.selectionIndicator, borderColor: theme.selectionIndicator },
            ]}
          />
        ))}
        <Text style={[styles.sub, { marginLeft: 6 }]}>{stats.restDays} rest {stats.restDays === 1 ? 'day' : 'days'}</Text>
      </View>
    </View>
  );
}

/** A stylised front/back figure heat-coloured by recent volume per group. */
function MuscleBody({ heat, side, color }: { heat: Record<MuscleGroup, number>; side: 'front' | 'back'; color: string }) {
  const theme = useForgeTheme();
  const fill = (group: MuscleGroup) => hexToRgba(color, 0.12 + heat[group] * 0.88);
  const base = theme.surfaceMuted;
  // region: [x, y, w, h, rx, group?]  (rects); group undefined = neutral base fill
  const rects: [number, number, number, number, number, MuscleGroup?][] = side === 'front'
    ? [
        [24, 22, 22, 3, 2, 'Back'], // upper traps hint
        [20, 26, 12, 12, 4, 'Chest'], [38, 26, 12, 12, 4, 'Chest'],
        [15, 27, 6, 16, 3, 'Shoulders'], [49, 27, 6, 16, 3, 'Shoulders'],
        [16, 33, 5, 12, 2, 'Arms'], [49, 33, 5, 12, 2, 'Arms'],
        [24, 40, 22, 16, 4, 'Core'],
        [24, 62, 9, 34, 5, 'Legs'], [37, 62, 9, 34, 5, 'Legs'],
        [25, 108, 7, 26, 4], [38, 108, 7, 26, 4],
      ]
    : [
        [22, 22, 26, 6, 3, 'Back'],
        [21, 29, 28, 16, 5, 'Back'],
        [15, 27, 6, 16, 3, 'Arms'], [49, 27, 6, 16, 3, 'Arms'],
        [24, 47, 22, 11, 4, 'Back'],
        [24, 60, 22, 12, 6, 'Legs'],
        [24, 74, 9, 26, 5, 'Legs'], [37, 74, 9, 26, 5, 'Legs'],
        [25, 104, 7, 28, 4, 'Legs'], [38, 104, 7, 28, 4, 'Legs'],
      ];
  return (
    <Svg viewBox="0 0 70 140" width="100%" height={132}>
      <Circle cx={35} cy={11} r={6.5} fill={base} />
      {rects.map((r, i) => (
        <Rect key={i} x={r[0]} y={r[1]} width={r[2]} height={r[3]} rx={r[4]} fill={r[5] ? fill(r[5]) : base} />
      ))}
    </Svg>
  );
}

export function DashboardMuscleHeatmapTile({ heat, windowDays }: { heat: Record<MuscleGroup, number>; windowDays: number }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const color = theme.selectionIndicator ?? theme.ink;
  const any = MUSCLE_GROUPS.some((g) => heat[g] > 0);
  return (
    <View style={styles.block}>
      <TileHead icon="fitness-outline" title="Muscle heatmap" trailing={<Text style={styles.sub}>volume · {windowDays}d</Text>} />
      {any ? (
        <>
          <View style={styles.bodies}>
            <View style={styles.bodyCol}><MuscleBody heat={heat} side="front" color={color} /><Text style={styles.sub}>Front</Text></View>
            <View style={styles.bodyCol}><MuscleBody heat={heat} side="back" color={color} /><Text style={styles.sub}>Back</Text></View>
          </View>
          <View style={styles.legend}>
            <Text style={styles.sub}>Low</Text>
            {[0.15, 0.4, 0.65, 1].map((a) => (
              <View key={a} style={[styles.legendChip, { backgroundColor: hexToRgba(color, a) }]} />
            ))}
            <Text style={styles.sub}>High</Text>
          </View>
        </>
      ) : (
        <Text style={styles.empty}>Train to light up your muscle map</Text>
      )}
    </View>
  );
}

function formatMeasure(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function DashboardMeasurementTile({
  definition,
  series,
  windowDays,
  onLog,
}: {
  definition: DailyMeasurementDefinition;
  series: MeasurementSeries;
  windowDays: number;
  onLog: (value: number) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const [draft, setDraft] = React.useState('');
  const color = definition.color || (theme.selectionIndicator ?? theme.ink);
  const unit = definition.unit;
  const up = series.delta !== null && series.delta > 0;

  const commit = () => {
    const parsed = Number(draft.trim().replace(',', '.'));
    if (!draft.trim() || Number.isNaN(parsed)) return;
    selectionHaptic();
    onLog(parsed);
    setDraft('');
  };

  return (
    <View style={styles.block}>
      <TileHead
        icon={definition.icon}
        title={definition.name}
        trailing={<Text style={styles.sub}>{windowDays}d</Text>}
      />
      {series.latest !== null ? (
        <>
          <View style={styles.bigRow}>
            <Text style={styles.big}>{formatMeasure(series.latest)}</Text>
            {unit ? <Text style={styles.unit}>{unit}</Text> : null}
            {series.delta !== null && series.delta !== 0 ? (
              <View style={[styles.trendPill, { backgroundColor: hexToRgba(color, 0.14) }]}>
                <Icon name={up ? 'arrow-up' : 'arrow-down'} size={13} color={color} />
                <Text style={[styles.trendText, { color }]}>
                  {up ? '+' : ''}{formatMeasure(series.delta)}
                </Text>
              </View>
            ) : null}
          </View>
          {series.values.length >= 2 ? (
            <View style={styles.sparkWrap}><WidgetSparkline values={series.values} color={color} /></View>
          ) : (
            <Text style={styles.sub}>One reading · log more to see a trend</Text>
          )}
        </>
      ) : (
        <Text style={styles.empty}>No readings yet — log your first below</Text>
      )}
      <View style={styles.logRow}>
        <View style={[styles.logField, { borderColor: theme.border }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            placeholder={`Log ${definition.name.toLowerCase()}`}
            placeholderTextColor={theme.muted}
            style={styles.logInput}
            onSubmitEditing={commit}
            returnKeyType="done"
          />
          {unit ? <Text style={styles.logUnit}>{unit}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Log ${definition.name}`}
          onPress={commit}
          disabled={!draft.trim()}
          style={({ pressed }) => [
            styles.logButton,
            { backgroundColor: draft.trim() ? theme.selectionIndicator : theme.surfaceMuted },
            pressed && draft.trim() && pressedFeedback,
          ]}
        >
          <Icon name="add" size={18} color={draft.trim() ? (theme.onActionPrimary ?? theme.surface) : theme.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: ForgeTheme) => StyleSheet.create({
  block: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingRight: 26 },
  headTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 1 },
  headTrailing: { flexShrink: 0 },
  title: { color: theme.ink, ...typeScale.controlLabel },
  sub: { color: theme.muted, ...typeScale.caption },
  empty: { color: theme.muted, ...typeScale.body },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { color: theme.ink, fontVariant: ['tabular-nums'], fontSize: 32, fontWeight: '800', letterSpacing: -0.5, lineHeight: 34 },
  unit: { color: theme.muted, ...typeScale.label },
  sparkWrap: { marginTop: 2 },
  bars: { gap: 8 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 66, color: theme.slate, ...typeScale.caption },
  barTrack: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  barValue: { width: 26, textAlign: 'right', color: theme.ink, fontVariant: ['tabular-nums'], ...typeScale.caption },
  cal: { flexDirection: 'row', gap: 3, justifyContent: 'space-between' },
  calCol: { flex: 1, gap: 3 },
  calCell: { width: '100%', aspectRatio: 1, borderRadius: 2.5 },
  goalDots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  bodies: { flexDirection: 'row', gap: 8 },
  bodyCol: { flex: 1, alignItems: 'center', gap: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' },
  legendChip: { width: 13, height: 13, borderRadius: 3 },
  trendPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  trendText: { fontVariant: ['tabular-nums'], ...typeScale.caption },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  logField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: theme.surfaceMuted,
  },
  logInput: { flex: 1, color: theme.ink, padding: 0, ...typeScale.body },
  logUnit: { color: theme.muted, ...typeScale.caption },
  logButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
