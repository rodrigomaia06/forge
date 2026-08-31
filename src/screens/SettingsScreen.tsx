import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { NavigationFooter } from '../components/NavigationFooter';
import { AppScreen, ForgeCard, ScreenTitle, selectionHaptic } from '../components/ui';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { spacing } from '../theme/tokens';
import type { RootStackParamList } from '../types';
import { SettingsRow } from './settings/SettingsRow';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const open = (screen: keyof RootStackParamList): void => {
    selectionHaptic();
    navigation.navigate(screen as never);
  };

  return (
    <AppScreen backgroundColor={theme.background}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <ScreenTitle testID="settings-title" color={theme.textPrimary}>
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
          <ForgeCard variant="elevated" style={styles.aboutCard}>
            <SettingsRow icon="info" title="About" onPress={() => open('About')} />
          </ForgeCard>
        </ScrollView>
        <NavigationFooter />
      </View>
    </AppScreen>
  );
}

function SettingsGroup({ children }: { children: React.ReactNode }) { return <ForgeCard variant="elevated">{children}</ForgeCard>; }

const createStyles = (theme: import('../types').ForgeTheme) => StyleSheet.create({
  screen: { flex: 1 },
  header: {
    height: 70,
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
    backgroundColor: theme.background,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: 17,
    paddingBottom: 112,
    gap: 25,
  },
  aboutCard: {},
});
