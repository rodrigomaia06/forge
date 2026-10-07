import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { startTransition, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  ForgeRestDurationSheet,
  ForgeSearchField,
  ForgeSegmentedSwitch,
  ForgeSelectionSheet,
  ForgeSwitch,
  ForgeText as Text,
  Icon,
  selectionHaptic,
} from '../../components/ui';
import type { ForgeSegmentedOption, ForgeSingleSelectOption } from '../../components/ui';
import { useSettings } from '../../state/SettingsContext';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import type {
  AppearancePreference,
  RootStackParamList,
  SettingsPreferences,
  UnitsPreference,
  WeekStartsOn,
} from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { SettingsRow, SettingsSection, settingsLayout } from './SettingsRow';

type Props = NativeStackScreenProps<RootStackParamList, 'GeneralSettings'>;

const appearanceSegments: readonly ForgeSegmentedOption<AppearancePreference>[] = [
  { value: 'system', label: 'System', icon: 'theme-system' },
  { value: 'light', label: 'Light', icon: 'theme-light' },
  { value: 'dark', label: 'Dark', icon: 'theme-dark' },
];
const reminderOptions: readonly ForgeSingleSelectOption<number>[] = [
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 7200, label: '2 hours' },
];
export function GeneralSettingsScreen({ navigation }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { preferences, updatePreferences } = useSettings();
  const theme = useForgeTheme();
  const [restSheetOpen, setRestSheetOpen] = React.useState(false);
  const [unilateralRestSheetOpen, setUnilateralRestSheetOpen] = React.useState(false);
  const [reminderSheetOpen, setReminderSheetOpen] = React.useState(false);
  const [headerElevated, setHeaderElevated] = React.useState(false);
  const [query, setQuery] = React.useState('');
  // Lightweight in-screen filter: a section shows when its title or any of its
  // keywords contains the query, so the whole (self-consistent) section stays
  // intact rather than hiding dependent sub-rows.
  const q = query.trim().toLowerCase();
  const matches = (...terms: string[]): boolean => !q || terms.some((term) => term.includes(q));
  const anyMatch =
    matches('appearance', 'theme', 'display', 'dark', 'light', 'system') ||
    matches('units', 'metric', 'imperial', 'kg', 'lb', 'kilograms', 'pounds') ||
    matches('bodyweight', 'body weight') ||
    matches('calendar', 'week', 'starts', 'monday', 'sunday') ||
    matches('rest timer', 'rest', 'duration', 'between sides', 'unilateral', 'keep running') ||
    matches('rest timer alert', 'sound', 'haptic', 'vibration', 'alert') ||
    matches('reminders', 'unfinished', 'workout', 'reminder', 'notification');
  const displayedWeight = useMemo(
    () =>
      preferences.units === 'imperial'
        ? Math.round(preferences.bodyweightKg * 2.20462 * 10) / 10
        : preferences.bodyweightKg,
    [preferences.bodyweightKg, preferences.units],
  );
  const choose = (changes: Partial<SettingsPreferences>) => {
    selectionHaptic();
    // An appearance switch re-renders every themed consumer at once. Mark it as a
    // non-urgent transition so React schedules that cascade cooperatively instead of
    // blocking one frame (the "lag spike"); the app stays responsive during the swap.
    if ('appearance' in changes) {
      startTransition(() => { void updatePreferences(changes); });
    } else {
      updatePreferences(changes);
    }
  };
  // A local draft holds the raw text while the field is focused, so a trailing
  // decimal point (e.g. "70.") survives instead of being stripped by the
  // controlled value re-deriving from the committed number every keystroke.
  const [weightDraft, setWeightDraft] = React.useState<string | null>(null);
  const commitWeight = (value: string) => {
    const number = Number(value.replace(',', '.'));
    updatePreferences({
      bodyweightKg:
        Number.isFinite(number) && number > 0
          ? preferences.units === 'imperial'
            ? number / 2.20462
            : number
          : 0,
    });
  };
  const onChangeWeight = (value: string) => {
    setWeightDraft(value);
    commitWeight(value);
  };
  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <SettingsDetailHeader title="General" navigation={navigation} elevated={headerElevated} />
        <ScrollView
          testID="general-settings-scroll"
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: styles.content.padding + bottomInset }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          directionalLockEnabled
          onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
        >
          <ForgeSearchField
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="Search settings"
            placeholder="Search settings"
          />
          {matches('appearance', 'theme', 'display', 'dark', 'light', 'system') && (
          <SettingsSection
            title="Appearance"
            icon="contrast"
            info="Dark and System are beta while the visual migration is completed."
          >
            <SettingsRow
              title="Appearance"
              trailing={
                <ForgeSegmentedSwitch
                  options={appearanceSegments}
                  value={preferences.appearance}
                  onChange={(value) => choose({ appearance: value })}
                  accessibilityLabel="Appearance"
                />
              }
            />
          </SettingsSection>
          )}
          {matches('units', 'metric', 'imperial', 'kg', 'lb', 'kilograms', 'pounds') && (
          <SettingsSection
            title="Units"
            icon="measure"
            info="Applies to every weight shown across Forge."
          >
            <Choice
              title="Metric (kg)"
              selected={preferences.units === 'metric'}
              onPress={() => choose({ units: 'metric' as UnitsPreference })}
              divider
            />
            <Choice
              title="Imperial (lb)"
              selected={preferences.units === 'imperial'}
              onPress={() => choose({ units: 'imperial' as UnitsPreference })}
            />
          </SettingsSection>
          )}
          {matches('bodyweight', 'body weight') && (
          <SettingsSection
            title="Bodyweight"
            icon="weight"
            info="Stored locally as your bodyweight reference. Leave empty to keep it unset."
          >
            <SettingsRow
              title="Bodyweight"
              trailing={
                <View style={styles.inputAction}>
                  <TextInput
                    accessibilityLabel="Bodyweight"
                    value={weightDraft ?? (displayedWeight ? String(displayedWeight) : '')}
                    onChangeText={onChangeWeight}
                    onBlur={() => setWeightDraft(null)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={theme.textDisabled}
                    style={[styles.weightInput, { color: theme.textPrimary }]}
                  />
                  <Text style={[styles.unit, { color: theme.textSecondary }]}>
                    {preferences.units === 'imperial' ? 'lb' : 'kg'}
                  </Text>
                </View>
              }
            />
          </SettingsSection>
          )}
          {matches('calendar', 'week', 'starts', 'monday', 'sunday') && (
          <SettingsSection title="Calendar" icon="calendar">
            <Choice
              title="Monday"
              selected={preferences.weekStartsOn === 1}
              onPress={() => choose({ weekStartsOn: 1 as WeekStartsOn })}
              divider
            />
            <Choice
              title="Sunday"
              selected={preferences.weekStartsOn === 0}
              onPress={() => choose({ weekStartsOn: 0 as WeekStartsOn })}
            />
          </SettingsSection>
          )}
          {matches('rest timer', 'rest', 'duration', 'between sides', 'unilateral', 'keep running') && (
          <SettingsSection title="Rest timer" icon="stopwatch">
            <Toggle
              title="Rest timer"
              value={preferences.showRestTimer}
              onPress={() => choose({ showRestTimer: !preferences.showRestTimer })}
              divider={preferences.showRestTimer}
            />
            {preferences.showRestTimer && (
              <>
                <SettingsRow
                  title="Default rest time"
                  subtitle="Timer length after each completed set"
                  trailing={
                    <Text style={[styles.value, { color: theme.textSecondary }]}>
                      {formatRestDuration(preferences.defaultRestSeconds)}
                    </Text>
                  }
                  disclosure
                  onPress={() => setRestSheetOpen(true)}
                  showDivider
                />
                {!preferences.disableUnilateralBetweenSidesRest && (
                  <SettingsRow
                    title="Rest between sides"
                    subtitle="Unilateral exercises, after the first side"
                    trailing={
                      <Text style={[styles.value, { color: theme.textSecondary }]}>
                        {formatRestDuration(preferences.defaultUnilateralRestSeconds)}
                      </Text>
                    }
                    disclosure
                    onPress={() => setUnilateralRestSheetOpen(true)}
                    showDivider
                  />
                )}
                <Toggle
                  title="Skip rest between sides"
                  subtitle="No rest timer between the two sides of a unilateral exercise"
                  value={preferences.disableUnilateralBetweenSidesRest}
                  onPress={() =>
                    choose({ disableUnilateralBetweenSidesRest: !preferences.disableUnilateralBetweenSidesRest })
                  }
                  divider
                />
                <Toggle
                  title="Keep rest timer running"
                  subtitle="Keep counting after you leave the workout screen"
                  value={preferences.keepRestTimerRunning}
                  onPress={() =>
                    choose({ keepRestTimerRunning: !preferences.keepRestTimerRunning })
                  }
                />
              </>
            )}
          </SettingsSection>
          )}
          {matches('rest timer alert', 'sound', 'haptic', 'vibration', 'alert') && (
          <SettingsSection title="Rest timer alert" icon="bell" info="At the end of a rest, Forge can alert you in-app and on your locked device.">
            <Toggle
              title="Sound"
              value={preferences.restTimerSound}
              onPress={() => choose({ restTimerSound: !preferences.restTimerSound })}
              divider
            />
            <Toggle
              title="Haptic"
              value={preferences.restTimerHaptic}
              onPress={() => choose({ restTimerHaptic: !preferences.restTimerHaptic })}
            />
          </SettingsSection>
          )}
          {matches('reminders', 'unfinished', 'workout', 'reminder', 'notification') && (
          <SettingsSection
            title="Reminders"
            icon="bell-ringing"
            info="Forge sends one local reminder while an unfinished workout remains open."
          >
            <Toggle
              title="Unfinished workout reminder"
              value={preferences.unfinishedWorkoutReminderEnabled}
              onPress={() =>
                choose({
                  unfinishedWorkoutReminderEnabled: !preferences.unfinishedWorkoutReminderEnabled,
                })
              }
              divider={preferences.unfinishedWorkoutReminderEnabled}
            />
            {preferences.unfinishedWorkoutReminderEnabled && (
              <SettingsRow
                title="Remind after"
                subtitle="How long an open workout waits before the reminder"
                trailing={
                  <Text style={[styles.value, { color: theme.textSecondary }]}>
                    {formatSeconds(preferences.unfinishedWorkoutReminderDelay)}
                  </Text>
                }
                disclosure
                onPress={() => setReminderSheetOpen(true)}
              />
            )}
          </SettingsSection>
          )}
          {!anyMatch ? (
            <Text style={[styles.noResults, { color: theme.textSecondary }]}>
              No settings match “{query.trim()}”.
            </Text>
          ) : null}
        </ScrollView>
        <ForgeRestDurationSheet
          visible={restSheetOpen}
          onClose={() => setRestSheetOpen(false)}
          title="Default rest time"
          selectedDuration={preferences.defaultRestSeconds}
          onSelect={(value) => updatePreferences({ defaultRestSeconds: value })}
          testID="default-rest-sheet"
        />
        <ForgeRestDurationSheet
          visible={unilateralRestSheetOpen}
          onClose={() => setUnilateralRestSheetOpen(false)}
          title="Side rest"
          selectedDuration={preferences.defaultUnilateralRestSeconds}
          onSelect={(value) => updatePreferences({ defaultUnilateralRestSeconds: value })}
          testID="unilateral-rest-sheet"
        />
        <ForgeSelectionSheet
          visible={reminderSheetOpen}
          onClose={() => setReminderSheetOpen(false)}
          accessibilityLabel="Close remind after picker"
          title="Remind after"
          options={reminderOptions}
          selectedValue={preferences.unfinishedWorkoutReminderDelay}
          onSelect={(value) => updatePreferences({ unfinishedWorkoutReminderDelay: value })}
          testID="reminder-sheet"
        />
      </View>
    </AppScreen>
  );
}

