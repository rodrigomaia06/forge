import React from 'react';
import { StyleSheet, View } from 'react-native';

import { HeaderAction, ForgeText as Text } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';

export function SettingsDetailHeader({
  title,
  navigation,
  rightAction,
  backAccessibilityLabel = 'Back to Settings',
}: {
  title: string;
  navigation: { goBack: () => void };
  rightAction?: React.ReactNode;
  backAccessibilityLabel?: string;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.header, { backgroundColor: theme.header }]}>
      <HeaderAction
        accessibilityLabel={backAccessibilityLabel}
        icon="chevron-back"
        label="Back"
        iconOnly
        onPress={() => navigation.goBack()}
      />
      <View style={[styles.titleWrap, styles.pointerEventsNone]}>
        <Text
          testID="settings-detail-title"
          style={[styles.title, { color: theme.textPrimary }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      <View style={styles.spacer}>{rightAction}</View>
    </View>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) =>
  StyleSheet.create({
    pointerEventsNone: { pointerEvents: 'none' },
    header: {
      height: 70,
      paddingHorizontal: 20,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: theme.background,
    },
  titleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
      alignItems: 'center',
    },
    title: { ...typeScale.headerTitle, color: theme.ink },
    spacer: { width: 100, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  });
