import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useMemo } from 'react';
import {
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
  const reminderMenu = useAnchoredMenu();
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
          <SettingsSection
            title="Appearance"
            footer="Dark and System are beta while the visual migration is completed."
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
          <SettingsSection
            title="Weight"
            footer="Stored locally as your bodyweight reference. Leave empty to keep it unset."
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
            footer="Controls the rest timer in Live Workout, its notification and its native activity."
          >
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
            footer="Forge sends one local reminder while an unfinished workout remains open."
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
        </ScrollView>
        <ForgeAnchoredMenu
          visible={restMenu.visible}
          anchor={restMenu.anchor}
          onClose={restMenu.close}
          align="stretch"
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
          visible={reminderMenu.visible}
          anchor={reminderMenu.anchor}
          onClose={reminderMenu.close}
          align="stretch"
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
  inputAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weightInput: { width: 76, minHeight: 40, textAlign: 'right', ...typeScale.body },
  unit: { ...typeScale.supporting },
});
