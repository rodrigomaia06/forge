import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { ForgeText as Text, Icon, pressedFeedback, selectionHaptic } from '../../components/ui';
import { ForgeLineChart } from '../../components/charts/ForgeLineChart';
import { MuscleMap } from '../../components/anatomy/MuscleMap';
import { computeWorkoutVolume, formatVolume } from './dashboardSummary';
import { getWorkoutTypePresentation } from '../../domain/workouts/presentation';
import { calendarDateKey } from '../../domain/workouts/calendarDate';
import { trendDayLabel } from '../../domain/trends';
import { useForgeReducedMotion } from '../../theme/motion';
import { useTileChrome, tileHeaderRightInset } from './tileChrome';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { DailyMeasurementDefinition, ForgeTheme, IconName, Workout, WorkoutTypePreference } from '../../types';
import { measurementSeries, type MeasurementSeries, type MuscleBalanceEntry, type MuscleGroup, type RestStats, type Consistency, type StreakStats, type VolumeSeries } from '../../domain/dashboard/widgetMetrics';

/** #rrggbb (or #rgb) → rgba() so a heat step blends over the card surface. */
function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const int = parseInt(h, 16);
  if (Number.isNaN(int) || h.length !== 6) return hex;
  const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Shared tile header: leading icon + title, with a trailing slot. The trailing
 * slot only reserves room for the edit-mode gear when that gear is actually
 * shown, so labels like "14d" sit at the card edge when not editing. */
function TileHead({ icon, title, trailing }: { icon: IconName; title: string; trailing?: React.ReactNode }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const inset = tileHeaderRightInset(useTileChrome());
  return (
    <View style={[styles.head, { paddingRight: inset }]}>
      <View style={styles.headTitle}>
        <Icon name={icon} size={19} color={theme.slate} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {trailing ? <View style={styles.headTrailing}>{trailing}</View> : null}
    </View>
  );
}

/** A consistent, centered empty state for tiles with no data yet. */
function TileEmpty({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.tileEmpty}>
      <View style={styles.tileEmptyIcon}><Icon name={icon} size={22} color={theme.slate} /></View>
      <Text style={styles.tileEmptyTitle}>{title}</Text>
      {hint ? <Text style={styles.tileEmptyHint}>{hint}</Text> : null}
    </View>
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
      <TileHead icon="stopwatch-outline" title="Rest timer" trailing={<Text style={styles.sub}>{trendDayLabel(windowDays)}</Text>} />
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
            <View style={styles.sparkWrap}><ForgeLineChart data={stats.recent.map((v) => ({ value: v }))} height={46} color={theme.slate} showMarkers={stats.recent.length <= 10} /></View>
          ) : null}
        </>
      ) : (
        <TileEmpty icon="stopwatch-outline" title="No rest recorded yet" hint="Rest timers you use during workouts show up here." />
      )}
    </View>
  );
}

/** Warm "heat" hue for the muscle heatmap intensity ramp. */
export const HEATMAP_ACCENT = '#E85C42';

/** A distinct, on-brand hue per muscle group (from the workout-type palette). */
export const MUSCLE_GROUP_COLORS: Record<MuscleGroup, string> = {
  Chest: '#7C8CF8',
  Back: '#6BD48F',
  Legs: '#F4A261',
  Shoulders: '#B78AF0',
  Arms: '#F27D7D',
  Core: '#4CC3C0',
};

export function DashboardMuscleBalanceTile({ data, windowWeeks }: { data: MuscleBalanceEntry[]; windowWeeks: number }) {
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
            <View key={d.label} style={styles.bar}>
              <Text style={styles.barLabel} numberOfLines={1}>{d.label}</Text>
              <View style={[styles.barTrack, { backgroundColor: theme.surfaceMuted }]}>
                <View style={[styles.barFill, { width: `${Math.round((d.sets / max) * 100)}%`, backgroundColor: MUSCLE_GROUP_COLORS[d.group] }]} />
              </View>
              <Text style={styles.barValue}>{d.sets}</Text>
            </View>
          ))}
        </View>
      ) : (
        <TileEmpty icon="activity" title="No sets logged" hint="Log a few working sets to see your muscle balance." />
      )}
    </View>
  );
}

