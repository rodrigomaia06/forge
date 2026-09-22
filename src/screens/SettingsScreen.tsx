import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppScreen, ScreenTitle } from '../components/ui';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { spacing } from '../theme/tokens';
import type { RootStackParamList, RootTabScreenProps } from '../types';
import { SettingsRow, SettingsSection, settingsLayout } from './settings/SettingsRow';
import { useForgeDockScrollInset } from '../components/DockChrome';

type Props = RootTabScreenProps<'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const dockScrollInset = useForgeDockScrollInset();
  const open = (screen: keyof RootStackParamList): void => {
    navigation.navigate(screen as never);
  };

  return (
    <AppScreen backgroundColor={theme.background} edges={['top']}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <ScreenTitle testID="settings-title" color={theme.textPrimary}>
            Settings
          </ScreenTitle>
        </View>
        <ScrollView
          testID="settings-scroll"
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: dockScrollInset }]}
          showsVerticalScrollIndicator={false}
        >
          <SettingsSection>
            <SettingsRow
              icon="weight"
              iconSize={26}
              title="Exercises"
              onPress={() => open('ExerciseLibrary')}
              disclosure
              testID="settings-main-exercises-row"
            />
            <SettingsRow
              icon="measure"
              iconSize={26}
              title="Measurements"
              onPress={() => open('DailyMeasurements')}
              disclosure
            />
          </SettingsSection>
          <SettingsSection>
            <SettingsRow
              icon="settings"
              iconSize={26}
              title="General"
              onPress={() => open('GeneralSettings')}
              disclosure
            />
          </SettingsSection>
          <SettingsSection>
            <SettingsRow
              icon="database-export"
              iconSize={26}
              title="Backup & Export"
              onPress={() => open('BackupExport')}
              disclosure
            />
            <SettingsRow
              icon="clipboard"
              iconSize={26}
              title="Logs"
              onPress={() => open('Logs')}
              disclosure
            />
          </SettingsSection>
          <SettingsSection>
            <SettingsRow
              icon="info"
              iconSize={26}
              title="About"
              onPress={() => open('About')}
              disclosure
            />
          </SettingsSection>
        </ScrollView>
      </View>
    </AppScreen>
  );
}

const createStyles = (theme: import('../types').ForgeTheme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    scroll: { flex: 1 },
    header: {
      height: 70,
      justifyContent: 'center',
      paddingHorizontal: spacing.screen,
      backgroundColor: theme.background,
    },
    content: {
      paddingHorizontal: settingsLayout.screenPadding,
      paddingTop: settingsLayout.contentTop,
      gap: settingsLayout.sectionGap,
    },
  });
