import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { NavigationFooter } from '../components/NavigationFooter';
import { AppScreen, ScreenTitle } from '../components/ui';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { spacing } from '../theme/tokens';
import type { RootStackParamList } from '../types';
import { SettingsRow, SettingsSection, settingsLayout } from './settings/SettingsRow';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const open = (screen: keyof RootStackParamList): void => {
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
          <SettingsSection>
            <SettingsRow
              icon="fitness"
              iconBackgroundColor={theme.surfaceMuted}
              title="Exercises"
              onPress={() => open('ExerciseLibrary')}
              disclosure
              showDivider
              testID="settings-main-exercises-row"
              style={styles.rootRow}
            />
            <SettingsRow
              icon="book"
              iconBackgroundColor={theme.surfaceMuted}
              title="Workout types"
              onPress={() => open('WorkoutTypes')}
              disclosure
              style={styles.rootRow}
            />
          </SettingsSection>
          <SettingsSection>
            <SettingsRow
              icon="settings"
              iconBackgroundColor={theme.surfaceMuted}
              title="General"
              onPress={() => open('GeneralSettings')}
              disclosure
              style={styles.rootRow}
            />
          </SettingsSection>
          <SettingsSection>
            <SettingsRow
              icon="database-export"
              iconBackgroundColor={theme.surfaceMuted}
              title="Backup & Export"
              onPress={() => open('BackupExport')}
              disclosure
              showDivider
              style={styles.rootRow}
            />
            <SettingsRow
              icon="clipboard"
              iconBackgroundColor={theme.surfaceMuted}
              title="Logs"
              onPress={() => open('Logs')}
              disclosure
              style={styles.rootRow}
            />
          </SettingsSection>
          <SettingsSection>
            <SettingsRow
              icon="info"
              iconBackgroundColor={theme.surfaceMuted}
              title="About"
              onPress={() => open('About')}
              disclosure
              style={styles.rootRow}
            />
          </SettingsSection>
        </ScrollView>
        <NavigationFooter />
      </View>
    </AppScreen>
  );
}

const createStyles = (theme: import('../types').ForgeTheme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    header: {
      height: 70,
      justifyContent: 'center',
      paddingHorizontal: spacing.screen,
      backgroundColor: theme.background,
    },
    content: {
      paddingHorizontal: settingsLayout.screenPadding,
      paddingTop: settingsLayout.contentTop,
      paddingBottom: settingsLayout.rootContentBottom,
      gap: settingsLayout.sectionGap,
    },
    rootRow: { minHeight: 68 },
  });
