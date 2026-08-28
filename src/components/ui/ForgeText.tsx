import React from 'react';
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

import { maxFontSizeMultiplier } from '../../theme/tokens';

/** Shared text primitives preserve the user's preferred text size up to Forge's 1.5× cap. */
export function ForgeText({ maxFontSizeMultiplier: _max, ...props }: TextProps) {
  return <NativeText {...props} maxFontSizeMultiplier={maxFontSizeMultiplier} />;
}

export const ForgeTextInput = React.forwardRef<NativeTextInput, TextInputProps>(
  ({ maxFontSizeMultiplier: _max, ...props }, ref) => (
    <NativeTextInput ref={ref} {...props} maxFontSizeMultiplier={maxFontSizeMultiplier} />
  ),
);

ForgeTextInput.displayName = 'ForgeTextInput';
