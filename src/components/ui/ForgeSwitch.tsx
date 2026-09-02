import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';

interface ForgeSwitchProps {
  value: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Presentational switch; the containing row owns interaction and accessibility. */
export function ForgeSwitch({ value, disabled = false, testID, style }: ForgeSwitchProps) {
  const theme = useForgeTheme();
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[
        styles.track,
        { backgroundColor: value ? theme.selectionIndicator : theme.surfaceMuted },
        disabled && styles.disabled,
        style,
      ]}
    >
      <View
        style={[
          styles.thumb,
          { backgroundColor: theme.surface },
          value && styles.thumbOn,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: 48, height: 28, borderRadius: 14, padding: 2, justifyContent: 'center' },
  thumb: { width: 24, height: 24, borderRadius: 12 },
  thumbOn: { alignSelf: 'flex-end' },
  disabled: { opacity: 0.55 },
});
