import React, { forwardRef } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type PressableStateCallbackType,
} from 'react-native';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { colors, darkTheme } from '../../theme/tokens';

/** One tint layer covers the entire control, including controls with filled children. */
export const ForgePressable = forwardRef<View, PressableProps>(function ForgePressable(
  { style, children, ...props },
  ref,
) {
  const theme = useForgeTheme();
  const resolveStyle = (state: PressableStateCallbackType) =>
    typeof style === 'function' ? style(state) : style;
  const resting = () => StyleSheet.flatten(resolveStyle({ pressed: false })) ?? {};
  return (
    <Pressable
      {...props}
      ref={ref}
      style={(state) => {
        const base = resting();
        return [
          resolveStyle(state),
          state.pressed && { opacity: base.opacity ?? 1, backgroundColor: base.backgroundColor },
        ];
      }}
    >
      {(state) => {
        const base = resting();
        const backdrop =
          base.position === 'absolute' &&
          base.top === 0 &&
          base.bottom === 0 &&
          base.left === 0 &&
          base.right === 0 &&
          !base.borderRadius;
        const tint =
          typeof base.backgroundColor === 'string' && /^#[\da-f]{6}$/i.test(base.backgroundColor)
            ? parseInt(base.backgroundColor.slice(1, 3), 16) * 0.299 +
                parseInt(base.backgroundColor.slice(3, 5), 16) * 0.587 +
                parseInt(base.backgroundColor.slice(5, 7), 16) * 0.114 >
              128
              ? colors.pressed
              : darkTheme.pressed
            : theme.pressed;
        return (
          <>
            {typeof children === 'function' ? children(state) : children}
            {state.pressed && !props.disabled && props.accessible !== false && !backdrop ? (
              <View
                testID="forge-press-state-layer"
                pointerEvents="none"
                accessible={false}
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: tint,
                    borderRadius: base.borderRadius,
                    borderTopLeftRadius: base.borderTopLeftRadius,
                    borderTopRightRadius: base.borderTopRightRadius,
                    borderBottomLeftRadius: base.borderBottomLeftRadius,
                    borderBottomRightRadius: base.borderBottomRightRadius,
                  },
                ]}
              />
            ) : null}
          </>
        );
      }}
    </Pressable>
  );
});
