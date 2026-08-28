import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { NavigationFooter } from '../components/NavigationFooter';
import { AppScreen, ScreenTitle, selectionHaptic } from '../components/ui';
import { dashboardTheme } from '../theme/dashboardTheme';
import { spacing } from '../theme/tokens';
import type { RootStackParamList } from '../types';
import { SettingsRow } from './settings/SettingsRow';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const open = (screen: keyof RootStackParamList): void => {
    selectionHaptic();
    navigation.navigate(screen as never);
  };

  return (
    <AppScreen backgroundColor={dashboardTheme.background}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <ScreenTitle testID="settings-title" color={dashboardTheme.ink}>
            Settings
          </ScreenTitle>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SettingsGroup>
            <SettingsRow
              icon="fitness"
              title="Exercises"
              onPress={() => open('ExerciseLibrary')}
              showDivider
            />
            <SettingsRow icon="book" title="Workout types" onPress={() => open('WorkoutTypes')} />
          </SettingsGroup>
          <SettingsGroup>
            <SettingsRow icon="settings" title="General" onPress={() => open('GeneralSettings')} />
          </SettingsGroup>
          <SettingsGroup>
            <SettingsRow
              icon="database-export"
              title="Backup & Export"
              onPress={() => open('BackupExport')}
              showDivider
            />
            <SettingsRow icon="clipboard" title="Logs" onPress={() => open('Logs')} />
          </SettingsGroup>
          <View style={styles.aboutCard}>
            <SettingsRow icon="info" title="About" onPress={() => open('About')} />
          </View>
        </ScrollView>
        <NavigationFooter />
      </View>
    </AppScreen>
  );
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const cardStyle = {
  borderRadius: dashboardTheme.cardRadius,
  backgroundColor: dashboardTheme.surface,
  shadowColor: '#17191C',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    height: 70,
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
    backgroundColor: dashboardTheme.background,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: 17,
    paddingBottom: 112,
    gap: 25,
  },
  card: cardStyle,
  aboutCard: cardStyle,
});