/** Activity levels for the contribution grid, GitHub-style but Forge green. */
const CONSISTENCY_RAMP = [0.32, 0.55, 0.78, 1] as const;
/** Bucket a day's load into 1..4 relative to the window's busiest day. */
function consistencyLevel(load: number, maxLoad: number): number {
  if (load <= 0) return 0;
  if (maxLoad <= 1) return 4; // a single active day (or all equal) reads as "full"
  const frac = load / maxLoad;
  return Math.min(4, Math.max(1, Math.ceil(frac * 4)));
}

export function DashboardConsistencyTile({ data }: { data: Consistency }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useForgeReducedMotion();
  const activity = theme.success;
  const cellColor = (load: number): string => {
    if (load < 0) return 'transparent'; // future day
    const level = consistencyLevel(load, data.maxDayLoad);
    if (level === 0) return theme.surfaceMuted;
    return hexToRgba(activity, CONSISTENCY_RAMP[level - 1]);
  };
  const monthMarkers: { col: number; label: string }[] = [];
  let prevMonth = -1;
  for (let w = 0; w < data.weeks; w += 1) {
    const month = new Date(data.startTs + w * 7 * 86_400_000).getMonth();
    if (month !== prevMonth) {
      monthMarkers.push({ col: w, label: CAL_MONTHS[month].slice(0, 3) });
      prevMonth = month;
    }
  }
  return (
    <View style={styles.block}>
      <TileHead
        icon="calendar-outline"
        title="Consistency"
        trailing={<Text style={styles.sub}>{data.weeks}w · {data.sessions}</Text>}
      />
      <View style={styles.calMonths}>
        {monthMarkers.map((m) => (
          <Text key={m.col} style={[styles.calMonthLabel, { left: `${(m.col / data.weeks) * 100}%` }]}>{m.label}</Text>
        ))}
      </View>
      <View style={styles.cal}>
        {Array.from({ length: data.weeks }).map((_, week) => (
          <View key={week} style={styles.calCol}>
            {Array.from({ length: 7 }).map((__, d) => {
              const count = data.cells[week * 7 + d] ?? 0;
              const cellStyle = [
                styles.calCell,
                { backgroundColor: cellColor(count) },
                count < 0 && { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, backgroundColor: 'transparent' },
              ];
              // A soft left-to-right wave as the grid fills in on mount.
              return reducedMotion ? (
                <View key={d} style={cellStyle} />
              ) : (
                <Animated.View key={d} entering={FadeIn.duration(320).delay(week * 16)} style={cellStyle} />
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Text style={styles.sub}>Less</Text>
        <View style={[styles.legendChip, { backgroundColor: theme.surfaceMuted }]} />
        {CONSISTENCY_RAMP.map((a) => (
          <View key={a} style={[styles.legendChip, { backgroundColor: hexToRgba(activity, a) }]} />
        ))}
        <Text style={styles.sub}>More</Text>
      </View>
    </View>
  );
}

/** Warm amber for the streak — reads as momentum/"on a roll". */
const STREAK_ACCENT = '#F4A261';

/** A ring showing this week's progress toward the goal, with the count inside. */
function StreakRing({ count, goal }: { count: number; goal: number }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const size = 66, stroke = 6, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, count / goal) : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.surfaceMuted} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={STREAK_ACCENT}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringLabel}>
        <Text style={styles.ringValue}>{count}/{goal}</Text>
        <Text style={styles.ringUnit}>this wk</Text>
      </View>
    </View>
  );
}

export function DashboardStreakTile({ stats }: { stats: StreakStats }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.block}>
      <TileHead
        icon="energy"
        title="Streak"
        trailing={
          stats.metThisWeek ? (
            <View style={[styles.trendPill, { backgroundColor: hexToRgba(STREAK_ACCENT, 0.16) }]}>
              <Text style={[styles.trendText, { color: STREAK_ACCENT }]}>On track</Text>
            </View>
          ) : null
        }
      />
      <View style={styles.streakRow}>
        <View style={styles.streakLeft}>
          <View style={styles.bigRow}>
            <Text style={[styles.big, { color: STREAK_ACCENT }]}>{stats.streakWeeks}</Text>
            <Text style={styles.unit}>{stats.streakWeeks === 1 ? 'week' : 'weeks'} on goal</Text>
          </View>
          <Text style={styles.sub}>{stats.restDays} rest {stats.restDays === 1 ? 'day' : 'days'} this week</Text>
        </View>
        <StreakRing count={stats.thisWeekCount} goal={stats.thisWeekGoal} />
      </View>
    </View>
  );
}


export function DashboardMuscleHeatmapTile({ heat, windowDays, gender = 'male', onOpen }: { heat: Record<string, number>; windowDays: number; gender?: 'male' | 'female'; onOpen?: () => void }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const color = HEATMAP_ACCENT;
  const any = Object.values(heat).some((v) => v > 0);
  const body = (
    <View style={styles.block}>
      <TileHead
        icon="fitness-outline"
        title="Muscle heatmap"
        trailing={
          <View style={styles.headTrailingRow}>
            <Text style={styles.sub}>volume · {trendDayLabel(windowDays)}</Text>
            {onOpen ? <Icon name="chevron-forward" size={16} color={theme.slate} /> : null}
          </View>
        }
      />
      {any ? (
        <>
          <View style={styles.bodies}>
            <View style={styles.bodyCol}><MuscleMap heat={heat} side="front" color={color} height={180} gender={gender} /></View>
            <View style={styles.bodyCol}><MuscleMap heat={heat} side="back" color={color} height={180} gender={gender} /></View>
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
        <TileEmpty icon="fitness-outline" title="Nothing trained yet" hint="Finish a workout to light up your muscle map." />
      )}
    </View>
  );
  if (!onOpen) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open muscle heatmap" onPress={onOpen} style={({ pressed }) => pressed && pressedFeedback}>
      {body}
    </Pressable>
  );
}

