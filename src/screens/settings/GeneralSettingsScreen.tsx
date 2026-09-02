import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  ForgeListRow,
  ForgeSelectionSheet,
  ForgeSingleSelectList,
  ForgeSwitch,
  ForgeText as Text,
  Icon,
  pressedFeedback,
  selectionHaptic,
} from '../../components/ui';
import type { ForgeSingleSelectOption } from '../../components/ui';
import { useSettings } from '../../state/SettingsContext';
import { dashboardTheme } from '../../theme/dashboardTheme';
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
const restOptions: readonly ForgeSingleSelectOption<number>[] = REST_DURATION_OPTIONS.map((seconds) => ({
  value: seconds,
  label: formatRestDuration(seconds),
}));

export function GeneralSettingsScreen({ navigation }: Props) {
  const { preferences, updatePreferences } = useSettings();
  const theme = useForgeTheme();
  const { width } = useWindowDimensions();
  const [appearanceOpen, setAppearanceOpen] = React.useState(false);
  const [defaultRestOpen, setDefaultRestOpen] = React.useState(false);
  const [reminderOpen, setReminderOpen] = React.useState(false);
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
    <AppScreen backgroundColor={theme.background}>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <SettingsDetailHeader title="General" navigation={navigation} />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.group}>
            <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>Appearance</Text>
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surfaceElevated, shadowColor: theme.shadow },
              ]}
            >
              <ForgeListRow
                label="Appearance"
                value={capitalize(preferences.appearance)}
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
            </View>
            <Text style={[styles.betaNote, { color: theme.textSecondary }]}>
              Dark and System are beta while the visual migration is completed.
            </Text>
          </View>
          <Group title="Weight">
            <Choice
              title="Metric (kg)"
              selected={preferences.units === 'metric'}
              onPress={() => choose({ units: 'metric' as UnitsPreference })}
            />
            <Choice
              title="Imperial (lb)"
              selected={preferences.units === 'imperial'}
              onPress={() => choose({ units: 'imperial' as UnitsPreference })}
              divider
            />
            <View style={styles.inputRow}>
              <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>Bodyweight</Text>
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
            <Text style={[styles.footer, { color: theme.textSecondary }]}>
              Used as the default for bodyweight exercises. Leave empty to keep it unset.
            </Text>
          </Group>
          <Group title="Calendar">
            <Choice
              title="Monday"
              selected={preferences.weekStartsOn === 1}
              onPress={() => choose({ weekStartsOn: 1 as WeekStartsOn })}
            />
            <Choice
              title="Sunday"
              selected={preferences.weekStartsOn === 0}
              onPress={() => choose({ weekStartsOn: 0 as WeekStartsOn })}
              divider
            />
          </Group>
          <Group title="Rest timer">
            <Toggle
              title="Rest timer"
              value={preferences.showRestTimer}
              onPress={() => choose({ showRestTimer: !preferences.showRestTimer })}
            />
            {preferences.showRestTimer && (
              <>
                <ForgeListRow
                  label="Default rest time"
                  value={formatRestDuration(preferences.defaultRestSeconds)}
                  onPress={() => setDefaultRestOpen(true)}
                  divider
                />
                <Toggle
                  title="Keep rest timer running"
                  value={preferences.keepRestTimerRunning}
                  onPress={() =>
                    choose({ keepRestTimerRunning: !preferences.keepRestTimerRunning })
                  }
                  divider
                />
              </>
            )}
            <Text style={[styles.footer, { color: theme.textSecondary }]}>
              These preferences are saved now; timer behavior remains unchanged in this release.
            </Text>
          </Group>
          <Group title="Rest timer alert">
            <Toggle
              title="Sound"
              value={preferences.restTimerSound}
              onPress={() => choose({ restTimerSound: !preferences.restTimerSound })}
            />
            <Toggle
              title="Haptic"
              value={preferences.restTimerHaptic}
              onPress={() => choose({ restTimerHaptic: !preferences.restTimerHaptic })}
              divider
            />
          </Group>
          <Group title="Reminders">
            <Toggle
              title="Unfinished workout reminder"
              value={preferences.unfinishedWorkoutReminderEnabled}
              onPress={() =>
                choose({
                  unfinishedWorkoutReminderEnabled: !preferences.unfinishedWorkoutReminderEnabled,
                })
              }
            />
            {preferences.unfinishedWorkoutReminderEnabled && (
              <ForgeListRow
                label="Remind after"
                value={formatSeconds(preferences.unfinishedWorkoutReminderDelay)}
                onPress={() => setReminderOpen(true)}
                divider
              />
            )}
            <Text style={[styles.footer, { color: theme.textSecondary }]}>
              Reminders are saved as a preference; notifications are not scheduled yet.
            </Text>
          </Group>
          <Group title="Workout name">
            <Toggle
              title="Show plan in workout name"
              value={preferences.showPlanInWorkoutTitle}
              onPress={() =>
                choose({ showPlanInWorkoutTitle: !preferences.showPlanInWorkoutTitle })
              }
            />
          </Group>
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

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useForgeTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>{title}</Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surfaceElevated,
            borderColor: theme.border,
            shadowColor: theme.shadow,
            shadowOpacity: theme.cardShadowOpacity ?? 0.06,
          },
        ]}
      >
        {children}
      </View>
    </View>
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
  const theme = useForgeTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.pressed }]}
    >
      <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>{title}</Text>
      {selected && <Icon name="check" size={20} color={theme.inkInteractive} weight="bold" />}
      {divider && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
    </Pressable>
  );
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
  const theme = useForgeTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityState={{ checked: value }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.pressed }]}
    >
      <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>{title}</Text>
      <ForgeSwitch value={value} testID={`general-switch-${title.replace(/\s+/g, '-').toLowerCase()}`} />
      {divider && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
    </Pressable>
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
  content: { padding: 20, paddingTop: 24, paddingBottom: 44, gap: 22 },
  group: { gap: 8 },
  betaNote: { ...typeScale.caption, marginHorizontal: 6 },
  value: { ...typeScale.supporting, marginRight: 8 },
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
  groupTitle: { ...typeScale.label, marginLeft: 6 },
  card: {
    overflow: 'hidden',
    borderRadius: dashboardTheme.cardRadius,
    borderWidth: 1,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  row: { minHeight: 56, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
  rowTitle: { flex: 1, minWidth: 0, ...typeScale.body },
  divider: {
    position: 'absolute',
    right: 18,
    bottom: 0,
    left: 18,
    height: StyleSheet.hairlineWidth,
  },
  inputRow: {
    minHeight: 56,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weightInput: { width: 76, minHeight: 40, textAlign: 'right', ...typeScale.body },
  unit: { ...typeScale.supporting },
  footer: { paddingHorizontal: 18, paddingBottom: 14, ...typeScale.caption },
});
