import React from 'react';
import {
  StyleSheet,
  Platform,
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

export const ForgeTextInput = React.forwardRef<NativeTextInput, TextInputProps & { lockCursorToEnd?: boolean }>(
  ({ maxFontSizeMultiplier: _max, keyboardAppearance, style, lockCursorToEnd = false, ...props }, ref) => {
    const theme = useForgeTheme();
    const inputRef = React.useRef<NativeTextInput>(null);
    React.useImperativeHandle(ref, () => inputRef.current!);
    const end = props.value?.length ?? 0;
    const endSelection = React.useMemo(() => ({ start: end, end }), [end]);
    return (
      <NativeTextInput
        ref={inputRef}
        {...props}
        selection={lockCursorToEnd ? endSelection : props.selection}
        onSelectionChange={(event) => {
          // Keep the insertion caret at the end. A deliberate text selection
          // still permits replacing/clearing the value from a hardware keyboard.
          if (lockCursorToEnd && event.nativeEvent.selection.start === event.nativeEvent.selection.end && event.nativeEvent.selection.end !== end) {
            if (Platform.OS === 'web') {
              (inputRef.current as unknown as HTMLInputElement | null)?.setSelectionRange(end, end);
            } else {
              inputRef.current?.setNativeProps({ selection: { start: end, end } });
            }
          }
          props.onSelectionChange?.(event);
        }}
        style={[androidText.base, style]}
        keyboardAppearance={keyboardAppearance ?? theme.colorScheme}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
      />
    );
  },
);

ForgeTextInput.displayName = 'ForgeTextInput';
