import React, { useCallback, useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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

interface ForgeBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  accessibilityLabel: string;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  style?: StyleProp<ViewStyle>;
  closeDistance?: number;
  dismissThreshold?: number;
  testID?: string;
}

/** Shared modal mechanics for Forge's bottom-attached sheets. */
export function ForgeBottomSheet({
  visible,
  onClose,
  accessibilityLabel,
  children,
  style,
  closeDistance = 520,
  dismissThreshold = 190,
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
  const close = useCallback(() => {
    if (closing.value) return;
    closing.value = true;
    lightHaptic();
    translateY.value = withTiming(closeDistance, { duration: 200 }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
    backdropOpacity.value = withTiming(0, { duration: 160 });
  }, [backdropOpacity, closeDistance, closing, finishClose, translateY]);

  useEffect(() => {
    if (!visible) return undefined;
    closing.value = false;
    translateY.value = closeDistance;
    backdropOpacity.value = 0;
    const frame = requestAnimationFrame(() => {
      translateY.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 });
      backdropOpacity.value = withTiming(1, { duration: 180 });
    });
    return () => cancelAnimationFrame(frame);
  }, [backdropOpacity, closeDistance, closing, translateY, visible]);

  const pan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .failOffsetX([-24, 24])
    .onStart(() => { dragStart.value = translateY.value; })
    .onUpdate((event) => { translateY.value = Math.max(0, dragStart.value + event.translationY); })
    .onEnd((event) => {
      const projected = Math.max(0, dragStart.value + event.translationY + event.velocityY * 0.12);
      if (projected >= dismissThreshold || event.velocityY > 900) {
        closing.value = true;
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
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <Animated.View testID={testID} style={[styles.backdrop, backdropStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, { backgroundColor: theme.surfaceElevated, shadowColor: theme.shadow }, style, sheetStyle]}>{typeof children === 'function' ? children(close) : children}</Animated.View>
        </GestureDetector>
      </Animated.View>
    </Modal>
  );
}

export function ForgeBottomSheetHandle() {
  const theme = useForgeTheme();
  return <View style={[styles.handle, { backgroundColor: theme.divider }]} />;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,25,28,0.24)' },
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
