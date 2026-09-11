import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
  useWindowDimensions,
  type KeyboardEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const noop = () => undefined;
const SheetDragContext = createContext<ReturnType<typeof Gesture.Pan> | null>(null);
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
  dismissTextKeyboardOnTap?: boolean;
  backdropTestID?: string;
  surfaceTestID?: string;
  dragArea?: (children: React.ReactNode) => React.ReactNode;
  /** Disable for sheets whose primary content is a tall vertical scroller. */
  dragEnabled?: boolean;
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
  keyboardAvoiding = true,
  dismissTextKeyboardOnTap = true,
  backdropTestID,
  surfaceTestID,
  dragArea,
  dragEnabled = true,
  testID,
}: ForgeBottomSheetProps) {
  const theme = useForgeTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useSharedValue(closeDistance);
  const backdropOpacity = useSharedValue(0);
  const closing = useSharedValue(false);
  const dragStart = useSharedValue(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [naturalSheetHeight, setNaturalSheetHeight] = useState(0);
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

  useEffect(() => {
    if (!visible || !keyboardAvoiding) {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      return undefined;
    }
    const transition = (nextVisible: boolean, event: KeyboardEvent) => {
      if (Platform.OS === 'ios') Keyboard.scheduleLayoutAnimation(event);
      else {
        UIManager.setLayoutAnimationEnabledExperimental?.(true);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      setKeyboardVisible(nextVisible);
      setKeyboardHeight(nextVisible ? event.endCoordinates.height : 0);
    };
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => transition(true, event),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (event) => transition(false, event),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [keyboardAvoiding, visible]);

  const pan = Gesture.Pan()
    .enabled(dragEnabled)
    .hitSlop({ top: 12, bottom: 12, left: 0, right: 0 })
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
  const keyboardBreathingRoom = 16;
  const compactSheetFitsAboveKeyboard =
    keyboardVisible &&
    naturalSheetHeight > 0 &&
    naturalSheetHeight + keyboardBreathingRoom <= windowHeight - keyboardHeight - insets.top;
  const keyboardSurfaceFillHeight = keyboardHeight + insets.bottom + (
    compactSheetFitsAboveKeyboard ? keyboardBreathingRoom : 0
  );

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
        {keyboardVisible ? (
          <Pressable
            accessible={false}
            onPress={Keyboard.dismiss}
            style={[
              styles.keyboardSurfaceFill,
              { height: keyboardSurfaceFillHeight, backgroundColor: theme.surfaceElevated },
            ]}
          />
        ) : null}
        <View style={[styles.keyboardArea, styles.pointerEventsBoxNone]}>
          <SheetDragContext.Provider value={dragEnabled ? pan : null}>
            <Animated.View
              testID={surfaceTestID}
              onLayout={(event) => {
                if (!keyboardVisible) setNaturalSheetHeight(event.nativeEvent.layout.height);
              }}
              onStartShouldSetResponderCapture={() => keyboardVisible && dismissTextKeyboardOnTap}
              onResponderRelease={() => Keyboard.dismiss()}
              style={[
                styles.sheet,
                { backgroundColor: theme.surfaceElevated, shadowColor: theme.shadow },
                style,
                keyboardVisible && (compactSheetFitsAboveKeyboard
                  ? styles.keyboardRaisedSheet
                  : styles.keyboardExpandedSheet),
                keyboardVisible && compactSheetFitsAboveKeyboard && {
                  bottom: keyboardHeight + keyboardBreathingRoom,
                },
                keyboardVisible && !compactSheetFitsAboveKeyboard && {
                  top: insets.top,
                  bottom: keyboardHeight,
                },
                sheetStyle,
              ]}
            >
              {dragArea
                ? dragArea(typeof children === 'function' ? children(() => close(false)) : children)
                : (typeof children === 'function' ? children(() => close(false)) : children)}
            </Animated.View>
          </SheetDragContext.Provider>
        </View>
        {overlay}
      </Animated.View>
    </Modal>
  );
}

export function ForgeBottomSheetHandle() {
  const theme = useForgeTheme();
  const pan = useContext(SheetDragContext);
  const handle = (
    <View testID="forge-sheet-drag-tab" collapsable={false} style={styles.handleTouchArea}>
      <View style={[styles.handle, { backgroundColor: theme.divider }]} />
    </View>
  );
  return pan ? <GestureDetector gesture={pan}>{handle}</GestureDetector> : handle;
}

export function ForgeBottomSheetDragArea({ children }: { children: React.ReactNode }) {
  return <View>{children}</View>;
}

const styles = StyleSheet.create({
  pointerEventsBoxNone: { pointerEvents: 'box-none' },
  backdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(23,25,28,0.24)',
  },
  keyboardArea: { flex: 1, justifyContent: 'flex-end' },
  keyboardSurfaceFill: { position: 'absolute', right: 0, bottom: 0, left: 0 },
  sheet: {
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  keyboardExpandedSheet: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  keyboardRaisedSheet: {
    position: 'absolute',
    right: 0,
    left: 0,
  },
  // Enlarges the drag tab's target without changing the visible handle or header geometry.
  handleTouchArea: {
    width: 120,
    height: 29,
    alignSelf: 'center',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 0,
    marginBottom: -10,
  },
  handle: { width: 48, height: 5, borderRadius: 3 },
});
