import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, processColor, type ColorValue, type KeyboardTypeOptions, type StyleProp, type TextInput as NativeTextInput, type TextStyle, type TextInputProps } from 'react-native';
import { NativeRangeInput } from '../../../modules/forge-range-keyboard';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';

import { ForgeTextInput } from './ForgeText';

export interface ForgeNumericRangeInputProps {
  value: string;
  onChangeText: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onTouchStart?: TextInputProps['onTouchStart'];
  onTouchMove?: TextInputProps['onTouchMove'];
  onTouchEnd?: TextInputProps['onTouchEnd'];
  accessibilityLabel: string;
  editable?: boolean;
  placeholder?: string;
  textColor?: ColorValue;
  placeholderTextColor?: ColorValue;
  style?: StyleProp<TextStyle>;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  /**
   * `numbers-and-punctuation` selects the native range keypad when available.
   * Single decimal fields retain `decimal-pad` and the system keyboard.
   */
  keyboardType?: KeyboardTypeOptions;
  /** Increment to focus the input from a grouped row tap. */
  focusRequest?: number;
  testID?: string;
}

/** Native range entry with a platform TextInput fallback; parsing stays with the consumer. */
export function ForgeNumericRangeInput({
  value,
  onChangeText,
  onFocus,
  onBlur,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  accessibilityLabel,
  editable = true,
  placeholder,
  textColor,
  placeholderTextColor,
  style,
  fontSize = 16,
  textAlign = 'center',
  keyboardType = 'numbers-and-punctuation',
  focusRequest = 0,
  testID,
}: ForgeNumericRangeInputProps) {
  const fallbackRef = useRef<NativeTextInput>(null);
  const theme = useForgeTheme();
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => { if (focusRequest > 0) fallbackRef.current?.focus(); }, [focusRequest]);

  if (NativeRangeInput && keyboardType === 'numbers-and-punctuation') {
    const flattened = StyleSheet.flatten(style);
    const foreground = processColor(textColor ?? theme.textPrimary);
    const placeholderColor = processColor(placeholderTextColor ?? theme.textSecondary);
    return <NativeRangeInput
      value={value}
      mostRecentEventCount={eventCount}
      editable={editable}
      placeholder={placeholder ?? ''}
      accessibilityLabel={accessibilityLabel}
      textColor={typeof foreground === 'number' ? foreground : undefined}
      placeholderTextColor={typeof placeholderColor === 'number' ? placeholderColor : undefined}
      fontSize={fontSize}
      fontFamily={flattened?.fontFamily ?? typeScale.body.fontFamily ?? ''}
      textAlign={textAlign}
      appearance={theme.colorScheme}
      focusRequest={focusRequest}
      testID={testID}
      onChange={({ nativeEvent }) => {
        setEventCount(nativeEvent.eventCount);
        onChangeText(nativeEvent.value);
      }}
      onFocus={() => onFocus?.()}
      onBlur={() => onBlur?.()}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={[{ minHeight: typeScale.body.lineHeight }, style]}
    />;
  }

  return (
    <ForgeTextInput
      ref={fallbackRef}
      lockCursorToEnd
      accessibilityLabel={accessibilityLabel}
      editable={editable}
      // Web needs inputMode because its numbers-and-punctuation mapping is text.
      inputMode={Platform.OS === 'web' ? keyboardType === 'number-pad' ? 'numeric' : 'decimal' : undefined}
      keyboardType={keyboardType}
      onBlur={onBlur}
      onChangeText={onChangeText}
      onFocus={onFocus}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onTouchStart={onTouchStart}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      selectTextOnFocus={false}
      style={[style, { color: textColor, fontSize, textAlign }]}
      testID={testID}
      value={value}
    />
  );
}
