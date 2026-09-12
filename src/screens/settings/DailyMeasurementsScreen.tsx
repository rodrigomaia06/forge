import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeCard,
  ForgeFloatingCta,
  ForgeSheetHeader,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  HeaderAction,
  Icon,
  pressedFeedback,
  selectionHaptic,
} from '../../components/ui';
import { useSettings } from '../../state/SettingsContext';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { DailyMeasurementDefinition, IconName, RootStackParamList } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { SettingsRow, SettingsSection, settingsLayout } from './SettingsRow';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyMeasurements'>;
type Range = 7 | 30 | 90;

const metricColors = ['#4D7B67', '#5478D8', '#C56BE6', '#D78543', '#EF715F'];
const suggestedMetrics: ReadonlyArray<Pick<DailyMeasurementDefinition, 'name' | 'unit' | 'icon'>> = [
  { name: 'Body fat', unit: '%', icon: 'activity' },
  { name: 'Waist', unit: 'cm', icon: 'measure' },
  { name: 'Resting heart rate', unit: 'bpm', icon: 'heart' },
];
const metricIcons: readonly IconName[] = [
  'weight', 'measure', 'heart', 'hydration', 'energy', 'sleep', 'recovery', 'activity',
];

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
    .format(new Date(year, month - 1, day));
}

