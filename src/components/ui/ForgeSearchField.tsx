import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

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
  testID,
}: {
  value: string;
  onChangeText: (value: string) => void;
  accessibilityLabel: string;
  placeholder?: string;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.field, style]}>
      <Icon name="search" size={19} color={theme.slate} />
      <ForgeTextInput
        testID={testID}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        style={styles.input}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={14}
        >
          <Icon name="close" size={18} color={theme.slate} />
        </Pressable>
      ) : null}
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
    // Dark is the reference (unchanged): the `input` tone. Light uses an elevated
    // fill so the field reads on the page/base surface (its `input` sat on the page).
    backgroundColor: theme.colorScheme === 'light' ? theme.surfaceElevated : theme.input,
  },
  input: { flex: 1, minWidth: 0, color: theme.textPrimary, ...typeScale.body },
});
