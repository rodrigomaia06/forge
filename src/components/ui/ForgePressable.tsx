import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Platform,
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
import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const useNativeDriver = Platform.OS !== 'web';

/** Shrink a rounded surface by a fixed few points, never below the shared minimum scale. */
function pressScaleFor(width: number): number {
  if (!(width > 0)) return forgeMotion.pressScaleMin;
  return Math.max(forgeMotion.pressScaleMin, 1 - forgeMotion.pressInset / width);
}

const GroupFeedback = createContext<((id: string, pressed: boolean) => void) | null>(null);

export function centeredPressFeedback(size: number, borderRadius: number, height = size): ViewStyle {
  return {
    width: size,
    height,
    borderRadius,
    top: '50%',
    left: '50%',
    right: undefined,
    bottom: undefined,
    transform: [{ translateX: -size / 2 }, { translateY: -height / 2 }],
  };
}

const circularIconPressFeedback = centeredPressFeedback(40, 20);

function defaultPressFeedback(surface: ViewStyle): ViewStyle | undefined {
  const width = surface.width ?? surface.minWidth;
  const height = surface.height ?? surface.minHeight;
  return width === 44 && height === 44 && typeof surface.borderRadius === 'number' && surface.borderRadius >= 22
    ? circularIconPressFeedback
    : undefined;
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

/**
 * One tint layer covers the visible surface without fading its content. Rounded
 * painted surfaces also settle slightly inward while pressed (skipped under
 * Reduce Motion, for disabled controls, grouped segments and full-screen backdrops).
 */
export const ForgePressable = forwardRef<View, ForgePressableProps>(function ForgePressable(
  { style, children, pressFeedback = 'self', pressFeedbackStyle, onPressIn, onPressOut, onLayout, ...props },
  ref,
) {
  const group = useContext(GroupFeedback);
  const id = useId();
  const groupFeedback = pressFeedback === 'group' ? group : null;
  const reducedMotion = useForgeReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const width = useRef(0);
  const [pressed, setPressed] = useState(false);
  useEffect(() => () => groupFeedback?.(id, false), [groupFeedback, id]);
  useEffect(() => {
    if (props.disabled) groupFeedback?.(id, false);
  }, [props.disabled, groupFeedback, id]);
  const resolveStyle = (state: PressableStateCallbackType) =>
    typeof style === 'function' ? style(state) : style;
  const base = StyleSheet.flatten(resolveStyle({ pressed: false })) ?? {};
  const backdrop =
    base.position === 'absolute' &&
    base.top === 0 &&
    base.bottom === 0 &&
    base.left === 0 &&
    base.right === 0 &&
    !base.borderRadius;
  const scalable =
    !reducedMotion &&
    !groupFeedback &&
    !props.disabled &&
    props.accessible !== false &&
    !backdrop &&
    typeof base.borderRadius === 'number' &&
    base.borderRadius > 0;
  const animateTo = (toValue: number) => {
    Animated.timing(scale, {
      toValue,
      duration: forgeMotion.state,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
  };
  useEffect(() => {
    if (!scalable) scale.setValue(1);
  }, [scalable, scale]);
  const resolved = StyleSheet.flatten(resolveStyle({ pressed })) ?? {};
  const restingTransform = Array.isArray(resolved.transform) ? resolved.transform : [];
  return (
    <AnimatedPressable
      {...props}
      ref={ref}
      onLayout={(event) => {
        width.current = event.nativeEvent.layout.width;
        onLayout?.(event);
      }}
      onPressIn={(event) => {
        groupFeedback?.(id, true);
        setPressed(true);
        if (scalable) animateTo(pressScaleFor(width.current));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        groupFeedback?.(id, false);
        setPressed(false);
        if (scalable) animateTo(1);
        onPressOut?.(event);
      }}
      style={[
        resolved,
        pressed && { opacity: base.opacity ?? 1, backgroundColor: base.backgroundColor },
        scalable && { transform: [...restingTransform, { scale }] },
      ]}
    >
      {(state: PressableStateCallbackType) => (
        <>
          {typeof children === 'function' ? children(state) : children}
          {state.pressed &&
          !groupFeedback &&
          !props.disabled &&
          props.accessible !== false &&
          !backdrop ? (
            <PressStateLayer surface={base} style={pressFeedbackStyle ?? defaultPressFeedback(base)} />
          ) : null}
        </>
      )}
    </AnimatedPressable>
  );
});
