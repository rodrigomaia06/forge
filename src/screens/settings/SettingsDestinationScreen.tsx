import React from 'react';
import { Image, Linking, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppScreen, ForgeText as Text } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import type { IconName, RootStackParamList } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { SettingsRow, SettingsSection, settingsLayout } from './SettingsRow';

type DestinationRoute = 'ExerciseLibrary' | 'WorkoutTypes' | 'BackupExport' | 'Logs' | 'About';
type Props = NativeStackScreenProps<RootStackParamList, DestinationRoute>;

export function SettingsDestinationScreen({ navigation, route }: Props) {
  const theme = useForgeTheme();
  const title = {
    ExerciseLibrary: 'Exercises',
    WorkoutTypes: 'Workout types',
    BackupExport: 'Backup & Export',
    Logs: 'Logs',
    About: 'About',
  }[route.name];
  return (
    <AppScreen backgroundColor={theme.background}>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <SettingsDetailHeader title={title} navigation={navigation} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {route.name === 'BackupExport' ? (
            <BackupExport />
          ) : route.name === 'About' ? (
            <About />
          ) : (
            <SettingsSection>
              <Text style={styles.copy}>
                {route.name === 'Logs'
                  ? 'Activity and diagnostic logs will appear here.'
                  : 'Your exercise library will appear here.'}
              </Text>
            </SettingsSection>
          )}
        </ScrollView>
      </View>
    </AppScreen>
  );
}

function BackupExport() {
  return (
    <View style={styles.stack}>
      <SettingsSection
        title="Backup"
        footer="Full backups include all Forge data. Restore makes a safety copy first."
      >
        <Action title="Create backup" divider />
        <Action title="Restore backup" />
      </SettingsSection>
      <SettingsSection
        title="Workout data"
        footer="JSON import adds training without overwriting existing workouts."
      >
        <Action title="Export workout data" subtitle="JSON or text" divider />
        <Action title="Import JSON" />
      </SettingsSection>
      <SettingsSection
        title="Reset"
        footer="Removes your data from this device. Built-in exercises remain."
      >
        <Action title="Reset all data" destructive />
      </SettingsSection>
      <Text style={styles.unavailable}>
        Backup and data tools are not connected in this release.
      </Text>
    </View>
  );
}
function About() {
  const theme = useForgeTheme();
  const openExternal = (url: string): void => {
    void Linking.openURL(url);
  };
  return (
    <View style={styles.stack}>
      <View style={styles.brand}>
        <Image
          source={require('../../../assets/forge-app-icon.png')}
          style={styles.logo}
          accessibilityLabel="Forge icon"
        />
        <View>
          <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>Forge 0.1.0</Text>
          <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
            Training, kept simple.
          </Text>
        </View>
      </View>
      <SettingsSection>
        <Action
          title="Source code"
          icon="git"
          divider
          onPress={() => openExternal('https://github.com/rodrigomaia06/Forge')}
        />
        <Action
          title="License: GPL v3.0"
          icon="license"
          onPress={() => openExternal('https://github.com/rodrigomaia06/Forge/blob/main/LICENSE')}
        />
      </SettingsSection>
      <SettingsSection title="Privacy">
        <Text style={[styles.privacy, { color: theme.textSecondary }]}>
          Forge keeps your workouts on this device. No account, no server, no tracking.
        </Text>
      </SettingsSection>
    </View>
  );
}
function Action({
  title,
  subtitle,
  icon,
  onPress,
  divider = false,
  destructive = false,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onPress?: () => void;
  divider?: boolean;
  destructive?: boolean;
}) {
  return (
    <SettingsRow
      title={title}
      subtitle={subtitle}
      icon={icon}
      destructive={destructive}
      disabled={!onPress}
      onPress={onPress ?? (() => undefined)}
      disclosure={!destructive}
      showDivider={divider}
    />
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: settingsLayout.screenPadding,
    paddingTop: settingsLayout.contentTop,
    paddingBottom: settingsLayout.contentBottom,
  },
  stack: { gap: settingsLayout.sectionGap },
  unavailable: { textAlign: 'center', color: dashboardTheme.slate, ...typeScale.supporting },
  brand: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    overflow: 'hidden',
  },
  brandTitle: { color: dashboardTheme.ink, ...typeScale.sectionTitle },
  brandSubtitle: { marginTop: 3, color: dashboardTheme.slate, ...typeScale.supporting },
  privacy: { padding: 18, color: dashboardTheme.slate, ...typeScale.supporting },
  copy: { padding: 20, color: dashboardTheme.slate, ...typeScale.body },
});
