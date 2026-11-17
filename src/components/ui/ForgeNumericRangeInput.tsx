import React, { useEffect, useRef } from 'react';
import { Platform, type ColorValue, type KeyboardTypeOptions, type StyleProp, type TextInput as NativeTextInput, type TextStyle, type TextInputProps } from 'react-native';

import { ForgeTextInput } from './ForgeText';

/**
 * The system keyboard for a field that accepts a `min-max` range (and a
 * decimal): iOS numbers-and-punctuation has `-`, `.` and `:`; Android's
 * signed decimal number keyboard has `-` and `.` (React Native does not
 * filter where they are typed). Single decimal values use `decimal-pad`.
 */
export const rangeKeyboardType: KeyboardTypeOptions =
  Platform.OS === 'android' ? 'numeric' : 'numbers-and-punctuation';

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
  /** Defaults to `rangeKeyboardType`; single decimal values pass `decimal-pad`. */
  keyboardType?: KeyboardTypeOptions;
  /** Increment to focus the input from a grouped row tap. */
  focusRequest?: number;
  testID?: string;
}

/** Numeric range entry on the platform's own keyboard; parsing stays with the consumer. */
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
  keyboardType = rangeKeyboardType,
  focusRequest = 0,
  testID,
}: ForgeNumericRangeInputProps) {
  const inputRef = useRef<NativeTextInput>(null);
  useEffect(() => { if (focusRequest > 0) inputRef.current?.focus(); }, [focusRequest]);
  // `numbers-and-punctuation` is iOS-only; Android shows its text keyboard for it.
  const resolvedKeyboard = Platform.OS === 'android' && keyboardType === 'numbers-and-punctuation'
    ? 'numeric'
    : keyboardType;

  return (
    <ForgeTextInput
      ref={inputRef}
      lockCursorToEnd
      accessibilityLabel={accessibilityLabel}
      editable={editable}
      // Web needs inputMode because its numbers-and-punctuation mapping is text.
      inputMode={Platform.OS === 'web' ? resolvedKeyboard === 'number-pad' ? 'numeric' : 'decimal' : undefined}
      keyboardType={resolvedKeyboard}
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
