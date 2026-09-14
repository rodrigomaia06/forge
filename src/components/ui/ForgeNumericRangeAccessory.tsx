import { InputAccessoryView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { ForgeText as Text } from './ForgeText';
import { pressedFeedbackSubtle } from './pressFeedback';

interface ForgeNumericRangeAccessoryProps {
  nativeID: string;
  disabled?: boolean;
  onInsertSeparator: () => void;
}

/** Adds the missing range character to iOS's number pad without replacing it. */
export function ForgeNumericRangeAccessory({
  nativeID,
  disabled = false,
  onInsertSeparator,
}: ForgeNumericRangeAccessoryProps) {
  const styles = useThemedStyles(createStyles);

  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Insert interval separator"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onInsertSeparator}
          style={({ pressed }) => [
            styles.key,
            disabled && styles.keyDisabled,
            pressed && !disabled && pressedFeedbackSubtle,
          ]}
        >
          <Text style={[styles.keyText, disabled && styles.keyTextDisabled]}>−</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) =>
  StyleSheet.create({
    bar: {
      height: 44,
      paddingHorizontal: 8,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      backgroundColor: theme.surfaceElevated,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
    },
    key: {
      width: 52,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceMuted,
    },
    keyDisabled: { opacity: 0.42 },
    keyText: { color: theme.ink, ...typeScale.sectionTitle },
    keyTextDisabled: { color: theme.muted },
  });