function formatValue(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ''}`;
}

export function DailyMeasurementsScreen({ navigation }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { preferences, updatePreferences } = useSettings();
  const [range, setRange] = useState<Range>(30);
  const [headerElevated, setHeaderElevated] = useState(false);
  const [selectedId, setSelectedId] = useState(
    preferences.dailyMeasurementDefinitions[0]?.id ?? 'body-weight',
  );
  const [recordOpen, setRecordOpen] = useState(false);
  const [metricOpen, setMetricOpen] = useState(false);
  const [recordValue, setRecordValue] = useState('');
  const [metricName, setMetricName] = useState('');
  const [metricUnit, setMetricUnit] = useState('');
  const [metricIcon, setMetricIcon] = useState<IconName>('measure');

  const selected = preferences.dailyMeasurementDefinitions.find((item) => item.id === selectedId)
    ?? preferences.dailyMeasurementDefinitions[0];
  const displayUnit = selected?.id === 'body-weight' && preferences.units === 'imperial'
    ? 'lb'
    : selected?.unit ?? '';
  const entries = useMemo(() => {
    if (!selected) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (range - 1));
    const cutoffKey = localDateKey(cutoff);
    return preferences.dailyMeasurementEntries
      .filter((item) => item.definitionId === selected.id && item.date >= cutoffKey)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [preferences.dailyMeasurementEntries, range, selected]);
  const displayEntries = entries.map((entry) => ({
    ...entry,
    value: selected?.id === 'body-weight' && preferences.units === 'imperial'
      ? entry.value * 2.20462
      : entry.value,
  }));
  const latest = displayEntries.at(-1);
  const periodStart = displayEntries[0];
  const availableSuggestions = suggestedMetrics.filter((suggestion) => !preferences.dailyMeasurementDefinitions.some(
    (definition) => definition.name.trim().toLocaleLowerCase() === suggestion.name.toLocaleLowerCase(),
  ));

  const openRecord = () => {
    if (!selected) return;
    const existing = preferences.dailyMeasurementEntries.find(
      (entry) => entry.definitionId === selected.id && entry.date === localDateKey(),
    );
    const value = existing?.value ?? (selected.id === 'body-weight' ? preferences.bodyweightKg : undefined);
    const shown = value === undefined || value === 0
      ? ''
      : selected.id === 'body-weight' && preferences.units === 'imperial'
        ? String(Math.round(value * 2.20462 * 10) / 10)
        : String(value);
    setRecordValue(shown);
    setRecordOpen(true);
  };

  const saveRecord = () => {
    if (!selected) return;
    const parsed = Number(recordValue.replace(',', '.'));
    if (!Number.isFinite(parsed)) return;
    const value = selected.id === 'body-weight' && preferences.units === 'imperial'
      ? parsed / 2.20462
      : parsed;
    const date = localDateKey();
    const old = preferences.dailyMeasurementEntries.find(
      (entry) => entry.definitionId === selected.id && entry.date === date,
    );
    updatePreferences({
      dailyMeasurementEntries: old
        ? preferences.dailyMeasurementEntries.map((entry) => entry.id === old.id ? { ...entry, value } : entry)
        : [...preferences.dailyMeasurementEntries, {
            id: `measurement-${Date.now()}`,
            definitionId: selected.id,
            date,
            value,
          }],
      ...(selected.id === 'body-weight' ? { bodyweightKg: value } : {}),
    });
    setRecordOpen(false);
  };

  const saveMetric = () => {
    const name = metricName.trim();
    if (!name) return;
    const definition: DailyMeasurementDefinition = {
      id: `metric-${Date.now()}`,
      name,
      unit: metricUnit.trim(),
      icon: metricIcon,
      color: metricColors[preferences.dailyMeasurementDefinitions.length % metricColors.length],
    };
    updatePreferences({
      dailyMeasurementDefinitions: [...preferences.dailyMeasurementDefinitions, definition],
    });
    setSelectedId(definition.id);
    setMetricName('');
    setMetricUnit('');
    setMetricIcon('measure');
    setMetricOpen(false);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SettingsDetailHeader
        title="Daily measurements"
        navigation={navigation}
        elevated={headerElevated}
        rightAction={
          <HeaderAction
            accessibilityLabel="Record measurement"
            icon="add"
            iconOnly
            onPress={openRecord}
          />
        }
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 44 }]}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
        scrollEventThrottle={16}
      >
        {selected ? (
          <>
            <View style={styles.metricHeading}>
              <View style={[styles.metricIcon, { backgroundColor: `${selected.color}24` }]}>
                <Icon name={selected.icon} size={22} color={selected.color} />
              </View>
              <View style={styles.metricHeadingCopy}>
                <Text style={styles.metricTitle}>{selected.name}</Text>
                {latest ? <Text style={styles.metricSubtitle}>{displayDate(latest.date)}</Text> : null}
              </View>
              <Text style={styles.metricLatest}>{latest ? formatValue(latest.value, displayUnit) : '—'}</Text>
            </View>
            {latest ? (
              <ForgeCard variant="elevated" style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={styles.chartEyebrow}>TREND</Text>
                    {periodStart && periodStart !== latest ? (
                      <Text style={styles.chartDelta}>
                        {`${latest.value >= periodStart.value ? '+' : ''}${formatValue(latest.value - periodStart.value, displayUnit)}`}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.rangeControls} accessibilityRole="tablist" accessibilityLabel="Chart range">
                    {([7, 30, 90] as const).map((value) => (
                      <Pressable
                        key={value}
                        accessibilityRole="tab"
                        accessibilityLabel={`Show ${value} day chart`}
                        accessibilityState={{ selected: range === value }}
                        onPress={() => { selectionHaptic(); setRange(value); }}
                        style={({ pressed }) => [
                          styles.rangeControl,
                          range === value && { backgroundColor: theme.selected },
                          pressed && pressedFeedback,
                        ]}
                      >
                        <Text style={[styles.rangeText, range === value && { color: theme.selectedText }]}>{value}D</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <MeasurementChart points={displayEntries} color={selected.color} unit={displayUnit} range={range} />
              </ForgeCard>
            ) : (
              <Button
                label={`Record ${selected.name.toLocaleLowerCase()}`}
                icon="add"
                variant="outline"
                onPress={openRecord}
                style={styles.recordEmpty}
              />
            )}
          </>
        ) : null}
        <SettingsSection title="Measures">
          {preferences.dailyMeasurementDefinitions.map((definition, index) => (
            <SettingsRow
              key={definition.id}
              title={definition.name}
              subtitle={definition.id === 'body-weight' && preferences.units === 'imperial' ? 'lb' : definition.unit || undefined}
              icon={definition.icon}
              iconColor={definition.color}
              iconBackgroundColor={`${definition.color}24`}
              showDivider={index < preferences.dailyMeasurementDefinitions.length - 1}
              accessibilityState={{ selected: definition.id === selected?.id }}
              onPress={() => { selectionHaptic(); setSelectedId(definition.id); }}
              trailing={definition.id === selected?.id ? <Icon name="check" size={19} color={theme.selectionIndicator} weight="bold" /> : undefined}
              style={definition.id === selected?.id ? styles.selectedDefinition : undefined}
            />
          ))}
        </SettingsSection>
        <Button
          label="Add measure"
          icon="add"
          variant="outline"
          onPress={() => setMetricOpen(true)}
          style={styles.addMetric}
        />
      </ScrollView>
      <ForgeBottomSheet
        visible={recordOpen}
        onClose={() => setRecordOpen(false)}
        accessibilityLabel="Close record measurement"
        keyboardAvoiding
      >
        {(close) => (
          <View style={styles.recordSheet}>
            <ForgeBottomSheetHandle />
            <ForgeSheetHeader title={`Record ${selected?.name ?? 'measurement'}`} onClose={close} />
            <Text style={styles.recordDate}>Today · {displayDate(localDateKey())}</Text>
            <ForgeCard variant="inset" style={styles.valueField}>
              <TextInput
                autoFocus
                accessibilityLabel={`${selected?.name ?? 'Measurement'} value`}
                value={recordValue}
                onChangeText={setRecordValue}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={theme.textDisabled}
                style={styles.valueInput}
              />
              {displayUnit ? <Text style={styles.valueUnit}>{displayUnit}</Text> : null}
            </ForgeCard>
            <ForgeFloatingCta
              label="Save measurement"
              accessibilityLabel="Save measurement"
              disabled={!recordValue.trim() || !Number.isFinite(Number(recordValue.replace(',', '.')))}
              tone="success"
              onPress={saveRecord}
            />
          </View>
        )}
      </ForgeBottomSheet>
      <ForgeBottomSheet
        visible={metricOpen}
        onClose={() => setMetricOpen(false)}
        accessibilityLabel="Close add measure"
        keyboardAvoiding
      >
        {(close) => (
          <View style={styles.metricSheet}>
            <ForgeBottomSheetHandle />
            <ForgeSheetHeader title="Add measure" onClose={close} />
            {availableSuggestions.length ? (
              <>
                <Text style={styles.fieldLabel}>SUGGESTED</Text>
                <View style={styles.suggestedMetrics}>
                  {availableSuggestions.map((suggestion) => (
                    <Pressable
                      key={suggestion.name}
                      accessibilityRole="button"
                      accessibilityLabel={`Use suggested ${suggestion.name} measure`}
                      onPress={() => {
                        selectionHaptic();
                        setMetricName(suggestion.name);
                        setMetricUnit(suggestion.unit);
                        setMetricIcon(suggestion.icon);
                      }}
                      style={({ pressed }) => [styles.suggestedMetric, pressed && pressedFeedback]}
                    >
                      <Icon name={suggestion.icon} size={18} color={theme.textSecondary} />
                      <Text numberOfLines={1} style={styles.suggestedMetricText}>{suggestion.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            <Text style={styles.fieldLabel}>NAME</Text>
            <ForgeCard variant="inset" style={styles.fieldCard}>
              <TextInput
                autoFocus
                accessibilityLabel="Measure name"
                value={metricName}
                onChangeText={setMetricName}
                placeholder="e.g. Resting heart rate"
                placeholderTextColor={theme.textDisabled}
                style={styles.fieldInput}
              />
            </ForgeCard>
            <Text style={styles.fieldLabel}>UNIT</Text>
            <ForgeCard variant="inset" style={styles.fieldCard}>
              <TextInput
                accessibilityLabel="Measure unit"
                value={metricUnit}
                onChangeText={setMetricUnit}
                placeholder="e.g. bpm, cm, score"
                placeholderTextColor={theme.textDisabled}
                style={styles.fieldInput}
              />
            </ForgeCard>
            <Text style={styles.fieldLabel}>ICON</Text>
            <View style={styles.iconChoices} accessibilityRole="radiogroup" accessibilityLabel="Measure icon">
              {metricIcons.map((icon) => (
                <Pressable
                  key={icon}
                  accessibilityRole="radio"
                  accessibilityLabel={`Use ${icon} icon`}
                  accessibilityState={{ checked: metricIcon === icon }}
                  onPress={() => { selectionHaptic(); setMetricIcon(icon); }}
                  style={({ pressed }) => [
                    styles.iconChoice,
                    metricIcon === icon && { backgroundColor: theme.successSurface, borderColor: theme.success },
                    pressed && pressedFeedback,
                  ]}
                >
                  <Icon name={icon} size={20} color={theme.textPrimary} />
                </Pressable>
              ))}
            </View>
            <ForgeFloatingCta
              label="Add measure"
              accessibilityLabel="Add measure"
              disabled={!metricName.trim()}
              tone="success"
              onPress={saveMetric}
            />
          </View>
        )}
      </ForgeBottomSheet>
    </View>
  );
}

function MeasurementChart({
  points,
  color,
  unit,
  range,
}: {
  points: { date: string; value: number }[];
  color: string;
  unit: string;
  range: Range;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, Math.max(Math.abs(max) * 0.08, 1));
  const low = min - span * 0.16;
  const high = max + span * 0.16;
  const width = 300;
  const height = 132;
  const left = 10;
  const right = 10;
  const top = 12;
  const bottom = 24;
  const rangeEnd = new Date();
  rangeEnd.setHours(0, 0, 0, 0);
  const rangeStart = new Date(rangeEnd);
  rangeStart.setDate(rangeStart.getDate() - (range - 1));
  const rangeDuration = Math.max(rangeEnd.getTime() - rangeStart.getTime(), 1);
  const dateToTime = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).getTime();
  };
  const x = (point: { date: string }) => points.length === 1
    ? width / 2
    : left + Math.max(0, Math.min(1, (dateToTime(point.date) - rangeStart.getTime()) / rangeDuration)) * (width - left - right);
  const y = (value: number) => top + ((high - value) / (high - low)) * (height - top - bottom);
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${x(point)} ${y(point.value)}`).join(' ');
  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} accessibilityLabel={`${points.length} measurements chart`}>
        {[0.25, 0.5, 0.75].map((fraction) => (
          <Line key={fraction} x1={left} x2={width - right} y1={top + (height - top - bottom) * fraction} y2={top + (height - top - bottom) * fraction} stroke={theme.divider} strokeWidth={1} />
        ))}
        <Path d={path} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => <Circle key={point.date} cx={x(point)} cy={y(point.value)} r={4} fill={theme.surfaceElevated} stroke={color} strokeWidth={2.5} />)}
      </Svg>
      <View style={[styles.chartFooter, points.length === 1 && styles.chartFooterCentered]}>
        {points.length > 1 ? <Text style={styles.chartAxis}>{formatValue(max, unit)}</Text> : null}
        <Text style={styles.chartAxis}>{points.length === 1 ? displayDate(points[0].date) : `${displayDate(points[0].date)} — ${displayDate(points.at(-1)?.date ?? points[0].date)}`}</Text>
        {points.length > 1 ? <Text style={styles.chartAxis}>{formatValue(min, unit)}</Text> : null}
      </View>
    </View>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) => StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: settingsLayout.screenPadding, paddingTop: settingsLayout.contentTop, gap: 20 },
  metricHeading: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  metricHeadingCopy: { flex: 1, minWidth: 0 },
  metricTitle: { ...typeScale.headerTitle, color: theme.textPrimary },
  metricSubtitle: { ...typeScale.supporting, color: theme.textSecondary, marginTop: 1 },
  metricLatest: { ...typeScale.metricMedium, color: theme.textPrimary },
  chartCard: { padding: 16, gap: 14 },
  chartHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  chartEyebrow: { ...typeScale.caption, color: theme.textSecondary, letterSpacing: 0.8 },
  chartDelta: { ...typeScale.supporting, color: theme.textPrimary, marginTop: 2 },
  rangeControls: { flexDirection: 'row', padding: 3, gap: 2, borderRadius: 12, backgroundColor: theme.surfaceMuted },
  rangeControl: { minWidth: 34, minHeight: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rangeText: { ...typeScale.caption, color: theme.textSecondary },
  chartFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chartFooterCentered: { justifyContent: 'center' },
  chartAxis: { ...typeScale.caption, color: theme.textSecondary },
  selectedDefinition: { backgroundColor: theme.successSurface },
  recordEmpty: { minHeight: 50, borderRadius: 16 },
  addMetric: { minHeight: 48, borderStyle: 'dashed', borderColor: theme.border },
  recordSheet: { minHeight: 315, paddingBottom: 92 },
  metricSheet: { minHeight: 570, paddingHorizontal: 20, paddingBottom: 92 },
  recordDate: { ...typeScale.supporting, color: theme.textSecondary, textAlign: 'center', marginBottom: 22 },
  valueField: { marginHorizontal: 20, minHeight: 72, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  valueInput: { flex: 1, ...typeScale.metricLarge, color: theme.textPrimary, paddingVertical: 0 },
  valueUnit: { ...typeScale.cardTitle, color: theme.textSecondary },
  fieldLabel: { ...typeScale.caption, color: theme.textSecondary, letterSpacing: 0.8, marginTop: 14, marginBottom: 7 },
  fieldCard: { minHeight: 52, paddingHorizontal: 14, justifyContent: 'center' },
  fieldInput: { ...typeScale.body, color: theme.textPrimary, paddingVertical: 0 },
  suggestedMetrics: { flexDirection: 'row', gap: 8 },
  suggestedMetric: { flex: 1, minWidth: 0, minHeight: 48, gap: 6, paddingHorizontal: 8, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  suggestedMetricText: { ...typeScale.caption, color: theme.textSecondary, maxWidth: '100%' },
  iconChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChoice: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface },
});
