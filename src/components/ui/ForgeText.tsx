import React from 'react';
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

import { maxFontSizeMultiplier } from '../../theme/tokens';
import { useForgeTheme } from '../../theme/ThemeProvider';

/** Shared text primitives preserve the user's preferred text size up to Forge's 1.5× cap. */
export function ForgeText({ maxFontSizeMultiplier: _max, ...props }: TextProps) {
  return <NativeText {...props} maxFontSizeMultiplier={maxFontSizeMultiplier} />;
}

export const ForgeTextInput = React.forwardRef<NativeTextInput, TextInputProps>(
  ({ maxFontSizeMultiplier: _max, keyboardAppearance, ...props }, ref) => {
    const theme = useForgeTheme();
    return (
      <NativeTextInput
        ref={ref}
        {...props}
        keyboardAppearance={keyboardAppearance ?? theme.colorScheme}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
      />
    );
  },
);

ForgeTextInput.displayName = 'ForgeTextInput';
