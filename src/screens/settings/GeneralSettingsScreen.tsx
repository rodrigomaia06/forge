import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  AppScreen,
  ForgeText as Text,
  Icon,
  pressedFeedback,
  selectionHaptic,
} from '../../components/ui';
import { useSettings } from '../../state/SettingsContext';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { typeScale } from '../../theme/tokens';
import type { RootStackParamList, WeekStartsOn } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';

type Props = NativeStackScreenProps<RootStackParamList, 'GeneralSettings'>;

export function GeneralSettingsScreen({ navigation }: Props) {
  const { preferences, updatePreferences } = useSettings();
  const setWeekStart = (weekStartsOn: WeekStartsOn): void => {
    if (weekStartsOn === preferences.weekStartsOn) return;
    selectionHaptic();
    updatePreferences({ weekStartsOn });
  };

  return (
    <AppScreen backgroundColor={dashboardTheme.background}>
      <View style={styles.screen}>
        <SettingsDetailHeader title="General" navigation={navigation} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <PreferenceGroup title="Appearance">
            <PreferenceRow title="Light" selected />
          </PreferenceGroup>
          <PreferenceGroup title="Units">
            <PreferenceRow title="Metric" selected />
          </PreferenceGroup>
          <PreferenceGroup title="Week starts on">
            <PreferenceRow
              title="Monday"
              selected={preferences.weekStartsOn === 1}
              onPress={() => setWeekStart(1)}
              showDivider
            />
            <PreferenceRow
              title="Sunday"
              selected={preferences.weekStartsOn === 0}
              onPress={() => setWeekStart(0)}
            />
          </PreferenceGroup>
        </ScrollView>
      </View>
    </AppScreen>
  );
}

function PreferenceGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function PreferenceRow({
  title,
  selected,
  onPress,
  showDivider = false,
}: {
  title: string;
  selected: boolean;
  onPress?: () => void;
  showDivider?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'radio' : 'text'}
      accessibilityLabel={title}
      accessibilityState={{ checked: selected }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && pressedFeedback]}
    >
      <View style={styles.copy}>
        <Text style={styles.rowTitle}>{title}</Text>
      </View>
      {selected && <Icon name="check" size={21} color={dashboardTheme.marker} weight="bold" />}
      {showDivider && <View pointerEvents="none" style={styles.divider} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingTop: 26, paddingBottom: 40, gap: 25 },
  groupTitle: { ...typeScale.label, color: '#78909D', marginLeft: 6, marginBottom: 8 },
  card: {
    borderRadius: dashboardTheme.cardRadius,
    backgroundColor: dashboardTheme.surface,
    shadowColor: '#17191C',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  row: { minHeight: 64, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  rowTitle: { ...typeScale.cardTitle, color: dashboardTheme.ink },
  divider: {
    position: 'absolute',
    right: 18,
    bottom: 0,
    left: 18,
    height: 1,
    backgroundColor: dashboardTheme.divider,
  },
});
