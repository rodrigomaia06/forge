import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ForgeText as Text, Icon, lightHaptic, pressedFeedback } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { IconName } from '../../types';

interface SettingsRowProps {
  icon: IconName;
  title: string;
  onPress: () => void;
  showDivider?: boolean;
}

export function SettingsRow({ icon, title, onPress, showDivider = false }: SettingsRowProps) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        lightHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && pressedFeedback]}
    >
      <Icon name={icon} size={25} color={theme.textPrimary} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <Icon name="chevron-forward" size={21} color={theme.textSecondary} />
      {showDivider && (
        <View pointerEvents="none" style={[styles.divider, { backgroundColor: theme.divider }]} />
      )}
    </Pressable>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) =>
  StyleSheet.create({
    row: {
      minHeight: 68,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    copy: { flex: 1, minWidth: 0, justifyContent: 'center' },
    title: { ...typeScale.cardTitle, color: theme.ink },
    divider: {
      position: 'absolute',
      height: 1,
      backgroundColor: theme.divider,
      right: 18,
      bottom: 0,
      left: 54,
    },
  });
