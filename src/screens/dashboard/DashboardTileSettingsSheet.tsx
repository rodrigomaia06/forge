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
              { backgroundColor: active ? theme.selectionIndicator : theme.surfaceMuted },
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
  'rest-stats': [7, 30, 90],
  'muscle-heatmap': [7, 14, 30],
  measurement: [30, 90, 180],
  measurements: [30, 90, 180],
};

/** A tappable metric row with a check (multi) or radio (single) indicator. */
function MetricToggle({
  definition, selected, onToggle,
}: { definition: DailyMeasurementDefinition; selected: boolean; onToggle: () => void }) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={definition.name}
      onPress={() => { selectionHaptic(); onToggle(); }}
      style={({ pressed }) => [styles.metricRow, pressed && pressedFeedback]}
    >
      <View style={[styles.metricDot, { backgroundColor: definition.color || theme.slate }]} />
      <Text style={styles.metricName} numberOfLines={1}>{definition.name}</Text>
      <View style={[styles.metricCheck, { borderColor: selected ? theme.selectionIndicator : theme.border, backgroundColor: selected ? theme.selectionIndicator : 'transparent' }]}>
        {selected ? <Icon name="check" size={13} color={theme.onActionPrimary ?? theme.surface} weight="bold" /> : null}
      </View>
    </Pressable>
  );
}
const WINDOW_WEEKS: Partial<Record<DashboardTileKind, number[]>> = {
  volume: [8, 12, 26],
  'muscle-balance': [4, 8, 12],
  consistency: [8, 16, 26],
};

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
    >
      {() => (
        <View style={styles.sheet}>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader
            title={config?.title ?? (kind ? DASHBOARD_TILE_DEFAULT_TITLE[kind] : 'Settings')}
            compactTitle
            onClose={onClose}
          />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {dayOptions ? (
              <View style={styles.group}>
                <Text style={styles.groupLabel}>Trend window</Text>
                <Segmented options={dayOptions} value={settings.windowDays ?? dayOptions[0]} format={(v) => `${v} days`} onSelect={(v) => patch({ windowDays: v })} />
              </View>
            ) : null}
            {weekOptions ? (
              <View style={styles.group}>
                <Text style={styles.groupLabel}>Window</Text>
                <Segmented options={weekOptions} value={settings.windowWeeks ?? weekOptions[0]} format={(v) => `${v} weeks`} onSelect={(v) => patch({ windowWeeks: v })} />
              </View>
            ) : null}
            {kind === 'measurement' ? (
              <View style={styles.group}>
                <Text style={styles.groupLabel}>Metric</Text>
                {measurements.length ? (
                  measurements.map((def) => (
                    <MetricToggle
                      key={def.id}
                      definition={def}
                      selected={settings.measurementId === def.id}
                      onToggle={() => patch({ measurementId: def.id })}
                    />
                  ))
                ) : (
                  <Text style={styles.groupHint}>Add measurements in the More tab first.</Text>
                )}
              </View>
            ) : null}
            {kind === 'measurements' ? (
              <View style={styles.group}>
                <Text style={styles.groupLabel}>Metrics to show</Text>
                {measurements.length ? (
                  measurements.map((def) => (
                    <MetricToggle
                      key={def.id}
                      definition={def}
                      selected={selectedIds.includes(def.id)}
                      onToggle={() => {
                        const next = selectedIds.includes(def.id)
                          ? selectedIds.filter((id) => id !== def.id)
                          : [...selectedIds, def.id];
                        patch({ measurementIds: next });
                      }}
                    />
                  ))
                ) : (
                  <Text style={styles.groupHint}>Add measurements in the More tab first.</Text>
                )}
              </View>
            ) : null}
            {kind === 'muscle-balance' ? (
              <View style={styles.group}>
                <Text style={styles.groupLabel}>Muscles</Text>
                <Text style={styles.groupHint}>Pick specific muscles to break them out. With none selected the card shows the six groups.</Text>
                {MUSCLES_BY_GROUP.map((section) => (
                  <View key={section.group} style={styles.muscleSection}>
                    <Text style={styles.muscleGroupLabel}>{section.group}</Text>
                    {section.slugs.map((slug) => {
                      const selected = (settings.muscleFilter ?? []).includes(slug);
                      return (
                        <Pressable
                          key={slug}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          accessibilityLabel={MUSCLE_LABELS[slug] ?? slug}
                          onPress={() => {
                            selectionHaptic();
                            const current = settings.muscleFilter ?? [];
                            patch({ muscleFilter: selected ? current.filter((s) => s !== slug) : [...current, slug] });
                          }}
                          style={({ pressed }) => [styles.metricRow, pressed && pressedFeedback]}
                        >
                          <View style={[styles.metricDot, { backgroundColor: MUSCLE_GROUP_COLORS[section.group] }]} />
                          <Text style={styles.metricName} numberOfLines={1}>{MUSCLE_LABELS[slug] ?? slug}</Text>
                          <View style={[styles.metricCheck, { borderColor: selected ? theme.selectionIndicator : theme.border, backgroundColor: selected ? theme.selectionIndicator : 'transparent' }]}>
                            {selected ? <Icon name="check" size={13} color={theme.onActionPrimary ?? theme.surface} weight="bold" /> : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            ) : null}
            {kind === 'streak' ? (
              <>
                <View style={styles.group}>
                  <Text style={styles.groupLabel}>Weekly goal</Text>
                  <Stepper label="Workouts / week" value={settings.weeklyTargetDefault ?? 3} min={1} max={7} onChange={(v) => patch({ weeklyTargetDefault: v })} />
                  <Text style={styles.groupHint}>Or set targets per workout type below — those override the goal above.</Text>
                </View>
                {workoutTypes.length ? (
                  <View style={styles.group}>
                    <Text style={styles.groupLabel}>Per workout type</Text>
                    {workoutTypes.map((type) => (
                      <Stepper
                        key={type.id}
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
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      )}
    </ForgeBottomSheet>
  );
}

const createStyles = (theme: ForgeTheme) => StyleSheet.create({
  sheet: { paddingBottom: 24 },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 22 },
  group: { gap: 10 },
  groupLabel: { color: theme.slate, ...typeScale.caption },
  groupHint: { color: theme.muted, ...typeScale.caption },
  segmented: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  segmentText: { ...typeScale.controlLabel },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  stepperLabel: { flex: 1, color: theme.ink, ...typeScale.label },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceMuted, borderRadius: 999 },
  stepBtn: { width: 40, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 20, fontWeight: '700', lineHeight: 22 },
  stepValue: { minWidth: 26, textAlign: 'center', color: theme.ink, fontVariant: ['tabular-nums'], ...typeScale.controlLabel },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  metricDot: { width: 10, height: 10, borderRadius: 5 },
  metricName: { flex: 1, color: theme.ink, ...typeScale.label },
  metricCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  muscleSection: { gap: 2, marginTop: 4 },
  muscleGroupLabel: { color: theme.muted, marginTop: 6, ...typeScale.caption },
});
