import React from 'react';
import { View, StyleSheet } from 'react-native';

import { NavigationItem } from './ui';
import { colors } from '../theme/tokens';

const items = [
  ['calendar-outline', 'Dashboard', true, false],
  ['time-outline', 'History', false, false],
  ['fitness-outline', 'Workout', false, true],
  ['layers-outline', 'Plans', false, false],
  ['ellipsis-horizontal', 'More', false, false],
];

export function BottomNavigation({ theme = colors }) {
  return (
    <View style={styles.navigation}>
      {items.map(([icon, label, active, emphasis]) => (
        <NavigationItem key={label} icon={icon} label={label} active={active} emphasis={emphasis} theme={theme} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: { position: 'relative', zIndex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 64, paddingHorizontal: 2, paddingBottom: 4, paddingTop: 4, backgroundColor: 'transparent', borderTopWidth: 0 },
});
