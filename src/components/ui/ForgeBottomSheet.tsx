import React, { useCallback, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { lightHaptic } from './haptics';

const noop = () => undefined;
/** Shared sheet-header geometry keeps titles and close actions aligned. */
export const forgeSheetHeader = {
  height: 56,
  horizontalPadding: 20,
  closeSize: 44,
} as const;
const webViewportFill = Platform.OS === 'web'
  ? ({ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0 } as unknown as ViewStyle)
  : undefined;

interface ForgeBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  accessibilityLabel: string;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  overlay?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  closeDistance?: number;
  initialOffset?: number;
  dismissThreshold?: number;
  onCloseStart?: () => void;
  onBackRequest?: () => boolean;
  keyboardAvoiding?: boolean;
  backdropTestID?: string;
  surfaceTestID?: string;
  dragArea?: (children: React.ReactNode) => React.ReactNode;
  testID?: string;
}

/** Shared modal mechanics for Forge's bottom-attached sheets. */
export function ForgeBottomSheet({
  visible,
  onClose,
  accessibilityLabel,
  children,
  overlay,
  style,
  closeDistance = 520,
  initialOffset = closeDistance,
  dismissThreshold = 190,
  onCloseStart,
  onBackRequest,
  keyboardAvoiding = false,
  backdropTestID,
  surfaceTestID,
  dragArea,
  testID,
}: ForgeBottomSheetProps) {
  const theme = useForgeTheme();
  const translateY = useSharedValue(closeDistance);
  const backdropOpacity = useSharedValue(0);
  const closing = useSharedValue(false);
  const dragStart = useSharedValue(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const finishClose = useCallback(() => onCloseRef.current(), []);
  const close = useCallback((withHaptic = false) => {
    if (closing.value) return;
    closing.value = true;
    onCloseStart?.();
    if (withHaptic) lightHaptic();
    translateY.value = withTiming(closeDistance, { duration: 200 }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
    backdropOpacity.value = withTiming(0, { duration: 160 });
  }, [backdropOpacity, closeDistance, closing, finishClose, onCloseStart, translateY]);

  useEffect(() => {
    if (!visible) return undefined;
    closing.value = false;
    translateY.value = initialOffset;
    backdropOpacity.value = 0;
    const frame = requestAnimationFrame(() => {
      translateY.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 });
      backdropOpacity.value = withTiming(1, { duration: 180 });
    });
    return () => cancelAnimationFrame(frame);
  }, [backdropOpacity, closing, initialOffset, translateY, visible]);

  const pan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .failOffsetX([-24, 24])
    .onStart(() => { dragStart.value = translateY.value; })
    .onUpdate((event) => { translateY.value = Math.max(0, dragStart.value + event.translationY); })
    .onEnd((event) => {
      if (closing.value) return;
      const projected = Math.max(0, dragStart.value + event.translationY + event.velocityY * 0.12);
      if (projected >= dismissThreshold || event.velocityY > 900) {
        closing.value = true;
        runOnJS(onCloseStart ?? noop)();
        translateY.value = withTiming(closeDistance, { duration: 200 }, (finished) => {
          if (finished) runOnJS(finishClose)();
        });
        backdropOpacity.value = withTiming(0, { duration: 160 });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 });
      }
    });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!visible) return null;
  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={() => {
        if (!onBackRequest?.()) close(true);
      }}
    >
      <Animated.View testID={testID} style={[styles.backdrop, webViewportFill, backdropStyle]}>
        <Pressable
          testID={backdropTestID}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={() => close(true)}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView pointerEvents="box-none" style={styles.keyboardArea} behavior={keyboardAvoiding && Platform.OS === 'ios' ? 'padding' : undefined}>
          <GestureDetector gesture={pan}>
            <Animated.View testID={surfaceTestID} style={[styles.sheet, { backgroundColor: theme.surfaceElevated, shadowColor: theme.shadow }, style, sheetStyle]}>{dragArea ? dragArea(typeof children === 'function' ? children(() => close(false)) : children) : (typeof children === 'function' ? children(() => close(false)) : children)}</Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
        {overlay}
      </Animated.View>
    </Modal>
  );
}

export function ForgeBottomSheetHandle() {
  const theme = useForgeTheme();
  return <View style={[styles.handle, { backgroundColor: theme.divider }]} />;
}

export function ForgeBottomSheetDragArea({ children }: { children: React.ReactNode }) {
  return <View>{children}</View>;
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(23,25,28,0.24)',
  },
  keyboardArea: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  handle: { width: 48, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
});
