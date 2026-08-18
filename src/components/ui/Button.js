import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii } from '../../theme/tokens';

export function Button({ label, accessibilityLabel, onPress, variant = 'primary', icon, loading = false, disabled = false, style }) {
  const isPrimary = variant === 'primary';
  const textColor = isPrimary ? colors.surface : colors.inkInteractive;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : icon && <Ionicons name={icon} size={20} color={textColor} />}
      {!loading && <Text style={[styles.label, { color: textColor }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, borderRadius: radii.control },
  primary: { minWidth: 92, backgroundColor: colors.inkInteractive },
  secondary: { borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  label: { fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
});
