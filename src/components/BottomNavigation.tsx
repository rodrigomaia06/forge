import React, { useEffect, useRef } from 'react';
import { LayoutAnimation, Platform, UIManager, View, StyleSheet } from 'react-native';
import { StackActions, useNavigation, useRoute } from '@react-navigation/native';

import { NavigationItem, selectionHaptic } from './ui';
import { getWorkoutTypePresentation } from '../domain/workouts/presentation';
import { colors } from '../theme/tokens';
import { useSettings } from '../state/SettingsContext';
import { useWorkouts } from '../state/WorkoutContext';
import type { ForgeTheme, IconName, RootNavigationProp, RootStackParamList } from '../types';
import type { RouteProp } from '@react-navigation/native';

interface BottomNavigationProps {
  theme?: ForgeTheme;
  compact?: boolean;
  onNavigate?: () => void;
}
type BottomNavigationScreen = 'Dashboard' | 'History' | 'ActiveWorkout' | 'Plans' | 'Settings';
type NavigationItemEntry = [IconName, string, BottomNavigationScreen, boolean];

let knownWorkoutId: string | null | undefined;

export function BottomNavigation({
  theme = colors,
  compact = false,
  onNavigate,
}: BottomNavigationProps) {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList>>();
  const activeWorkout = useWorkouts().activeWorkout;
  const { preferences } = useSettings();
  const hasActiveWorkout = Boolean(activeWorkout);
  const activeWorkoutIcon = activeWorkout
    ? getWorkoutTypePresentation(activeWorkout.type, preferences.workoutTypes, theme, 1).icon
    : 'fitness-outline';
  const workoutStartedNow =
    activeWorkout?.id !== undefined &&
    activeWorkout.id !== knownWorkoutId &&
    knownWorkoutId !== undefined;
  knownWorkoutId = activeWorkout?.id ?? null;
  const workoutPresence = useRef(hasActiveWorkout);
  useEffect(() => {
    if (workoutPresence.current === hasActiveWorkout) return;
    if (Platform.OS !== 'web') {
      if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    workoutPresence.current = hasActiveWorkout;
  }, [hasActiveWorkout]);
  const items: NavigationItemEntry[] = [
    ['home-outline', 'Dashboard', 'Dashboard', false],
    ['time-outline', 'History', 'History', false],
    ...(activeWorkout ? [[activeWorkoutIcon, 'Workout', 'ActiveWorkout', true] as NavigationItemEntry] : []),
    ['book', 'Plans', 'Plans', false],
    ['menu', 'Settings', 'Settings', false],
  ];
  const goTo = (screen: BottomNavigationScreen): void => {
    if (route.name === screen) return;
    selectionHaptic();
    onNavigate?.();
    if (screen === 'History' && historyIsActive) {
      navigation.dispatch(StackActions.popTo('History'));
      return;
    }
    navigation.navigate(screen);
  };
  const historyIsActive =
    route.name === 'History' ||
    route.name === 'WorkoutDetails' ||
    route.name === 'HistoryWorkoutEditor';
  return (
    <View style={[styles.navigation, compact && styles.navigationCompact]}>
      {items.map(([icon, label, screen, emphasis]) => (
        <NavigationItem
          key={label}
          icon={icon}
          label={label}
          active={screen === 'History' ? historyIsActive : route.name === screen}
          emphasis={emphasis}
          onPress={() => goTo(screen)}
          theme={theme}
          iconSize={compact ? (emphasis ? 28 : 20) : emphasis ? 40 : hasActiveWorkout ? 26 : 28}
          enterFromBottom={emphasis && workoutStartedNow}
          compact={compact}
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
  navigationCompact: {
    minHeight: 48,
    paddingVertical: 0,
  },
});