function formatMeasure(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** Brand periwinkle (the app's strength accent) for the volume trend. */
const VOLUME_ACCENT = '#7C8CF8';

export function DashboardVolumeChartTile({ series, windowWeeks }: { series: VolumeSeries; windowWeeks: number }) {
  const styles = useThemedStyles(createStyles);
  const up = series.deltaPct !== null && series.deltaPct >= 0;
  const hasData = series.totalKg > 0;
  return (
    <View style={styles.block}>
      <TileHead icon="activity" title="Training volume" trailing={<Text style={styles.sub}>{windowWeeks}w</Text>} />
      {hasData ? (
        <>
          {series.currentKg > 0 ? (
            <View style={styles.bigRow}>
              <Text style={styles.big}>{formatVolume(series.currentKg)}</Text>
              <Text style={styles.unit}>this week</Text>
              {series.deltaPct !== null && series.deltaPct !== 0 ? (
                <View style={[styles.trendPill, { backgroundColor: hexToRgba(VOLUME_ACCENT, 0.16) }]}>
                  <Icon name={up ? 'arrow-up' : 'arrow-down'} size={13} color={VOLUME_ACCENT} />
                  <Text style={[styles.trendText, { color: VOLUME_ACCENT }]}>{Math.abs(series.deltaPct)}%</Text>
                </View>
              ) : null}
            </View>
          ) : (
            // An empty week isn't zero volume — carry last week forward as context.
            <Text style={styles.volumeIdle}>
              Nothing yet this week{series.previousKg > 0 ? ` · last week ${formatVolume(series.previousKg)}` : ''}
            </Text>
          )}
          <View style={styles.sparkWrap}>
            <ForgeLineChart
              data={series.weeks.map((w) => ({ value: w.volume }))}
              height={78}
              color={VOLUME_ACCENT}
              showMarkers={series.weeks.length <= 14}
            />
          </View>
        </>
      ) : (
        <TileEmpty icon="activity" title="No training logged" hint="Complete a workout to chart your training volume." />
      )}
    </View>
  );
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
  const { editing } = useTileChrome();
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
        trailing={<Text style={styles.sub}>{trendDayLabel(windowDays)}</Text>}
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
            <View style={styles.sparkWrap}><ForgeLineChart data={series.values.map((v) => ({ value: v }))} height={64} color={color} showMarkers={series.values.length <= 12} showTrendLine={series.values.length >= 3} /></View>
          ) : (
            <Text style={styles.sub}>One reading · log more to see a trend</Text>
          )}
        </>
      ) : (
        <Text style={styles.empty}>No readings yet — log your first below</Text>
      )}
      {editing ? null : (
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
      )}
    </View>
  );
}

