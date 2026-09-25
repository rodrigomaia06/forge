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
import type { ForgeTheme, WorkoutTypePreference } from '../../types';
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
};
const WINDOW_WEEKS: Partial<Record<DashboardTileKind, number[]>> = {
  volume: [8, 12, 26],
  'muscle-balance': [4, 8, 12],
  consistency: [8, 16, 26],
};

export function DashboardTileSettingsSheet({
  config,
  workoutTypes,
  onChange,
  onClose,
}: {
  config: DashboardTileConfig | null;
  workoutTypes: WorkoutTypePreference[];
  onChange: (settings: DashboardTileSettings) => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const kind = config?.kind;
  const settings = config ? tileSettings(config) : {};
  const patch = (next: Partial<DashboardTileSettings>) => onChange({ ...settings, ...next });

  const dayOptions = kind ? WINDOW_DAYS[kind] : undefined;
  const weekOptions = kind ? WINDOW_WEEKS[kind] : undefined;

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
});
