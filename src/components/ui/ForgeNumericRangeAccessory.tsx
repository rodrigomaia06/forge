import { InputAccessoryView, Platform, PlatformColor, Pressable, StyleSheet, View } from 'react-native';

import { useThemedStyles } from '../../theme/useThemedStyles';
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
            styles.keyHitTarget,
            pressed && !disabled && styles.keyPressed,
          ]}
        >
          <View style={[styles.key, disabled && styles.keyDisabled]}>
            <Text style={[styles.keyText, disabled && styles.keyTextDisabled]}>−</Text>
          </View>
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
      // This is keyboard chrome, not an in-app Forge toolbar. System colors
      // deliberately keep it continuous with the active iOS keyboard.
      backgroundColor: Platform.OS === 'ios' ? PlatformColor('tertiarySystemBackground') : theme.surfaceElevated,
    },
    keyHitTarget: { width: 52, height: 44, alignItems: 'center', justifyContent: 'center' },
    key: {
      width: 52,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: Platform.OS === 'ios' ? PlatformColor('systemGray') : theme.surfaceMuted,
    },
    keyPressed: pressedFeedbackSubtle,
    keyDisabled: { opacity: 0.38 },
    // Native system font is intentional here: this control is physically
    // attached to Apple's keyboard rather than part of Forge screen chrome.
    keyText: {
      color: Platform.OS === 'ios' ? PlatformColor('label') : theme.ink,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '400',
    },
    keyTextDisabled: { color: Platform.OS === 'ios' ? PlatformColor('secondaryLabel') : theme.muted },
  });
