import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { colors, darkTheme } from '../../theme/tokens';

const GroupFeedback = createContext<((id: string, pressed: boolean) => void) | null>(null);

export function centeredPressFeedback(size: number, borderRadius: number): ViewStyle {
  return {
    width: size,
    height: size,
    borderRadius,
    top: '50%',
    left: '50%',
    right: undefined,
    bottom: undefined,
    transform: [{ translateX: -size / 2 }, { translateY: -size / 2 }],
  };
}

function PressStateLayer({ surface, style }: { surface: ViewStyle; style?: StyleProp<ViewStyle> }) {
  const theme = useForgeTheme();
  const background = surface.backgroundColor;
  const tint =
    typeof background === 'string' && /^#[\da-f]{6}$/i.test(background)
      ? parseInt(background.slice(1, 3), 16) * 0.299 +
          parseInt(background.slice(3, 5), 16) * 0.587 +
          parseInt(background.slice(5, 7), 16) * 0.114 >
        128
        ? colors.pressed
        : darkTheme.pressed
      : theme.pressed;
  return (
    <View
      testID="forge-press-state-layer"
      pointerEvents="none"
      accessible={false}
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: tint,
          borderRadius: surface.borderRadius,
          borderTopLeftRadius: surface.borderTopLeftRadius,
          borderTopRightRadius: surface.borderTopRightRadius,
          borderBottomLeftRadius: surface.borderBottomLeftRadius,
          borderBottomRightRadius: surface.borderBottomRightRadius,
        },
        style,
      ]}
    />
  );
}

/** Shares a visual surface while keeping sibling actions independently accessible. */
export function ForgePressableGroup({ style, children, ...props }: ViewProps) {
  const [pressedId, setPressedId] = useState<string | null>(null);
  const setPressed = useCallback((id: string, pressed: boolean) => {
    setPressedId((current) => (pressed ? id : current === id ? null : current));
  }, []);
  return (
    <GroupFeedback.Provider value={setPressed}>
      <View {...props} style={style}>
        {children}
        {pressedId !== null ? <PressStateLayer surface={StyleSheet.flatten(style) ?? {}} /> : null}
      </View>
    </GroupFeedback.Provider>
  );
}

type ForgePressableProps = PressableProps & {
  pressFeedback?: 'self' | 'group';
  /** Only inset visible controls use a smaller layer than their touch target. */
  pressFeedbackStyle?: StyleProp<ViewStyle>;
};

/** One tint layer covers the visible surface without fading its content. */
export const ForgePressable = forwardRef<View, ForgePressableProps>(function ForgePressable(
  { style, children, pressFeedback = 'self', pressFeedbackStyle, onPressIn, onPressOut, ...props },
  ref,
) {
  const group = useContext(GroupFeedback);
  const id = useId();
  const groupFeedback = pressFeedback === 'group' ? group : null;
  useEffect(() => () => groupFeedback?.(id, false), [groupFeedback, id]);
  useEffect(() => {
    if (props.disabled) groupFeedback?.(id, false);
  }, [props.disabled, groupFeedback, id]);
  const resolveStyle = (state: PressableStateCallbackType) =>
    typeof style === 'function' ? style(state) : style;
  const resting = () => StyleSheet.flatten(resolveStyle({ pressed: false })) ?? {};
  return (
    <Pressable
      {...props}
      ref={ref}
      onPressIn={(event) => {
        groupFeedback?.(id, true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        groupFeedback?.(id, false);
        onPressOut?.(event);
      }}
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
        return (
          <>
            {typeof children === 'function' ? children(state) : children}
            {state.pressed &&
            !groupFeedback &&
            !props.disabled &&
            props.accessible !== false &&
            !backdrop ? (
              <PressStateLayer surface={base} style={pressFeedbackStyle} />
            ) : null}
          </>
        );
      }}
    </Pressable>
  );
});
