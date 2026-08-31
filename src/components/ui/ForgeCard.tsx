import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useForgeTheme } from '../../theme/ThemeProvider';

export function ForgeCard({
  children,
  style,
  variant = 'outlined',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'outlined' | 'elevated';
}) {
  const theme = useForgeTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surfaceElevated,
          borderColor: theme.border,
          shadowColor: theme.shadow,
          shadowOpacity: theme.cardShadowOpacity ?? 0.06,
          borderWidth: variant === 'outlined' ? 1 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});
