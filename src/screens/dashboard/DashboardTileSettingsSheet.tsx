import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeSheetHeader,
  ForgeText as Text,
  pressedFeedback,
  selectionHaptic,
} from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { Icon } from '../../components/ui';
import { MUSCLES_BY_GROUP, MUSCLE_LABELS } from '../../domain/dashboard/widgetMetrics';
import { TREND_DAY_OPTIONS, trendDayLabel } from '../../domain/trends';
import { MUSCLE_GROUP_COLORS } from './DashboardWidgetTiles';
import type { DailyMeasurementDefinition, ForgeTheme, WorkoutTypePreference } from '../../types';
import {
  DASHBOARD_TILE_DEFAULT_TITLE,
  tileSettings,
  type DashboardTileConfig,
  type DashboardTileKind,
  type DashboardTileSettings,
} from '../../state/dashboardLayout';

/** A row of exclusive chips (e.g. a trend window). */
function Segmented<T extends number>({
  options, value, format, onSelect,
}: { options: T[]; value: T; format: (v: T) => string; onSelect: (v: T) => void }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={format(option)}
            accessibilityState={{ selected: active }}
            onPress={() => { selectionHaptic(); onSelect(option); }}
            style={({ pressed }) => [
              styles.segment,
              { backgroundColor: active ? theme.selectionIndicator : theme.surface },
              pressed && !active && pressedFeedback,
            ]}
          >
            <Text style={[styles.segmentText, { color: active ? (theme.onActionPrimary ?? theme.surface) : theme.slate }]}>
              {format(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) { selectionHaptic(); onChange(next); }
  };
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} onPress={() => step(-1)} style={({ pressed }) => [styles.stepBtn, pressed && pressedFeedback]}>
          <Text style={[styles.stepGlyph, { color: value <= min ? theme.textDisabled : theme.ink }]}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{value === 0 ? '—' : value}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} onPress={() => step(1)} style={({ pressed }) => [styles.stepBtn, pressed && pressedFeedback]}>
          <Text style={[styles.stepGlyph, { color: value >= max ? theme.textDisabled : theme.ink }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const WINDOW_DAYS: Partial<Record<DashboardTileKind, number[]>> = {
  'rest-stats': [...TREND_DAY_OPTIONS],
  'muscle-heatmap': [...TREND_DAY_OPTIONS],
  measurement: [...TREND_DAY_OPTIONS],
  measurements: [...TREND_DAY_OPTIONS],
};

const WINDOW_WEEKS: Partial<Record<DashboardTileKind, number[]>> = {
  volume: [8, 12, 26],
  'muscle-balance': [4, 8, 12],
  consistency: [8, 16, 26],
};

/** A titled card that groups one setting, giving the sheet clear structure. */
function GroupCard({ title, hint, accent, trailing, children }: { title: string; hint?: string; accent?: string; trailing?: React.ReactNode; children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        {accent ? <View style={[styles.cardDot, { backgroundColor: accent }]} /> : null}
        <Text style={styles.cardTitle}>{title}</Text>
        {trailing ? <View style={styles.cardHeadTrailing}>{trailing}</View> : null}
      </View>
      {hint ? <Text style={styles.cardHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

/** A tappable toggle row (check for multi, dot for single) used inside a card. */
function ToggleRow({
  label, color, selected, onToggle, showDivider,
}: { label: string; color?: string; selected: boolean; onToggle: () => void; showDivider?: boolean }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={() => { selectionHaptic(); onToggle(); }}
      style={({ pressed }) => [styles.toggleRow, showDivider && styles.rowDivider, pressed && pressedFeedback]}
    >
      {color ? <View style={[styles.metricDot, { backgroundColor: color }]} /> : null}
      <Text style={styles.metricName} numberOfLines={1}>{label}</Text>
      <View style={[styles.metricCheck, { borderColor: selected ? theme.selectionIndicator : theme.border, backgroundColor: selected ? theme.selectionIndicator : 'transparent' }]}>
        {selected ? <Icon name="check" size={13} color={theme.onActionPrimary ?? theme.surface} weight="bold" /> : null}
      </View>
    </Pressable>
  );
}

export function DashboardTileSettingsSheet({
  config,
  workoutTypes,
  measurements,
  onChange,
  onClose,
}: {
  config: DashboardTileConfig | null;
  workoutTypes: WorkoutTypePreference[];
  measurements: DailyMeasurementDefinition[];
  onChange: (settings: DashboardTileSettings) => void;
  onClose: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const kind = config?.kind;
  const settings = config ? tileSettings(config) : {};
  const patch = (next: Partial<DashboardTileSettings>) => onChange({ ...settings, ...next });

  const dayOptions = kind ? WINDOW_DAYS[kind] : undefined;
  const weekOptions = kind ? WINDOW_WEEKS[kind] : undefined;
  const selectedIds = settings.measurementIds ?? [];

  return (
    <ForgeBottomSheet
      visible={config !== null}
      onClose={onClose}
      accessibilityLabel="Close card settings"
      initialOffset={360}
      waitForContentLayoutBeforeEnter
    >
      <ForgeBottomSheetHandle />
      <ForgeSheetHeader
        title={config?.title ?? (kind ? DASHBOARD_TILE_DEFAULT_TITLE[kind] : 'Settings')}
        compactTitle
        onClose={onClose}
      />
      <View style={styles.headerDivider} />
      {/* Direct child ScrollView (not wrapped in an extra flex View) so the sheet
          surface caps it and it hugs-then-scrolls without dead space. See ADR 0005
          and PreviousSessionsContent. */}
      <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {kind === 'muscle-heatmap' && dayOptions ? (
              <GroupCard title="Display">
                <Text style={styles.subLabel}>Trend window</Text>
                <Segmented options={dayOptions} value={settings.windowDays ?? dayOptions[0]} format={trendDayLabel} onSelect={(v) => patch({ windowDays: v })} />
                <Text style={styles.subLabel}>Body model</Text>
                <View style={styles.chipWrap}>
                  {(['male', 'female'] as const).map((g) => {
                    const active = (settings.gender ?? 'male') === g;
                    return (
                      <Pressable
                        key={g}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        accessibilityLabel={g === 'male' ? 'Male' : 'Female'}
                        onPress={() => { selectionHaptic(); patch({ gender: g }); }}
                        style={({ pressed }) => [styles.chip, active ? { backgroundColor: theme.selectionIndicator, borderColor: theme.selectionIndicator } : { borderColor: theme.border }, pressed && pressedFeedback]}
                      >
                        <Text style={[styles.chipText, { color: active ? (theme.onActionPrimary ?? theme.surface) : theme.slate }]}>{g === 'male' ? 'Male' : 'Female'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </GroupCard>
            ) : dayOptions ? (
              <GroupCard title="Trend window">
                <Segmented options={dayOptions} value={settings.windowDays ?? dayOptions[0]} format={trendDayLabel} onSelect={(v) => patch({ windowDays: v })} />
              </GroupCard>
            ) : null}
            {weekOptions ? (
              <GroupCard title="Window">
                <Segmented options={weekOptions} value={settings.windowWeeks ?? weekOptions[0]} format={(v) => `${v} weeks`} onSelect={(v) => patch({ windowWeeks: v })} />
              </GroupCard>
            ) : null}
            {kind === 'measurement' ? (
              <GroupCard title="Metric" hint={measurements.length ? undefined : 'Add measurements in the More tab first.'}>
                {measurements.map((def, i) => (
                  <ToggleRow
                    key={def.id}
                    label={def.name}
                    color={def.color || theme.slate}
                    selected={settings.measurementId === def.id}
                    onToggle={() => patch({ measurementId: def.id })}
                    showDivider={i > 0}
                  />
                ))}
              </GroupCard>
            ) : null}
            {kind === 'measurements' ? (
              <GroupCard title="Metrics to show" hint={measurements.length ? 'Pick the metrics this card charts together.' : 'Add measurements in the More tab first.'}>
                {measurements.map((def, i) => (
                  <ToggleRow
                    key={def.id}
                    label={def.name}
                    color={def.color || theme.slate}
                    selected={selectedIds.includes(def.id)}
                    onToggle={() => {
                      const next = selectedIds.includes(def.id)
                        ? selectedIds.filter((id) => id !== def.id)
                        : [...selectedIds, def.id];
                      patch({ measurementIds: next });
                    }}
                    showDivider={i > 0}
                  />
                ))}
              </GroupCard>
            ) : null}
            {kind === 'muscle-balance' ? (
              <>
                <Text style={styles.sectionIntro}>Tap muscles to chart them on their own. With none picked, the card shows the six groups.</Text>
                {MUSCLES_BY_GROUP.map((section) => {
                  const filter = settings.muscleFilter ?? [];
                  const groupColor = MUSCLE_GROUP_COLORS[section.group];
                  const toggle = (slug: string) => {
                    selectionHaptic();
                    patch({ muscleFilter: filter.includes(slug) ? filter.filter((s) => s !== slug) : [...filter, slug] });
                  };
                  // A group that is a single muscle (e.g. Chest) toggles as one
                  // card — no chip that just repeats the group name.
                  if (section.slugs.length === 1) {
                    const slug = section.slugs[0];
                    const selected = filter.includes(slug);
                    return (
                      <Pressable
                        key={section.group}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={section.group}
                        onPress={() => toggle(slug)}
                        style={({ pressed }) => [styles.card, styles.soloCard, pressed && pressedFeedback]}
                      >
                        <View style={[styles.cardDot, { backgroundColor: groupColor }]} />
                        <Text style={[styles.cardTitle, { flex: 1 }]}>{section.group}</Text>
                        <View style={[styles.soloCheck, selected ? { backgroundColor: groupColor, borderColor: groupColor } : { borderColor: theme.border }]}>
                          {selected ? <Icon name="check" size={13} color="#FFFFFF" weight="bold" /> : null}
                        </View>
                      </Pressable>
                    );
                  }
                  const count = section.slugs.filter((slug) => filter.includes(slug)).length;
                  return (
                    <GroupCard
                      key={section.group}
                      title={section.group}
                      accent={groupColor}
                      trailing={count ? <Text style={[styles.groupCount, { color: groupColor }]}>{count}</Text> : null}
                    >
                      <View style={styles.chipWrap}>
                        {section.slugs.map((slug) => {
                          const selected = filter.includes(slug);
                          return (
                            <Pressable
                              key={slug}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: selected }}
                              accessibilityLabel={MUSCLE_LABELS[slug] ?? slug}
                              onPress={() => toggle(slug)}
                              style={({ pressed }) => [
                                styles.chip,
                                selected ? { backgroundColor: groupColor, borderColor: groupColor } : { borderColor: theme.border },
                                pressed && pressedFeedback,
                              ]}
                            >
                              <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : theme.slate }]}>{MUSCLE_LABELS[slug] ?? slug}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </GroupCard>
                  );
                })}
              </>
            ) : null}
            {kind === 'streak' ? (
              <>
                <GroupCard title="Weekly goal" hint="Or set targets per workout type below — those override this goal.">
                  <Stepper label="Workouts / week" value={settings.weeklyTargetDefault ?? 3} min={1} max={7} onChange={(v) => patch({ weeklyTargetDefault: v })} />
                </GroupCard>
                {workoutTypes.length ? (
                  <GroupCard title="Per workout type">
                    {workoutTypes.map((type, i) => (
                      <View key={type.id} style={i > 0 ? styles.rowDivider : undefined}>
                        <Stepper
                          label={type.name}
                          value={settings.weeklyTargets?.[type.name] ?? 0}
                          min={0}
                          max={7}
                          onChange={(v) => {
                            const nextTargets = { ...(settings.weeklyTargets ?? {}) };
                            if (v <= 0) delete nextTargets[type.name];
                            else nextTargets[type.name] = v;
                            patch({ weeklyTargets: nextTargets });
                          }}
                        />
                      </View>
                    ))}
                  </GroupCard>
                ) : null}
              </>
            ) : null}
      </ScrollView>
    </ForgeBottomSheet>
  );
}

const createStyles = (theme: ForgeTheme) => StyleSheet.create({
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider, marginBottom: 4 },
  bodyScroll: { flexShrink: 1 },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40, gap: 12 },
  soloCard: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  soloCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, height: 34, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipText: { ...typeScale.caption, fontWeight: '600' },
  card: { backgroundColor: theme.surfaceMuted, borderRadius: 16, padding: 14, gap: 10 },
  subLabel: { ...typeScale.caption, color: theme.textSecondary },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardDot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { color: theme.ink, ...typeScale.controlLabel, flex: 1 },
  cardHeadTrailing: { flexShrink: 0 },
  groupCount: { ...typeScale.caption, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cardHint: { color: theme.muted, ...typeScale.caption },
  sectionIntro: { color: theme.muted, paddingHorizontal: 2, ...typeScale.caption },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
  segmented: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segmentText: { ...typeScale.label, fontWeight: '600' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  stepperLabel: { flex: 1, color: theme.ink, ...typeScale.label },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 999 },
  stepBtn: { width: 40, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 20, fontWeight: '700', lineHeight: 22 },
  stepValue: { minWidth: 26, textAlign: 'center', color: theme.ink, fontVariant: ['tabular-nums'], ...typeScale.controlLabel },
  metricDot: { width: 10, height: 10, borderRadius: 5 },
  metricName: { flex: 1, color: theme.ink, ...typeScale.label },
  metricCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
