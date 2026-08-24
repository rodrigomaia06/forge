import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { NavigationItem } from './ui';
import { colors } from '../theme/tokens';
import { useWorkouts } from '../state/WorkoutContext';
import type { ForgeTheme, IconName, RootNavigationProp, RootStackParamList } from '../types';
import type { RouteProp } from '@react-navigation/native';

interface BottomNavigationProps {
  theme?: ForgeTheme;
}
type NavigationItemEntry = [IconName, string, keyof RootStackParamList, boolean];

export function BottomNavigation({ theme = colors }: BottomNavigationProps) {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList>>();
  const activeWorkout = useWorkouts().activeWorkout;
  const items: NavigationItemEntry[] = [
    ['home-outline', 'Dashboard', 'Dashboard', false],
    ['time-outline', 'History', 'History', false],
    ...(activeWorkout ? [['play', 'Workout', 'ActiveWorkout', true] as NavigationItemEntry] : []),
    ['book', 'Plans', 'Plans', false],
    ['menu', 'More', 'More', false],
  ];
  const goTo = (screen: keyof RootStackParamList): void => {
    navigation.navigate(screen);
  };
  return (
    <View style={styles.navigation}>
      {items.map(([icon, label, screen, emphasis]) => (
        <NavigationItem
          key={label}
          icon={icon}
          label={label}
          active={route.name === screen}
          emphasis={emphasis}
          onPress={() => goTo(screen)}
          theme={theme}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: {
    position: 'relative',
    zIndex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 2,
    paddingBottom: 4,
    paddingTop: 4,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
});
