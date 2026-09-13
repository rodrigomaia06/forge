import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createBottomTabNavigator, TransitionPresets } from '@react-navigation/bottom-tabs';

import { DashboardScreen } from '../screens/DashboardScreen';
import { ActiveWorkoutScreen } from '../screens/ActiveWorkoutScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { PlansScreen } from '../screens/PlansScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useWorkouts } from '../state/WorkoutContext';
import { useForgeTheme } from '../theme/ThemeProvider';
import { ForgeTabBar } from './ForgeTabBar';
import { PrimaryDockProvider } from './PrimaryDockContext';
import type { RootTabParamList } from '../types';

const Tab = createBottomTabNavigator<RootTabParamList>();

export function MainTabNavigator() {
  const { activeWorkout } = useWorkouts();
  const theme = useForgeTheme();
  const [compact, setCompact] = useState(false);
  const setDockCompact = useCallback((nextCompact: boolean) => setCompact(nextCompact), []);
  const dockContext = useMemo(
    () => ({ compact, setCompact: setDockCompact }),
    [compact, setDockCompact],
  );

  useEffect(() => {
    if (!activeWorkout) setCompact(false);
  }, [activeWorkout]);

  return (
    <PrimaryDockProvider value={dockContext}>
      <Tab.Navigator
        initialRouteName={activeWorkout ? 'ActiveWorkout' : 'Dashboard'}
        screenOptions={{
          headerShown: false,
          lazy: false,
          freezeOnBlur: true,
          // The tab scenes remain visible under the fade. Keep that shared
          // surface theme-aware so Dark mode never flashes React Navigation's
          // default white scene between tabs.
          sceneStyle: { backgroundColor: theme.background },
          // Forge owns a floating dock. Keep the navigator's tab-bar layout
          // out of the scene so every tab can use the full viewport behind it.
          tabBarStyle: {
            position: 'absolute',
            height: 0,
            borderTopWidth: 0,
            backgroundColor: 'transparent',
            elevation: 0,
          },
          ...TransitionPresets.FadeTransition,
        }}
        tabBar={(props) => <ForgeTabBar {...props} />}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="History" component={HistoryScreen} />
        <Tab.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} />
        <Tab.Screen name="Plans" component={PlansScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </PrimaryDockProvider>
  );
}
