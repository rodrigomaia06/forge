import React, { useEffect, useRef } from 'react';
import { Platform, type ColorValue, type StyleProp, type TextInput as NativeTextInput, type TextStyle, type TextInputProps } from 'react-native';

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
  /** Increment to focus the input from a grouped row tap. */
  focusRequest?: number;
  testID?: string;
}

/** Native punctuation input for routine intervals; commas are normalized by its consumer. */
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
  focusRequest = 0,
  testID,
}: ForgeNumericRangeInputProps) {
  const fallbackRef = useRef<NativeTextInput>(null);

  useEffect(() => { if (focusRequest > 0) fallbackRef.current?.focus(); }, [focusRequest]);

  return (
    <ForgeTextInput
      ref={fallbackRef}
      accessibilityLabel={accessibilityLabel}
      editable={editable}
      // React Native Web otherwise renders `numbers-and-punctuation` as a
      // text input. Native retains that keypad so range punctuation remains
      // available, while web receives a decimal number keypad as well.
      inputMode={Platform.OS === 'web' ? 'decimal' : undefined}
      keyboardType="numbers-and-punctuation"
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
