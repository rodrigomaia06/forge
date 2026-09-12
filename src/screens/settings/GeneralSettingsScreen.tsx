import React, { useMemo } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  ForgeSelectionSheet,
  ForgeSingleSelectList,
  ForgeSwitch,
  ForgeText as Text,
  Icon,
  selectionHaptic,
} from '../../components/ui';
import type { ForgeSingleSelectOption } from '../../components/ui';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { SettingsRow, SettingsSection, settingsLayout } from './SettingsRow';
import { REST_DURATION_OPTIONS } from '../../domain/rest/restDurationOptions';

type Props = NativeStackScreenProps<RootStackParamList, 'GeneralSettings'>;

const appearanceOptions: readonly ForgeSingleSelectOption<AppearancePreference>[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
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
  const { preferences, updatePreferences } = useSettings();
  const theme = useForgeTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [appearanceOpen, setAppearanceOpen] = React.useState(false);
  const [defaultRestOpen, setDefaultRestOpen] = React.useState(false);
  const [reminderOpen, setReminderOpen] = React.useState(false);
  const [headerElevated, setHeaderElevated] = React.useState(false);
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
    <AppScreen backgroundColor={theme.background} edges={['top']}>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <SettingsDetailHeader title="General" navigation={navigation} elevated={headerElevated} />
        <ScrollView
          testID="general-settings-scroll"
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          directionalLockEnabled
          onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
        >
          <SettingsSection
            title="Appearance"
            footer="Dark and System are beta while the visual migration is completed."
          >
            <SettingsRow
              title="Appearance"
              trailing={
                <Text style={[styles.value, { color: theme.textSecondary }]}>
                  {capitalize(preferences.appearance)}
                </Text>
              }
              disclosure
              onPress={() => setAppearanceOpen(true)}
            />
            {Platform.OS === 'web' && width >= 768 && appearanceOpen && (
              <View
                style={[
                  styles.appearanceMenu,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                    shadowColor: theme.shadow,
                  },
                ]}
              >
                <ForgeSingleSelectList
                  options={appearanceOptions}
                  selectedValue={preferences.appearance}
                  onSelect={(value) => {
                    updatePreferences({ appearance: value });
                    setAppearanceOpen(false);
                  }}
                  onSelectedPress={() => setAppearanceOpen(false)}
                />
              </View>
            )}
          </SettingsSection>
          <SettingsSection
            title="Weight"
            footer="Used as the default for bodyweight exercises. Leave empty to keep it unset."
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
              divider
            />
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
          <SettingsSection title="Calendar">
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
          <SettingsSection
            title="Rest timer"
            footer="Controls the timer in Live Workout and its countdown in the Forge dock."
          >
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
                  trailing={
                    <Text style={[styles.value, { color: theme.textSecondary }]}>
                      {formatRestDuration(preferences.defaultRestSeconds)}
                    </Text>
                  }
                  disclosure
                  onPress={() => setDefaultRestOpen(true)}
                  showDivider
                />
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
          <SettingsSection title="Rest timer alert" footer="At the end of a rest, Forge can alert you in-app and on your locked device.">
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
          <SettingsSection
            title="Reminders"
            footer="Reminders are saved as a preference; notifications are not scheduled yet."
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
                trailing={
                  <Text style={[styles.value, { color: theme.textSecondary }]}>
                    {formatSeconds(preferences.unfinishedWorkoutReminderDelay)}
                  </Text>
                }
                disclosure
                onPress={() => setReminderOpen(true)}
              />
            )}
          </SettingsSection>
        </ScrollView>
        <ForgeSelectionSheet
          visible={appearanceOpen && !(Platform.OS === 'web' && width >= 768)}
          onClose={() => setAppearanceOpen(false)}
          accessibilityLabel="Close appearance options"
          title="Appearance"
          options={appearanceOptions}
          selectedValue={preferences.appearance}
          onSelect={(value) => updatePreferences({ appearance: value })}
          testID="appearance-selection-sheet"
          listTestID="appearance-selection-list"
        />
        <ForgeSelectionSheet
          visible={defaultRestOpen}
          onClose={() => setDefaultRestOpen(false)}
          accessibilityLabel="Close default rest time options"
          title="Default rest time"
          options={restOptions}
          selectedValue={preferences.defaultRestSeconds}
          onSelect={(value) => updatePreferences({ defaultRestSeconds: value })}
          testID="default-rest-selection-sheet"
          listTestID="default-rest-selection-list"
        />
        <ForgeSelectionSheet
          visible={reminderOpen}
          onClose={() => setReminderOpen(false)}
          accessibilityLabel="Close reminder delay options"
          title="Remind after"
          options={reminderOptions}
          selectedValue={preferences.unfinishedWorkoutReminderDelay}
          onSelect={(value) => updatePreferences({ unfinishedWorkoutReminderDelay: value })}
          testID="reminder-selection-sheet"
          listTestID="reminder-selection-list"
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
function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  appearanceMenu: {
    position: 'absolute',
    top: 54,
    right: 8,
    zIndex: 5,
    width: 190,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  inputAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weightInput: { width: 76, minHeight: 40, textAlign: 'right', ...typeScale.body },
  unit: { ...typeScale.supporting },
});
