import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

import {
  Button,
  AppScreen,
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
import { useForgeFloatingCtaClearance } from '../../components/ui/ForgeFloatingCta';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyMeasurements'>;
type Range = 7 | 30 | 90;

const metricColorChoices = [
  { name: 'Green', value: '#4D7B67' },
  { name: 'Blue', value: '#5478D8' },
  { name: 'Violet', value: '#8A64C8' },
  { name: 'Amber', value: '#C98A3D' },
] as const;
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

function displayHistoryDate(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(year, month - 1, day));
}

function historyMonthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
}

function formatValue(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ''}`;
}

export function DailyMeasurementsScreen({ navigation }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const floatingCtaClearance = useForgeFloatingCtaClearance();
  const { preferences, updatePreferences } = useSettings();
  const [range, setRange] = useState<Range>(30);
  const [headerElevated, setHeaderElevated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    preferences.dailyMeasurementDefinitions[0]?.id,
  );
  const [recordOpen, setRecordOpen] = useState(false);
  const [metricOpen, setMetricOpen] = useState(false);
  const [recordValue, setRecordValue] = useState('');
  const [metricName, setMetricName] = useState('');
  const [metricUnit, setMetricUnit] = useState('');
  const [metricIcon, setMetricIcon] = useState<IconName>('measure');
  const [metricColor, setMetricColor] = useState<(typeof metricColorChoices)[number]['value']>(metricColorChoices[0].value);

  const selected = preferences.dailyMeasurementDefinitions.find((item) => item.id === selectedId)
    ?? preferences.dailyMeasurementDefinitions[0];
  const displayUnit = selected?.unit ?? '';
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
    value: entry.value,
  }));
  const latest = displayEntries.at(-1);
  const periodStart = displayEntries[0];
  const historyEntries = useMemo(() => {
    if (!selected) return [];
    return preferences.dailyMeasurementEntries
      .filter((entry) => entry.definitionId === selected.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((entry) => ({
        ...entry,
        value: entry.value,
      }));
  }, [preferences.dailyMeasurementEntries, selected]);
  const historyGroups = useMemo(() => {
    const groups = new Map<string, typeof historyEntries>();
    historyEntries.forEach((entry) => {
      const key = entry.date.slice(0, 7);
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    });
    return [...groups.entries()].map(([key, values]) => ({ key, label: historyMonthLabel(key), values }));
  }, [historyEntries]);
  const trendDelta = latest && periodStart && periodStart !== latest
    ? `${latest.value >= periodStart.value ? '+' : ''}${formatValue(latest.value - periodStart.value, displayUnit)}`
    : '—';

  const openRecord = () => {
    if (!selected) return;
    const existing = preferences.dailyMeasurementEntries.find(
      (entry) => entry.definitionId === selected.id && entry.date === localDateKey(),
    );
    const value = existing?.value;
    const shown = value === undefined || value === 0 ? '' : String(value);
    setRecordValue(shown);
    setRecordOpen(true);
  };

  const saveRecord = () => {
    if (!selected) return;
    const parsed = Number(recordValue.replace(',', '.'));
    if (!Number.isFinite(parsed)) return;
    const value = parsed;
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
      color: metricColor,
    };
    updatePreferences({
      dailyMeasurementDefinitions: [...preferences.dailyMeasurementDefinitions, definition],
    });
    setSelectedId(definition.id);
    setMetricName('');
    setMetricUnit('');
    setMetricIcon('measure');
    setMetricColor(metricColorChoices[0].value);
    setMetricOpen(false);
  };

  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SettingsDetailHeader
        title="Measurements"
        navigation={navigation}
        elevated={headerElevated}
        rightAction={
          <HeaderAction
            accessibilityLabel={selected ? 'Record measurement' : 'Add measure'}
            icon="add"
            iconOnly
            onPress={selected ? openRecord : () => setMetricOpen(true)}
          />
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: styles.content.paddingBottom + bottomInset }]}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
        scrollEventThrottle={16}
      >
        {preferences.dailyMeasurementDefinitions.length ? (
          <View style={styles.metricPickerSection}>
            <View style={styles.metricPickerHeading}>
              <Text style={styles.metricPickerLabel}>METRICS</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add measure"
                onPress={() => setMetricOpen(true)}
                style={({ pressed }) => [styles.addMetricInline, pressed && pressedFeedback]}
              >
                <Icon name="add" size={16} color={theme.textPrimary} />
                <Text style={styles.addMetricInlineText}>Add</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.metricPickerContent}
              accessibilityRole="radiogroup"
              accessibilityLabel="Measurement metric"
            >
              {preferences.dailyMeasurementDefinitions.map((definition) => (
                <Pressable
                  key={definition.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${definition.name}${definition.unit ? `, ${definition.unit}` : ''}`}
                  accessibilityState={{ checked: definition.id === selected?.id }}
                  aria-checked={definition.id === selected?.id}
                  onPress={() => { selectionHaptic(); setSelectedId(definition.id); }}
                  style={({ pressed }) => [
                    styles.metricPickerCard,
                    definition.id === selected?.id && { borderColor: definition.color, backgroundColor: `${definition.color}18` },
                    pressed && pressedFeedback,
                  ]}
                >
                  <View style={[styles.metricPickerIcon, { backgroundColor: `${definition.color}24` }]}>
                    <Icon name={definition.icon} size={20} color={definition.color} />
                  </View>
                  <View style={styles.metricPickerCopy}>
                    <Text numberOfLines={1} style={styles.metricPickerName}>{definition.name}</Text>
                    {definition.unit ? <Text numberOfLines={1} style={styles.metricPickerUnit}>{definition.unit}</Text> : null}
                  </View>
                  {definition.id === selected?.id ? <View style={[styles.metricPickerSelected, { backgroundColor: definition.color }]} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : (
          <Button
            label="Add measure"
            icon="add"
            variant="outline"
            onPress={() => setMetricOpen(true)}
            style={styles.addMetric}
          />
        )}
        {selected ? (
          <Animated.View
            key={selected.id}
            entering={FadeInRight.duration(180)}
            exiting={FadeOutLeft.duration(120)}
            style={styles.selectedMetricContent}
          >
            <ForgeCard variant="elevated" style={styles.summaryCard}>
              <View style={styles.metricHeading}>
                <View style={[styles.metricIcon, { backgroundColor: `${selected.color}24` }]}>
                  <Icon name={selected.icon} size={22} color={selected.color} />
                </View>
                <View style={styles.metricHeadingCopy}>
                  <Text style={styles.metricTitle}>{selected.name}</Text>
                  <Text style={styles.metricSubtitle}>{latest ? `Last recorded ${displayDate(latest.date)}` : 'No measurements yet'}</Text>
                </View>
              </View>
              <View style={styles.summaryStats}>
                <MeasurementSummaryStat label="LATEST" value={latest ? formatValue(latest.value, displayUnit) : '—'} />
                <View style={styles.summaryDivider} />
                <MeasurementSummaryStat label={`${range} DAY CHANGE`} value={trendDelta} />
              </View>
            </ForgeCard>
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
          </Animated.View>
        ) : null}
        {historyGroups.map((group) => (
          <SettingsSection key={group.key} title={`History · ${group.label}`}>
            {group.values.map((entry, index) => (
              <SettingsRow
                key={entry.id}
                title={displayHistoryDate(entry.date)}
                trailing={<Text style={styles.historyValue}>{formatValue(entry.value, displayUnit)}</Text>}
                showDivider={index < group.values.length - 1}
                accessibilityLabel={`${displayHistoryDate(entry.date)}, ${formatValue(entry.value, displayUnit)}`}
              />
            ))}
          </SettingsSection>
        ))}
      </ScrollView>
      <ForgeBottomSheet
        visible={recordOpen}
        onClose={() => setRecordOpen(false)}
        accessibilityLabel="Close record measurement"
        keyboardAvoiding
      >
        {(close) => (
          <View style={[styles.recordSheet, { paddingBottom: floatingCtaClearance }]}>
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
            <ScrollView
              style={styles.metricFormScroll}
              contentContainerStyle={[styles.metricForm, { paddingBottom: floatingCtaClearance }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
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
              <Text style={styles.fieldLabel}>COLOR</Text>
              <View style={styles.colorChoices} accessibilityRole="radiogroup" accessibilityLabel="Measure color">
                {metricColorChoices.map((choice) => (
                  <Pressable
                    key={choice.value}
                    accessibilityRole="radio"
                    accessibilityLabel={`Use ${choice.name} color`}
                    accessibilityState={{ checked: metricColor === choice.value }}
                    aria-checked={metricColor === choice.value}
                    onPress={() => { selectionHaptic(); setMetricColor(choice.value); }}
                    style={({ pressed }) => [styles.colorChoice, metricColor === choice.value && { borderColor: choice.value }, pressed && pressedFeedback]}
                  >
                    <View style={[styles.colorSwatch, { backgroundColor: choice.value }]} />
                    {metricColor === choice.value ? <Icon name="check" size={15} color={theme.textPrimary} weight="bold" /> : null}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
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
    </AppScreen>
  );
}

function MeasurementSummaryStat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.summaryValue}>{value}</Text>
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
  scroll: { flex: 1 },
  content: {
    padding: settingsLayout.screenPadding,
    paddingTop: settingsLayout.contentTop,
    paddingBottom: settingsLayout.contentBottom,
    gap: 20,
  },
  metricHeading: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  metricHeadingCopy: { flex: 1, minWidth: 0 },
  metricTitle: { ...typeScale.headerTitle, color: theme.textPrimary },
  metricSubtitle: { ...typeScale.supporting, color: theme.textSecondary, marginTop: 1 },
  summaryCard: { padding: 16, gap: 16 },
  summaryStats: { flexDirection: 'row', alignItems: 'stretch', minHeight: 48 },
  summaryStat: { flex: 1, minWidth: 0, gap: 4 },
  summaryLabel: { ...typeScale.caption, color: theme.textSecondary, letterSpacing: 0.7 },
  summaryValue: { ...typeScale.cardTitle, color: theme.textPrimary },
  summaryDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 14, backgroundColor: theme.divider },
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
  historyValue: { ...typeScale.cardTitle, color: theme.textPrimary },
  metricPickerSection: { gap: 9 },
  metricPickerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricPickerLabel: { ...typeScale.caption, color: theme.textSecondary, letterSpacing: 0.9 },
  addMetricInline: { minHeight: 30, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 9 },
  addMetricInlineText: { ...typeScale.label, color: theme.textPrimary },
  metricPickerContent: { gap: 10, paddingRight: settingsLayout.screenPadding },
  metricPickerCard: { width: 142, minHeight: 82, padding: 11, borderWidth: 1, borderColor: theme.border, borderRadius: 16, backgroundColor: theme.surface, gap: 8 },
  metricPickerIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricPickerCopy: { minWidth: 0, gap: 1 },
  metricPickerName: { ...typeScale.label, color: theme.textPrimary },
  metricPickerUnit: { ...typeScale.caption, color: theme.textSecondary },
  metricPickerSelected: { position: 'absolute', right: 10, bottom: 10, width: 7, height: 7, borderRadius: 3.5 },
  selectedMetricContent: { gap: 14 },
  recordEmpty: { minHeight: 50, borderRadius: 16 },
  addMetric: { minHeight: 48, borderStyle: 'dashed', borderColor: theme.border },
  recordSheet: { minHeight: 315 },
  metricSheet: { minHeight: 520, flexShrink: 1 },
  metricFormScroll: { flexShrink: 1 },
  metricForm: { paddingHorizontal: 20 },
  recordDate: { ...typeScale.supporting, color: theme.textSecondary, textAlign: 'center', marginBottom: 22 },
  valueField: { marginHorizontal: 20, minHeight: 72, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  valueInput: { flex: 1, ...typeScale.metricLarge, color: theme.textPrimary, paddingVertical: 0 },
  valueUnit: { ...typeScale.cardTitle, color: theme.textSecondary },
  fieldLabel: { ...typeScale.caption, color: theme.textSecondary, letterSpacing: 0.8, marginTop: 14, marginBottom: 7 },
  fieldCard: { minHeight: 52, paddingHorizontal: 14, justifyContent: 'center' },
  fieldInput: { ...typeScale.body, color: theme.textPrimary, paddingVertical: 0 },
  iconChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChoice: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface },
  colorChoices: { flexDirection: 'row', gap: 10 },
  colorChoice: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface },
  colorSwatch: { width: 20, height: 20, borderRadius: 10 },
});
