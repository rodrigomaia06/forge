import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { ForgeTextInput } from './ForgeText';
import { Icon } from './Icon';

/** A non-selecting query field for Forge choice lists and catalogue search. */
export function ForgeSearchField({
  value,
  onChangeText,
  accessibilityLabel,
  placeholder = 'Search',
  autoFocus = false,
  style,
}: {
  value: string;
  onChangeText: (value: string) => void;
  accessibilityLabel: string;
  placeholder?: string;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.field, style]}>
      <Icon name="search" size={19} color={theme.slate} />
      <ForgeTextInput
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        style={styles.input}
      />
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useForgeTheme>) => StyleSheet.create({
  field: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    backgroundColor: theme.input,
  },
  input: { flex: 1, minWidth: 0, color: theme.textPrimary, ...typeScale.body },
});
