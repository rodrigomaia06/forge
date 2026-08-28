import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ForgeText as Text, Icon, pressedFeedback } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { typeScale } from '../../theme/tokens';
import type { IconName } from '../../types';

interface SettingsRowProps {
  icon: IconName;
  title: string;
  onPress: () => void;
  showDivider?: boolean;
}

export function SettingsRow({ icon, title, onPress, showDivider = false }: SettingsRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && pressedFeedback]}
    >
      <Icon name={icon} size={25} color={dashboardTheme.ink} />
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <Icon name="chevron-forward" size={21} color={dashboardTheme.slate} />
      {showDivider && <View pointerEvents="none" style={styles.divider} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  copy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  title: { ...typeScale.cardTitle, color: dashboardTheme.ink },
  divider: {
    position: 'absolute',
    height: 1,
    backgroundColor: dashboardTheme.divider,
    right: 18,
    bottom: 0,
    left: 54,
  },
});
