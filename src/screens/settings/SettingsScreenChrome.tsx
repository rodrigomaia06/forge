import React from 'react';
import { StyleSheet, View } from 'react-native';

import { HeaderAction, HeaderEdge, ForgeText as Text } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { typeScale } from '../../theme/tokens';

export function SettingsDetailHeader({
  title,
  navigation,
}: {
  title: string;
  navigation: { goBack: () => void };
}) {
  return (
    <View style={styles.header}>
      <HeaderAction
        accessibilityLabel="Back to Settings"
        icon="chevron-back"
        label="Back"
        iconOnly
        onPress={() => navigation.goBack()}
      />
      <View style={styles.titleWrap} pointerEvents="none">
        <Text testID="settings-detail-title" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={styles.spacer} />
      <HeaderEdge />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 70,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: dashboardTheme.background,
  },
  titleWrap: {
    position: 'absolute',
    left: 124,
    right: 124,
    alignItems: 'center',
  },
  title: { ...typeScale.headerTitle, color: dashboardTheme.ink },
  spacer: { width: 100, height: 44 },
});
