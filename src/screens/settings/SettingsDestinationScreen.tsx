import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen, ForgeText as Text } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { typeScale } from '../../theme/tokens';
import type { RootStackParamList } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';

type DestinationRoute = 'ExerciseLibrary' | 'WorkoutTypes' | 'BackupExport' | 'Logs' | 'About';
type Props = NativeStackScreenProps<RootStackParamList, DestinationRoute>;

const copy: Record<DestinationRoute, string> = {
  ExerciseLibrary: 'Your exercise library will appear here.',
  WorkoutTypes: 'Your workout types will appear here.',
  BackupExport: 'Keep a copy of your training when backup and export are ready.',
  Logs: 'Activity and diagnostic logs will appear here.',
  About: 'Forge helps you keep training simple, focused, and consistent.',
};

export function SettingsDestinationScreen({ navigation, route }: Props) {
  const title = destinationTitle(route.name);
  return (
    <AppScreen backgroundColor={dashboardTheme.background}>
      <View style={styles.screen}>
        <SettingsDetailHeader title={title} navigation={navigation} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.copy}>{copy[route.name]}</Text>
          </View>
        </ScrollView>
      </View>
    </AppScreen>
  );
}

function destinationTitle(route: DestinationRoute): string {
  return {
    ExerciseLibrary: 'Exercises',
    WorkoutTypes: 'Workout types',
    BackupExport: 'Backup & Export',
    Logs: 'Logs',
    About: 'About',
  }[route];
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingTop: 26 },
  card: {
    padding: 20,
    borderRadius: dashboardTheme.cardRadius,
    backgroundColor: dashboardTheme.surface,
    shadowColor: '#17191C',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  copy: { ...typeScale.body, color: dashboardTheme.slate },
});
