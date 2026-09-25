import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

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
  SwipeToDeleteRow,
  pressedFeedback,
  selectionHaptic,
} from '../../components/ui';
import { ForgeLineChart } from '../../components/charts/ForgeLineChart';
import { useSettings } from '../../state/SettingsContext';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';
import type { DailyMeasurementDefinition, DailyMeasurementEntry, IconName, RootStackParamList } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { settingsLayout } from './SettingsRow';
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
  'goal', 'running', 'fitness', 'time', 'temperature', 'nutrition', 'mood', 'focus',
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
  const reducedMotion = useForgeReducedMotion();
  const styles = useThemedStyles(createStyles);
  const floatingCtaClearance = useForgeFloatingCtaClearance();
  const { preferences, updatePreferences } = useSettings();
  const [range, setRange] = useState<Range>(30);
  const [headerElevated, setHeaderElevated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    preferences.dailyMeasurementDefinitions[0]?.id,
  );
  // The page itself must arrive settled. Only a deliberate metric change
  // inside Measurements should replace this content with a lateral motion.
  const [animateMetricChange, setAnimateMetricChange] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [recordDateKey, setRecordDateKey] = useState<string>(() => localDateKey());
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
  const HISTORY_PREVIEW = 5;
  const shownHistory = historyExpanded ? historyEntries : historyEntries.slice(0, HISTORY_PREVIEW);
  const historyGroups = useMemo(() => {
    const groups = new Map<string, typeof shownHistory>();
    shownHistory.forEach((entry) => {
      const key = entry.date.slice(0, 7);
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    });
    return [...groups.entries()].map(([key, values]) => ({ key, label: historyMonthLabel(key), values }));
  }, [shownHistory]);
  const trendDelta = latest && periodStart && periodStart !== latest
    ? `${latest.value >= periodStart.value ? '+' : ''}${formatValue(latest.value - periodStart.value, displayUnit)}`
    : '—';

  const openRecordFor = (dateKey: string) => {
    if (!selected) return;
    const existing = preferences.dailyMeasurementEntries.find(
      (entry) => entry.definitionId === selected.id && entry.date === dateKey,
    );
    const value = existing?.value;
    const shown = value === undefined || value === 0 ? '' : String(value);
    setRecordDateKey(dateKey);
    setRecordValue(shown);
    setRecordOpen(true);
  };
  const openRecord = () => openRecordFor(localDateKey());
  const editRecord = (entry: DailyMeasurementEntry) => openRecordFor(entry.date);

  const deleteEntry = (id: string) => {
    updatePreferences({
      dailyMeasurementEntries: preferences.dailyMeasurementEntries.filter((entry) => entry.id !== id),
    });
  };

  const saveRecord = () => {
    if (!selected) return;
    const parsed = Number(recordValue.replace(',', '.'));
    if (!Number.isFinite(parsed)) return;
    const value = parsed;
    const date = recordDateKey;
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
    setAnimateMetricChange(true);
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
                  onPress={() => {
                    if (definition.id === selected?.id) return;
                    selectionHaptic();
                    setAnimateMetricChange(true);
                    setSelectedId(definition.id);
                  }}
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
            testID="measurements-active-metric"
            entering={animateMetricChange && !reducedMotion ? FadeIn.duration(forgeMotion.transition) : undefined}
            exiting={animateMetricChange && !reducedMotion ? FadeOut.duration(forgeMotion.feedback) : undefined}
            style={styles.selectedMetricContent}
          >
            {latest ? (
              <View style={styles.summaryRow}>
                <ForgeCard variant="base" style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: `${selected.color}24` }]}>
                    <Icon name={selected.icon} size={22} color={selected.color} />
                  </View>
                  <Text style={styles.metricCardName} numberOfLines={2}>{selected.name}</Text>
                  <View style={styles.metricCardStat}>
                    <Text style={styles.metricCardStatLabel}>Latest</Text>
                    <Text style={styles.metricCardStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatValue(latest.value, displayUnit)}</Text>
                  </View>
                  <View style={styles.metricCardStat}>
                    <Text style={styles.metricCardStatLabel}>{range}d change</Text>
                    <Text style={styles.metricCardStatSub} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{trendDelta}</Text>
                  </View>
                </ForgeCard>
                <ForgeCard variant="base" style={styles.trendCard}>
                  <View style={styles.trendHeader}>
                    <Text style={styles.chartEyebrow}>TREND</Text>
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
                  <ForgeLineChart
                    data={displayEntries.map((entry) => ({ value: entry.value }))}
                    height={116}
                    color={selected.color}
                    showMarkers={displayEntries.length <= 12}
                  />
                  <View style={[styles.chartFooter, displayEntries.length === 1 && styles.chartFooterCentered]}>
                    {displayEntries.length > 1 ? (
                      <Text style={styles.chartAxis}>{formatValue(Math.max(...displayEntries.map((e) => e.value)), displayUnit)}</Text>
                    ) : null}
                    {displayEntries.length > 1 ? (
                      <Text style={styles.chartAxis}>{formatValue(Math.min(...displayEntries.map((e) => e.value)), displayUnit)}</Text>
                    ) : null}
                  </View>
                </ForgeCard>
              </View>
            ) : (
              <ForgeCard variant="base" style={styles.summaryCard}>
                <View style={styles.metricHeading}>
                  <View style={[styles.metricIcon, { backgroundColor: `${selected.color}24` }]}>
                    <Icon name={selected.icon} size={22} color={selected.color} />
                  </View>
                  <View style={styles.metricHeadingCopy}>
                    <Text style={styles.metricTitle}>{selected.name}</Text>
                    <Text style={styles.metricSubtitle}>No measurements yet</Text>
                  </View>
                </View>
                <Button
                  label={`Record ${selected.name.toLocaleLowerCase()}`}
                  icon="add"
                  variant="outline"
                  onPress={openRecord}
                  style={styles.recordEmpty}
                />
              </ForgeCard>
            )}
          </Animated.View>
        ) : null}
        {historyGroups.length ? (
          <View style={styles.historyHeaderRow}>
            <Text style={styles.historyTitle}>History</Text>
            <Text style={styles.historyHint}>Tap to edit · swipe to delete</Text>
          </View>
        ) : null}
        {historyGroups.map((group) => (
          <View key={group.key} style={styles.historyGroup}>
            <Text style={styles.historyGroupLabel}>{group.label}</Text>
            <View style={styles.historyCard}>
              {group.values.map((entry, index) => (
                <SwipeToDeleteRow
                  key={entry.id}
                  deleteAccessibilityLabel={`Delete ${displayHistoryDate(entry.date)} record`}
                  onDelete={() => deleteEntry(entry.id)}
                  showDivider={index < group.values.length - 1}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${displayHistoryDate(entry.date)}, ${formatValue(entry.value, displayUnit)}`}
                    onPress={() => { selectionHaptic(); editRecord(entry); }}
                    style={({ pressed }) => [styles.historyRow, pressed && pressedFeedback]}
                  >
                    <Text style={styles.historyDate} numberOfLines={1}>{displayHistoryDate(entry.date)}</Text>
                    <Text style={styles.historyValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatValue(entry.value, displayUnit)}</Text>
                  </Pressable>
                </SwipeToDeleteRow>
              ))}
            </View>
          </View>
        ))}
        {historyEntries.length > HISTORY_PREVIEW ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={historyExpanded ? 'Show fewer records' : `Show all ${historyEntries.length} records`}
            onPress={() => { selectionHaptic(); setHistoryExpanded((current) => !current); }}
            style={({ pressed }) => [styles.showMore, pressed && pressedFeedback]}
          >
            <Text style={styles.showMoreText}>
              {historyExpanded ? 'Show less' : `Show ${historyEntries.length - HISTORY_PREVIEW} more`}
            </Text>
            <View style={{ transform: [{ rotate: historyExpanded ? '180deg' : '0deg' }] }}>
              <Icon name="chevron-down" size={16} color={theme.textSecondary} />
            </View>
          </Pressable>
        ) : null}
      </ScrollView>
      <ForgeBottomSheet
        visible={recordOpen}
        onClose={() => setRecordOpen(false)}
        accessibilityLabel="Close record measurement"
        keyboardAvoiding
        dismissTextKeyboardOnTap={false}
      >
        {(close) => (
          <View style={[styles.recordSheet, { paddingBottom: floatingCtaClearance }]}>
            <ForgeBottomSheetHandle />
            <ForgeSheetHeader title={`Record ${selected?.name ?? 'measurement'}`} onClose={close} />
            <Text style={styles.recordDate}>
              {recordDateKey === localDateKey() ? 'Today · ' : ''}{displayDate(recordDateKey)}
            </Text>
            <ForgeCard variant="nested" style={styles.valueField}>
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
        dismissTextKeyboardOnTap={false}
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
              <ForgeCard variant="nested" style={styles.fieldCard}>
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
              <ForgeCard variant="nested" style={styles.fieldCard}>
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

const createStyles = (theme: import('../../types').ForgeTheme) => StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    padding: settingsLayout.screenPadding,
    paddingTop: settingsLayout.contentTop,
    paddingBottom: settingsLayout.contentBottom,
    gap: 20,
  },
  summaryCard: { padding: 16, gap: 16 },
  metricHeading: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  metricHeadingCopy: { flex: 1, minWidth: 0 },
  metricTitle: { ...typeScale.headerTitle, color: theme.textPrimary },
  metricSubtitle: { ...typeScale.supporting, color: theme.textSecondary, marginTop: 1 },
  chartEyebrow: { ...typeScale.caption, color: theme.textSecondary, letterSpacing: 0.8 },
  rangeControls: { flexDirection: 'row', padding: 3, gap: 2, borderRadius: 12, backgroundColor: theme.surfaceMuted },
  rangeControl: { minWidth: 34, minHeight: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rangeText: { ...typeScale.caption, color: theme.textSecondary },
  chartFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  chartFooterCentered: { justifyContent: 'center' },
  chartAxis: { ...typeScale.caption, color: theme.textSecondary },
  summaryRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  metricCard: { width: 130, padding: 14, gap: 10 },
  metricCardName: { ...typeScale.controlLabel, color: theme.textPrimary },
  metricCardStat: { gap: 1 },
  metricCardStatLabel: { ...typeScale.caption, color: theme.textSecondary },
  metricCardStatValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, color: theme.textPrimary, fontVariant: ['tabular-nums'] },
  metricCardStatSub: { ...typeScale.label, color: theme.textPrimary, fontVariant: ['tabular-nums'] },
  trendCard: { flex: 1, padding: 14, gap: 8 },
  trendHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  showMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, marginTop: 2 },
  showMoreText: { ...typeScale.controlLabel, color: theme.textSecondary },
  historyHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  historyTitle: { ...typeScale.sectionTitle, color: theme.textPrimary },
  historyHint: { ...typeScale.caption, color: theme.textSecondary },
  historyGroup: { gap: 8 },
  historyGroupLabel: { ...typeScale.caption, color: theme.textSecondary, letterSpacing: 0.5, marginLeft: 4 },
  historyCard: { backgroundColor: theme.surface, borderRadius: theme.cardRadius, overflow: 'hidden' },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56, paddingHorizontal: 16 },
  historyDate: { flexShrink: 0, ...typeScale.label, color: theme.textPrimary },
  historyValue: { flexShrink: 1, textAlign: 'right', ...typeScale.cardTitle, color: theme.textPrimary },
  metricPickerSection: { gap: 9 },
  metricPickerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricPickerLabel: { ...typeScale.caption, color: theme.textSecondary, letterSpacing: 0.9 },
  addMetricInline: { minHeight: 30, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 9 },
  addMetricInlineText: { ...typeScale.label, color: theme.textPrimary },
  metricPickerContent: { gap: 10, paddingRight: settingsLayout.screenPadding },
  metricPickerCard: { width: 142, minHeight: 82, padding: 11, borderRadius: 16, backgroundColor: theme.surface, gap: 8 },
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
