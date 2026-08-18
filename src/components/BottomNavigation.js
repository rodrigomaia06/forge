import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { NavigationItem } from './ui';
import { colors } from '../theme/tokens';
import { useWorkouts } from '../state/WorkoutContext';

export function BottomNavigation({ theme = colors }) {
  const navigation = useNavigation();
  const route = useRoute();
  const activeWorkout = useWorkouts().activeWorkout;
  const items = [
    ['home-outline', 'Dashboard', 'Dashboard', false],
    ['time-outline', 'History', 'History', false],
    ...(activeWorkout ? [['play', 'Workout', 'ActiveWorkout', true]] : []),
    ['book', 'Plans', 'Plans', false],
    ['menu', 'More', 'More', false],
  ];
  const goTo = (screen) => {
    navigation.navigate(screen);
  };
  return (
    <View style={styles.navigation}>
      {items.map(([icon, label, screen, emphasis]) => (
        <NavigationItem key={label} icon={icon} label={label} active={route.name === screen} emphasis={emphasis} onPress={() => goTo(screen)} theme={theme} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: { position: 'relative', zIndex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 64, paddingHorizontal: 2, paddingBottom: 4, paddingTop: 4, backgroundColor: 'transparent', borderTopWidth: 0 },
});
