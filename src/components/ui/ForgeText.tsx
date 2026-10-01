import React from 'react';
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

import { maxFontSizeMultiplier } from '../../theme/tokens';
import { useForgeTheme } from '../../theme/ThemeProvider';

// Android adds extra vertical padding around glyphs (`includeFontPadding`) that
// iOS does not, which makes text sit taller and off-centre in fixed-height rows
// and inputs. Disabling it is a no-op on iOS and makes Android match the iOS
// metrics the layouts are tuned for.
const androidText = StyleSheet.create({ base: { includeFontPadding: false } });

/** Shared text primitives preserve the user's preferred text size up to Forge's 1.5× cap. */
export function ForgeText({ maxFontSizeMultiplier: _max, style, ...props }: TextProps) {
  return <NativeText {...props} style={[androidText.base, style]} maxFontSizeMultiplier={maxFontSizeMultiplier} />;
}

export const ForgeTextInput = React.forwardRef<NativeTextInput, TextInputProps>(
  ({ maxFontSizeMultiplier: _max, keyboardAppearance, style, ...props }, ref) => {
    const theme = useForgeTheme();
    return (
      <NativeTextInput
        ref={ref}
        {...props}
        style={[androidText.base, style]}
        keyboardAppearance={keyboardAppearance ?? theme.colorScheme}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
      />
    );
  },
);

ForgeTextInput.displayName = 'ForgeTextInput';
