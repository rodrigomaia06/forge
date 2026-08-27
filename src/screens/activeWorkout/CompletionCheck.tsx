import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { Icon } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';

export function CompletionCheck({
  selected,
  testID,
}: {
  selected: boolean;
  testID?: string;
}) {
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [progress, selected]);

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.visual,
        selected && styles.active,
        {
          transform: [
            {
              scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }),
            },
          ],
        },
      ]}
    >
      <Animated.View
        style={{
          opacity: progress,
          transform: [
            {
              scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
            },
          ],
        }}
      >
        <Icon name="check" size={15} color={dashboardTheme.surface} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  visual: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: dashboardTheme.slate,
    borderRadius: 13,
  },
  active: { backgroundColor: dashboardTheme.iconSport, borderColor: dashboardTheme.iconSport },
});