function Choice({
  title,
  selected,
  onPress,
  divider = false,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <SettingsRow
      title={title}
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      haptic="none"
      trailing={selected ? <ChoiceCheck /> : undefined}
      showDivider={divider}
    />
  );
}
function ChoiceCheck() {
  const theme = useForgeTheme();
  return <Icon name="check" size={20} color={theme.selectionIndicator} weight="bold" />;
}
function Toggle({
  title,
  subtitle,
  value,
  onPress,
  divider = false,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <SettingsRow
      title={title}
      subtitle={subtitle}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityState={{ checked: value }}
      onPress={onPress}
      haptic="none"
      trailing={
        <ForgeSwitch
          value={value}
          testID={`general-switch-${title.replace(/\s+/g, '-').toLowerCase()}`}
        />
      }
      showDivider={divider}
    />
  );
}
function formatSeconds(seconds: number) {
  if (seconds >= 3600) {
    const hours = seconds / 3600;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return `${Math.round(seconds / 60)} min`;
}
function formatRestDuration(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    padding: settingsLayout.screenPadding,
    paddingTop: settingsLayout.contentTop,
    gap: settingsLayout.sectionGap,
  },
  value: { ...typeScale.supporting },
  noResults: { ...typeScale.supporting, textAlign: 'center', paddingVertical: 24 },
  inputAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weightInput: { width: 76, minHeight: 40, textAlign: 'right', ...typeScale.body },
  unit: { ...typeScale.supporting },
});
