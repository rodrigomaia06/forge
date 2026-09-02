import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppScreen, ForgeCard, ForgeText as Text, Icon, lightHaptic, pressedFeedback } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import type { IconName, RootStackParamList } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';

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
            <Card>
              <Text style={styles.copy}>
                {route.name === 'Logs'
                  ? 'Activity and diagnostic logs will appear here.'
                  : 'Your exercise library will appear here.'}
              </Text>
            </Card>
          )}
        </ScrollView>
      </View>
    </AppScreen>
  );
}

function BackupExport() {
  return (
    <View style={styles.stack}>
      <Group
        title="Backup"
        footer="Full backups include all Forge data. Restore makes a safety copy first."
      >
        <Action title="Create backup" />
        <Action title="Restore backup" divider />
      </Group>
      <Group
        title="Workout data"
        footer="JSON import adds training without overwriting existing workouts."
      >
        <Action title="Export workout data" subtitle="JSON or text" />
        <Action title="Import JSON" divider />
      </Group>
      <Group title="Reset" footer="Removes your data from this device. Built-in exercises remain.">
        <Action title="Reset all data" destructive />
      </Group>
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
        <Image source={require('../../../assets/forge-app-icon.png')} style={styles.logo} accessibilityLabel="Forge icon" />
        <View>
          <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>Forge 0.1.0</Text>
          <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
            Training, kept simple.
          </Text>
        </View>
      </View>
      <Card>
        <Action title="Source code" icon="git" onPress={() => openExternal('https://github.com/rodrigomaia06/Forge')} />
        <Action title="License: GPL v3.0" icon="license" divider onPress={() => openExternal('https://github.com/rodrigomaia06/Forge/blob/main/LICENSE')} />
      </Card>
      <Group title="Privacy">
        <Text style={[styles.privacy, { color: theme.textSecondary }]}>
          Forge keeps your workouts on this device. No account, no server, no tracking.
        </Text>
      </Group>
    </View>
  );
}
function Group({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: React.ReactNode;
}) {
  const theme = useForgeTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>{title}</Text>
      <Card>{children}</Card>
      {footer && <Text style={[styles.footer, { color: theme.textSecondary }]}>{footer}</Text>}
    </View>
  );
}
function Card({ children }: { children: React.ReactNode }) { return <ForgeCard variant="elevated">{children}</ForgeCard>; }
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
  const theme = useForgeTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={() => {
        if (!onPress) return;
        lightHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.action, onPress && pressed && { backgroundColor: theme.pressed }]}
    >
      {icon && <Icon name={icon} size={21} color={theme.textPrimary} />}
      <View style={styles.actionCopy}>
        <Text
          style={[
            styles.actionTitle,
            { color: destructive ? theme.textDestructive : theme.textPrimary },
          ]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.actionSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        )}
      </View>
      {!destructive && <Icon name="chevron-forward" size={18} color={theme.textSecondary} />}
      {divider && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingTop: 24, paddingBottom: 44 },
  stack: { gap: 22 },
  group: { gap: 8 },
  groupTitle: { marginLeft: 6, color: dashboardTheme.slate, ...typeScale.label },
  footer: { paddingHorizontal: 6, color: dashboardTheme.slate, ...typeScale.caption },
  action: {
    minHeight: 58,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { color: dashboardTheme.ink, ...typeScale.body },
  actionSubtitle: { marginTop: 2, color: dashboardTheme.slate, ...typeScale.caption },
  divider: {
    position: 'absolute',
    right: 18,
    bottom: 0,
    left: 18,
    height: StyleSheet.hairlineWidth,
    backgroundColor: dashboardTheme.divider,
  },
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
