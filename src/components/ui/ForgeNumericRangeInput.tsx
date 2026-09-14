import React, { useEffect, useRef } from 'react';
import {
  Platform,
  type ColorValue,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInput as NativeTextInput,
  type TextStyle,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import { requireNativeViewManager, requireOptionalNativeModule } from 'expo-modules-core';

import { ForgeTextInput } from './ForgeText';

type NativeRangeChangeEvent = NativeSyntheticEvent<{ value: string }>;

interface NativeForgeRangeTextInputProps extends ViewProps {
  value: string;
  editable?: boolean;
  placeholder?: string;
  textColor?: string;
  placeholderTextColor?: string;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  focusRequest?: number;
  onChange?: (event: NativeRangeChangeEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
}

const hasNativeRangeInput =
  Platform.OS === 'ios' && requireOptionalNativeModule('ForgeRangeTextInput') !== null;

const NativeForgeRangeTextInput = hasNativeRangeInput
  ? requireNativeViewManager<NativeForgeRangeTextInputProps>('ForgeRangeTextInput')
  : null;

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

/**
 * Keeps routine interval entry native on iOS. Expo Go and non-iOS targets use
 * the platform text field, so no optional native module can make the app fail.
 */
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

  useEffect(() => {
    if (NativeForgeRangeTextInput || focusRequest < 1) return;
    fallbackRef.current?.focus();
  }, [focusRequest]);

  if (NativeForgeRangeTextInput) {
    return (
      <NativeForgeRangeTextInput
        accessibilityLabel={accessibilityLabel}
        editable={editable}
        focusRequest={focusRequest}
        fontSize={fontSize}
        onBlur={onBlur}
        onChange={(event) => onChangeText(event.nativeEvent.value)}
        onFocus={onFocus}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
        onTouchStart={onTouchStart}
        placeholder={placeholder}
        placeholderTextColor={colorToString(placeholderTextColor)}
        style={style}
        testID={testID}
        textAlign={textAlign}
        textColor={colorToString(textColor)}
        value={value}
      />
    );
  }

  return (
    <ForgeTextInput
      ref={fallbackRef}
      accessibilityLabel={accessibilityLabel}
      editable={editable}
      keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
      onBlur={onBlur}
      onChangeText={onChangeText}
      onFocus={onFocus}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onTouchStart={onTouchStart}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      selection={{ start: value.length, end: value.length }}
      selectTextOnFocus={false}
      style={style}
      testID={testID}
      value={value}
    />
  );
}

function colorToString(color: ColorValue | undefined): string | undefined {
  return typeof color === 'string' ? color : undefined;
}