/** Combined tile: a compact trend row per chosen measurement. */
export function DashboardMeasurementsTile({
  definitions,
  entries,
  windowDays,
  onOpen,
}: {
  definitions: DailyMeasurementDefinition[];
  entries: { definitionId: string; date: string; value: number }[];
  windowDays: number;
  onOpen?: (metricId?: string) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.block}>
      <TileHead
        icon="measure"
        title="Measurements"
        trailing={
          <View style={styles.headTrailingRow}>
            <Text style={styles.sub}>{trendDayLabel(windowDays)}</Text>
            {onOpen ? <Icon name="chevron-forward" size={16} color={theme.slate} /> : null}
          </View>
        }
      />
      {definitions.length ? (
        <View style={styles.mList}>
          {definitions.map((def) => {
            const s = measurementSeries(entries, def.id, windowDays);
            const color = def.color || (theme.selectionIndicator ?? theme.ink);
            const up = s.delta !== null && s.delta > 0;
            return (
              <Pressable
                key={def.id}
                accessibilityRole={onOpen ? 'button' : undefined}
                accessibilityLabel={onOpen ? `Open ${def.name}` : undefined}
                disabled={!onOpen}
                onPress={onOpen ? () => onOpen(def.id) : undefined}
                style={({ pressed }) => [styles.mCard, pressed && onOpen ? pressedFeedback : null]}
              >
                <View style={styles.mCardTop}>
                  <View style={styles.mCardName}>
                    <View style={[styles.mDot, { backgroundColor: color }]} />
                    <Text style={styles.mName} numberOfLines={1}>{def.name}</Text>
                  </View>
                  {s.delta !== null && s.delta !== 0 ? (
                    <View style={[styles.trendPill, { backgroundColor: hexToRgba(color, 0.14) }]}>
                      <Icon name={up ? 'arrow-up' : 'arrow-down'} size={12} color={color} />
                      <Text style={[styles.trendText, { color }]}>{up ? '+' : ''}{formatMeasure(s.delta)}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.mCardValueWrap}>
                  <Text style={styles.mCardValue} numberOfLines={1}>{s.latest !== null ? formatMeasure(s.latest) : '—'}</Text>
                  {def.unit ? <Text style={styles.mCardUnit}>{def.unit}</Text> : null}
                </View>
                {s.values.length >= 2 ? (
                  <View style={styles.mCardSpark}>
                    <ForgeLineChart data={s.values.map((v) => ({ value: v }))} height={40} color={color} showMarkers={false} />
                  </View>
                ) : (
                  <Text style={styles.mCardHint}>{s.latest !== null ? 'Log more for a trend' : 'No readings yet'}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Pressable
          accessibilityRole={onOpen ? 'button' : undefined}
          accessibilityLabel={onOpen ? 'Open measurements' : undefined}
          disabled={!onOpen}
          onPress={onOpen ? () => onOpen() : undefined}
          style={({ pressed }) => [styles.mEmpty, pressed && onOpen ? pressedFeedback : null]}
        >
          <View style={styles.mEmptyIcon}><Icon name="measure" size={22} color={theme.slate} /></View>
          <Text style={styles.mEmptyTitle}>No metrics chosen</Text>
          <Text style={styles.mEmptyBody}>Open the card settings to pick which measurements it shows.</Text>
        </Pressable>
      )}
    </View>
  );
}

/** A free-text sticky note. Editable inline when the dashboard isn't in edit
 * (reorder) mode; read-only while editing so a drag never starts a keyboard. */
export function DashboardNoteTile({ text, onChange }: { text: string; onChange: (text: string) => void }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { editing } = useTileChrome();
  const [draft, setDraft] = React.useState(text);
  // Adopt an external change (e.g. a fresh tile) only while not actively typing.
  React.useEffect(() => { setDraft(text); }, [text]);
  return (
    <View style={styles.block}>
      <TileHead icon="note" title="Note" />
      <TextInput
        style={styles.noteInput}
        value={draft}
        onChangeText={(next) => { setDraft(next); onChange(next); }}
        editable={!editing}
        multiline
        scrollEnabled={false}
        textAlignVertical="top"
        placeholder="Jot a goal, a cue, a reminder…"
        placeholderTextColor={theme.muted}
      />
    </View>
  );
}

const CAL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CAL_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function calMonthWeeks(year: number, month: number, weekStart: number): (number | null)[][] {
  const firstWeekday = (new Date(year, month, 1).getDay() - weekStart + 7) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
function formatCalDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}mins`;
  return `${Math.floor(m / 60)}h ${m % 60}mins`;
}

/** A month-at-a-glance tile: a mini calendar of trained days plus month totals.
 * Tapping it opens the full Calendar page. */
export function DashboardCalendarTile({
  workouts,
  workoutTypes,
  weekStart = 1,
  onOpen,
}: {
  workouts: Workout[];
  workoutTypes: WorkoutTypePreference[];
  weekStart?: number;
  onOpen?: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDate = now.getDate();

  const { colorByDay, count, seconds, volume } = React.useMemo(() => {
    const colorByDay = new Map<number, string>();
    let count = 0, seconds = 0, volume = 0;
    for (const w of workouts) {
      const d = new Date(w.completedAt ?? w.startedAt);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      count += 1;
      seconds += w.durationSeconds ?? 0;
      volume += computeWorkoutVolume(w);
      if (!colorByDay.has(d.getDate())) {
        colorByDay.set(d.getDate(), getWorkoutTypePresentation(w.type, workoutTypes, theme, 0.16).color);
      }
    }
    return { colorByDay, count, seconds, volume };
  }, [workouts, workoutTypes, year, month, theme]);

  const weeks = calMonthWeeks(year, month, weekStart);
  const letters = Array.from({ length: 7 }, (_, i) => CAL_WEEK[(weekStart + i) % 7]);

  return (
    <Pressable
      accessibilityRole={onOpen ? 'button' : undefined}
      accessibilityLabel={onOpen ? 'Open calendar' : undefined}
      disabled={!onOpen}
      onPress={onOpen}
      style={({ pressed }) => [styles.calRow, pressed && onOpen ? pressedFeedback : null]}
    >
      <View style={styles.calLeft}>
        <Text style={styles.calMonth}>{CAL_MONTHS[month]}</Text>
        <View style={styles.calGridHead}>
          {letters.map((l, i) => <Text key={i} style={styles.calGridHeadText}>{l}</Text>)}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.calGridRow}>
            {week.map((day, di) => {
              const color = day ? colorByDay.get(day) : undefined;
              const isToday = day === todayDate;
              return (
                <View key={di} style={styles.calGridCell}>
                  {day ? (
                    <View style={[styles.calDot, color ? { backgroundColor: color } : null, isToday && !color ? { borderWidth: 1, borderColor: theme.border } : null]}>
                      <Text style={[styles.calDayNum, color ? styles.calDayNumOn : null]}>{day}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.calRight}>
        <View style={styles.calStat}><Text style={styles.calStatValue}>{count}</Text><Text style={styles.calStatLabel}>Workouts</Text></View>
        <View style={styles.calStat}><Text style={styles.calStatValue}>{formatCalDuration(seconds)}</Text><Text style={styles.calStatLabel}>Duration</Text></View>
        <View style={styles.calStat}><Text style={styles.calStatValue}>{formatVolume(volume)}</Text><Text style={styles.calStatLabel}>Volume</Text></View>
      </View>
      {onOpen ? <Icon name="chevron-forward" size={16} color={theme.muted} /> : null}
    </Pressable>
  );
}

const createStyles = (theme: ForgeTheme) => StyleSheet.create({
  block: { gap: 10 },
  calRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  calLeft: { flex: 1.4, minWidth: 0 },
  calMonth: { color: theme.ink, ...typeScale.controlLabel, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  calGridHead: { flexDirection: 'row' },
  calGridHeadText: { flex: 1, textAlign: 'center', color: theme.muted, fontSize: 10, lineHeight: 14 },
  calGridRow: { flexDirection: 'row' },
  calGridCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 1 },
  calDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  calDayNum: { color: theme.slate, fontSize: 10, lineHeight: 12, fontVariant: ['tabular-nums'] },
  calDayNumOn: { color: '#FFFFFF', fontWeight: '700' },
  calRight: { flex: 0.9, gap: 12, paddingLeft: 2 },
  calStat: { gap: 1 },
  calStatValue: { color: theme.ink, ...typeScale.cardTitle, fontVariant: ['tabular-nums'] },
  calStatLabel: { color: theme.muted, ...typeScale.caption },
  noteInput: { minHeight: 24, color: theme.ink, ...typeScale.body, lineHeight: 22, padding: 0, margin: 0 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 1 },
  headTrailing: { flexShrink: 0 },
  headTrailingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { color: theme.ink, ...typeScale.controlLabel },
  sub: { color: theme.muted, ...typeScale.caption },
  empty: { color: theme.muted, ...typeScale.body },
  tileEmpty: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 20 },
  tileEmptyIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted },
  tileEmptyTitle: { color: theme.ink, ...typeScale.controlLabel },
  tileEmptyHint: { color: theme.muted, ...typeScale.caption, textAlign: 'center', maxWidth: 240 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { color: theme.ink, fontVariant: ['tabular-nums'], fontSize: 32, fontWeight: '800', letterSpacing: -0.5, lineHeight: 34 },
  unit: { color: theme.muted, ...typeScale.label },
  streakRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  streakLeft: { flex: 1, gap: 4 },
  ringLabel: { position: 'absolute', alignItems: 'center' },
  ringValue: { color: theme.ink, fontVariant: ['tabular-nums'], ...typeScale.controlLabel },
  ringUnit: { color: theme.muted, fontSize: 10, lineHeight: 12 },
  sparkWrap: { marginTop: 2 },
  bars: { gap: 8 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 80, color: theme.slate, ...typeScale.caption },
  barTrack: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  barValue: { width: 26, textAlign: 'right', color: theme.ink, fontVariant: ['tabular-nums'], ...typeScale.caption },
  // Columns flex to fill the width but a maxWidth caps each cell, so a short
  // window (8 weeks) keeps small, tidy squares instead of stretching them large,
  // while a long window (26 weeks) shrinks to fit. The row centres either way.
  calMonths: { height: 13, position: 'relative', marginBottom: 2 },
  calMonthLabel: { position: 'absolute', top: 0, fontSize: 9, lineHeight: 12, color: theme.muted },
  cal: { flexDirection: 'row', gap: 4, justifyContent: 'center' },
  calCol: { flex: 1, maxWidth: 14, gap: 4 },
  calCell: { width: '100%', aspectRatio: 1, borderRadius: 3 },
  bodies: { flexDirection: 'row', gap: 8 },
  bodyCol: { flex: 1, alignItems: 'center', gap: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' },
  legendChip: { width: 13, height: 13, borderRadius: 3 },
  volumeIdle: { color: theme.slate, ...typeScale.label },
  mList: { gap: 10 },
  mDot: { width: 8, height: 8, borderRadius: 4 },
  mName: { color: theme.ink, flexShrink: 1, ...typeScale.label },
  mCard: { backgroundColor: theme.surfaceMuted, borderRadius: 14, padding: 12, gap: 8 },
  mCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mCardName: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  mCardValueWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  mCardValue: { color: theme.ink, fontVariant: ['tabular-nums'], fontSize: 24, fontWeight: '800', letterSpacing: -0.4, lineHeight: 26 },
  mCardUnit: { color: theme.muted, ...typeScale.caption },
  mCardSpark: { marginTop: 2 },
  mCardHint: { color: theme.muted, ...typeScale.caption },
  mEmpty: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 20 },
  mEmptyIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted },
  mEmptyTitle: { color: theme.ink, ...typeScale.controlLabel },
  mEmptyBody: { color: theme.muted, ...typeScale.caption, textAlign: 'center', maxWidth: 240 },
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
