import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ForgeBackButton, HeaderEdge, ForgeText as Text } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';

export function SettingsDetailHeader({
  title,
  navigation,
  rightAction,
  backAccessibilityLabel = 'Back to Settings',
  elevated = false,
  titleContent,
}: {
  title: string;
  titleContent?: React.ReactNode;
  navigation: { goBack: () => void };
  rightAction?: React.ReactNode;
  backAccessibilityLabel?: string;
  elevated?: boolean;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.header, { backgroundColor: theme.header }]}>
      <ForgeBackButton
        accessibilityLabel={backAccessibilityLabel}
        onPress={() => navigation.goBack()}
      />
      {titleContent ?? <View style={styles.titleWrap}>
        <Text
          testID="settings-detail-title"
          style={[styles.title, { color: theme.textPrimary }]}
        >
          {title}
        </Text>
      </View>}
      <View style={styles.spacer}>{rightAction}</View>
      {elevated ? <HeaderEdge /> : null}
    </View>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) =>
  StyleSheet.create({
    pointerEventsNone: { pointerEvents: 'none' },
    header: {
      position: 'relative',
      zIndex: 2,
      minHeight: 70,
      paddingVertical: 12,
      gap: 12,
      paddingHorizontal: 20,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: theme.background,
    },
  titleWrap: {
    flex: 1,
    minWidth: 0,
      alignItems: 'center',
    },
    title: { ...typeScale.headerTitle, color: theme.ink },
    spacer: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  });
