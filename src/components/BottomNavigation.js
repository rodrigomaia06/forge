import React from 'react';
import { View, StyleSheet } from 'react-native';

import { NavigationItem } from './ui';
import { colors } from '../theme/tokens';

const items = [
  ['calendar-outline', 'Dashboard', true],
  ['layers-outline', 'Plans', false],
  ['time-outline', 'History', false],
  ['ellipsis-horizontal', 'More', false],
];

export function BottomNavigation({ theme = colors }) {
  return (
    <View style={styles.navigation}>
      {items.map(([icon, label, active]) => (
        <NavigationItem key={label} icon={icon} label={label} active={active} theme={theme} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: { position: 'relative', zIndex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 64, paddingHorizontal: 8, paddingBottom: 6, paddingTop: 6, backgroundColor: 'transparent', borderTopWidth: 0 },
});
