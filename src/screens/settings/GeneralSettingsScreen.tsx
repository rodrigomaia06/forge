import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  ForgeAnchoredMenu,
  ForgeSegmentedSwitch,
  ForgeSingleSelectList,
  ForgeSwitch,
  ForgeText as Text,
  Icon,
  selectionHaptic,
  useAnchoredMenu,
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
import { REST_DURATION_OPTIONS } from '../../domain/rest/restDurationOptions';

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
const restOptions: readonly ForgeSingleSelectOption<number>[] = REST_DURATION_OPTIONS.map(
  (seconds) => ({
    value: seconds,
    label: formatRestDuration(seconds),
  }),
);

export function GeneralSettingsScreen({ navigation }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { preferences, updatePreferences } = useSettings();
  const theme = useForgeTheme();
  const restMenu = useAnchoredMenu();
  const unilateralRestMenu = useAnchoredMenu();
  const reminderMenu = useAnchoredMenu();
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
    updatePreferences(changes);
  };
  const setWeight = (value: string) => {
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
          <View style={[styles.searchField, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Icon name="search" size={18} color={theme.textSecondary} />
            <TextInput
              accessibilityLabel="Search settings"
              value={query}
              onChangeText={setQuery}
              placeholder="Search settings"
              placeholderTextColor={theme.textDisabled}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={[styles.searchInput, { color: theme.textPrimary }]}
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQuery('')}
                hitSlop={8}
              >
                <Icon name="close" size={18} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
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
                    value={displayedWeight ? String(displayedWeight) : ''}
                    onChangeText={setWeight}
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
                <View ref={restMenu.ref} collapsable={false}>
                  <SettingsRow
                    title="Default rest time"
                    trailing={
                      <Text style={[styles.value, { color: theme.textSecondary }]}>
                        {formatRestDuration(preferences.defaultRestSeconds)}
                      </Text>
                    }
                    disclosure
                    onPress={restMenu.open}
                    showDivider
                  />
                </View>
                <View ref={unilateralRestMenu.ref} collapsable={false}>
                  <SettingsRow
                    title="Rest between sides"
                    subtitle="Unilateral exercises, after the first side"
                    trailing={
                      <Text style={[styles.value, { color: theme.textSecondary }]}>
                        {formatRestDuration(preferences.defaultUnilateralRestSeconds)}
                      </Text>
                    }
                    disclosure
                    onPress={unilateralRestMenu.open}
                    showDivider
                  />
                </View>
                <Toggle
                  title="Keep rest timer running"
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
              <View ref={reminderMenu.ref} collapsable={false}>
                <SettingsRow
                  title="Remind after"
                  trailing={
                    <Text style={[styles.value, { color: theme.textSecondary }]}>
                      {formatSeconds(preferences.unfinishedWorkoutReminderDelay)}
                    </Text>
                  }
                  disclosure
                  onPress={reminderMenu.open}
                />
              </View>
            )}
          </SettingsSection>
          )}
          {!anyMatch ? (
            <Text style={[styles.noResults, { color: theme.textSecondary }]}>
              No settings match “{query.trim()}”.
            </Text>
          ) : null}
        </ScrollView>
        <ForgeAnchoredMenu
          visible={restMenu.visible}
          anchor={restMenu.anchor}
          onClose={restMenu.close}
          align="end"
          minWidth={180}
          initialScrollOffset={Math.max(0, (restOptions.findIndex((option) => option.value === preferences.defaultRestSeconds) - 2) * 52)}
          testID="default-rest-selection-menu"
        >
          <ForgeSingleSelectList
            testID="default-rest-selection-list"
            options={restOptions}
            selectedValue={preferences.defaultRestSeconds}
            rounded
            disableVirtualization
            onSelect={(value) => {
              updatePreferences({ defaultRestSeconds: value });
              restMenu.close();
            }}
            onSelectedPress={() => restMenu.close()}
          />
        </ForgeAnchoredMenu>
        <ForgeAnchoredMenu
          visible={unilateralRestMenu.visible}
          anchor={unilateralRestMenu.anchor}
          onClose={unilateralRestMenu.close}
          align="end"
          minWidth={180}
          initialScrollOffset={Math.max(0, (restOptions.findIndex((option) => option.value === preferences.defaultUnilateralRestSeconds) - 2) * 52)}
          testID="default-unilateral-rest-selection-menu"
        >
          <ForgeSingleSelectList
            testID="default-unilateral-rest-selection-list"
            options={restOptions}
            selectedValue={preferences.defaultUnilateralRestSeconds}
            rounded
            disableVirtualization
            onSelect={(value) => {
              updatePreferences({ defaultUnilateralRestSeconds: value });
              unilateralRestMenu.close();
            }}
            onSelectedPress={() => unilateralRestMenu.close()}
          />
        </ForgeAnchoredMenu>
        <ForgeAnchoredMenu
          visible={reminderMenu.visible}
          anchor={reminderMenu.anchor}
          onClose={reminderMenu.close}
          align="end"
          minWidth={180}
          testID="reminder-selection-menu"
        >
          <ForgeSingleSelectList
            testID="reminder-selection-list"
            options={reminderOptions}
            selectedValue={preferences.unfinishedWorkoutReminderDelay}
            rounded
            disableVirtualization
            onSelect={(value) => {
              updatePreferences({ unfinishedWorkoutReminderDelay: value });
              reminderMenu.close();
            }}
            onSelectedPress={() => reminderMenu.close()}
          />
        </ForgeAnchoredMenu>
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
  value,
  onPress,
  divider = false,
}: {
  title: string;
  value: boolean;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <SettingsRow
      title={title}
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
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
  },
  searchInput: { flex: 1, minHeight: 44, ...typeScale.body, padding: 0 },
  noResults: { ...typeScale.supporting, textAlign: 'center', paddingVertical: 24 },
  inputAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weightInput: { width: 76, minHeight: 40, textAlign: 'right', ...typeScale.body },
  unit: { ...typeScale.supporting },
});
