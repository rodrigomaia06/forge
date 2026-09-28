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
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';
import { lightHaptic } from './haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SheetDragContext = createContext<ReturnType<typeof Gesture.Pan> | null>(null);
const SheetDragAreaContext = createContext(false);
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
  /** Reserve a stronger backdrop for a blocking, high-attention choice. */
  backdropIntensity?: 'default' | 'strong';
  /** Disable for sheets whose primary content is a tall vertical scroller. */
  dragEnabled?: boolean;
  /**
   * Compose and measure mandatory content before beginning the entrance.
   * This prevents a tall first-use sheet from moving while its primary card
   * is still being laid out.
   */
  waitForContentLayoutBeforeEnter?: boolean;
  /**
   * Ease the surface height when its body changes size (e.g. an action sheet
   * swapping to a taller replacement view). Off by default so ordinary sheets
   * keep their instant sizing.
   */
  animateContentLayout?: boolean;
  /**
   * Present the next entrance with no slide/fade — the sheet is simply already
   * there. Used when a sheet is restored after it was temporarily dismissed to
   * push a screen (previous sessions -> workout detail -> back): returning must
   * not replay the pop-up animation, it should reappear in place.
   */
  enterInstant?: boolean;
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
  waitForContentLayoutBeforeEnter = false,
  animateContentLayout = false,
  enterInstant = false,
  backdropIntensity = 'default',
  testID,
}: ForgeBottomSheetProps) {
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useSharedValue(closeDistance);
  const backdropOpacity = useSharedValue(0);
  const closing = useSharedValue(false);
  const dragStart = useSharedValue(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [naturalSheetHeight, setNaturalSheetHeight] = useState(0);
  const [entryContentReady, setEntryContentReady] = useState(false);
  // The Modal stays mounted for a bounded exit even after the parent has been
  // told to close, so the shared sheet fully owns its own dismissal lifecycle.
  const [rendered, setRendered] = useState(visible);
  // While exiting, the still-mounted Modal must stop capturing touches so the
  // dismissal takes effect from the interaction itself and the screen below is
  // immediately usable — an interrupted exit can never swallow the next tap.
  const [exiting, setExiting] = useState(false);
  const closingRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryOffsetRef = useRef(initialOffset);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Keep the last visible content mounted through the slide-out. `close()` fires
  // the parent's onClose synchronously, which usually clears the state the
  // children read (e.g. the selected item, or a sub-view), so re-rendering the
  // children during the exit would blank — and collapse — the still-sliding
  // surface. Snapshot it here, mirroring how ForgeConfirmationDialog retains its
  // `shown` copy through the fade-out.
  const lastChildrenRef = useRef<React.ReactNode>(null);
  // Read inside the entrance effect without adding it to the deps: it must be
  // sampled at the moment `visible` flips true, and toggling it afterwards must
  // never re-run (and thus re-animate) the entrance.
  const enterInstantRef = useRef(enterInstant);
  enterInstantRef.current = enterInstant;

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const completeExit = useCallback(() => {
    clearExitTimer();
    closing.value = false;
    setExiting(false);
    setRendered(false);
  }, [clearExitTimer, closing]);

  // Bounded internal exit. An interrupted or dropped Reanimated completion must
  // never leave the native Modal mounted and swallowing touches on the screen
  // below, so a JS fallback always unmounts within a fixed budget.
  const beginExit = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    closing.value = true;
    setExiting(true);
    clearExitTimer();
    // On the web there is no separate native Modal window: the sheet is a DOM
    // overlay, so any mounted-exit frame keeps its container in the hit-test and
    // can swallow the next tap. Unmount immediately once the parent has been
    // notified. Native keeps the animated exit, bounded by the JS fallback.
    if (reducedMotion || Platform.OS === 'web') {
      translateY.value = closeDistance;
      backdropOpacity.value = 0;
      completeExit();
      return;
    }
    translateY.value = withTiming(closeDistance, { duration: forgeMotion.sheetExit, easing: forgeMotion.sheetExitEasing }, (finished) => {
      if (finished) runOnJS(completeExit)();
    });
    backdropOpacity.value = withTiming(0, { duration: forgeMotion.state });
    exitTimerRef.current = setTimeout(completeExit, forgeMotion.sheetExit + 160);
  }, [backdropOpacity, clearExitTimer, closeDistance, closing, completeExit, reducedMotion, translateY]);

  const close = useCallback((withHaptic = false) => {
    if (closingRef.current) return;
    onCloseStart?.();
    if (withHaptic) lightHaptic();
    // Notify the parent synchronously on every close intent (close button,
    // backdrop, drag, Android Back). The exit animation is a local courtesy;
    // parent close state must never wait on Reanimated completing.
    onCloseRef.current();
    beginExit();
  }, [beginExit, onCloseStart]);

  useEffect(() => {
    if (!visible) {
      entryOffsetRef.current = initialOffset;
      setEntryContentReady(false);
      return undefined;
    }
    clearExitTimer();
    closingRef.current = false;
    closing.value = false;
    setExiting(false);
    setRendered(true);
    translateY.value = waitForContentLayoutBeforeEnter && entryContentReady
      ? entryOffsetRef.current
      : initialOffset;
    backdropOpacity.value = 0;
    // The source chooser is a required first step. Do not make its sheet
    // visible until its action card has a stable layout to travel with it.
    if (waitForContentLayoutBeforeEnter && !entryContentReady) {
      // Guarantee entry even if the content onLayout never sets readiness (for
      // example the keyboard is already up when the sheet opens, so onLayout
      // skips): the sheet must never get stuck mounted-but-invisible.
      entryFallbackRef.current = setTimeout(() => setEntryContentReady(true), 160);
      return () => {
        if (entryFallbackRef.current) clearTimeout(entryFallbackRef.current);
        entryFallbackRef.current = null;
      };
    }
    // Reduced motion, or a restore-in-place, presents the sheet already open.
    if (reducedMotion || enterInstantRef.current) {
      translateY.value = 0;
      backdropOpacity.value = 1;
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      // A timed ease-out (not a spring) so the open starts at full speed and
      // decelerates into place — no spring "accelerate from rest" lag. The spring
      // stays for the interactive drag snap-back below.
      translateY.value = withTiming(0, { duration: forgeMotion.sheetEnter, easing: forgeMotion.easing });
      backdropOpacity.value = withTiming(1, { duration: forgeMotion.transition });
    });
    return () => cancelAnimationFrame(frame);
  }, [backdropOpacity, clearExitTimer, closing, entryContentReady, initialOffset, reducedMotion, translateY, visible, waitForContentLayoutBeforeEnter]);

  // Parent-driven close (visible flipped without a local close intent) runs the
  // same bounded exit, so a programmatic dismissal never abandons a mounted
  // Modal either.
  useEffect(() => {
    if (!visible && rendered && !closingRef.current) beginExit();
  }, [beginExit, rendered, visible]);

  useEffect(() => clearExitTimer, [clearExitTimer]);

  useEffect(() => {
    if (!visible || !keyboardAvoiding) {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      return undefined;
    }
    const transition = (nextVisible: boolean, event: KeyboardEvent) => {
      if (reducedMotion) {
        setKeyboardVisible(nextVisible);
        setKeyboardHeight(nextVisible ? event.endCoordinates.height : 0);
        return;
      }
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
  }, [keyboardAvoiding, reducedMotion, visible]);

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
        // Keep drag dismissal on the same JS path as the close button and backdrop.
        // It avoids web gesture callbacks bypassing parent state updates.
        runOnJS(close)(false);
      } else {
        translateY.value = reducedMotion ? 0 : withSpring(0, forgeMotion.sheetSpring);
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
  // A sheet can never grow past the screen space above the top safe area. Its
  // body must own any overflow so a short viewport or the keyboard cannot
  // create an unreachable lower region.
  const maximumSheetHeight = windowHeight - insets.top;

  if (!visible && !rendered) return null;
  // While open, render (and remember) the live content; while exiting, keep
  // rendering the remembered content so the surface slides out with what the
  // user was looking at instead of an empty, collapsed card.
  const liveChildren = typeof children === 'function' ? children(() => close(false)) : children;
  if (visible && liveChildren != null && liveChildren !== false) lastChildrenRef.current = liveChildren;
  const renderedChildren = visible ? liveChildren : lastChildrenRef.current;
  return (
    <Modal
      visible
      transparent
      animationType="none"
      hardwareAccelerated={Platform.OS === 'android'}
      statusBarTranslucent={Platform.OS === 'android'}
      navigationBarTranslucent={Platform.OS === 'android'}
      onRequestClose={() => {
        if (!onBackRequest?.()) close(true);
      }}
    >
      <View
        testID={testID}
        pointerEvents={exiting ? 'none' : 'auto'}
        style={[
          styles.backdrop,
          webViewportFill,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.backdropVisual,
            backdropStyle,
            backdropIntensity === 'strong' && styles.strongBackdrop,
          ]}
        />
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
              layout={animateContentLayout && !reducedMotion ? LinearTransition.duration(240) : undefined}
              onLayout={(event) => {
                if (keyboardVisible) return;
                const height = event.nativeEvent.layout.height;
                setNaturalSheetHeight(height);
                if (waitForContentLayoutBeforeEnter && !entryContentReady) {
                  // A fixed entry offset can leave the lower half of a tall
                  // sheet visible before its first animation frame. Place the
                  // measured sheet entirely below the viewport first.
                  entryOffsetRef.current = Math.max(initialOffset, height + 16);
                  translateY.value = entryOffsetRef.current;
                  setEntryContentReady(true);
                }
              }}
              onStartShouldSetResponderCapture={() => keyboardVisible && dismissTextKeyboardOnTap}
              onResponderRelease={() => Keyboard.dismiss()}
              style={[
                styles.sheet,
                { backgroundColor: theme.surfaceElevated, shadowColor: theme.shadow },
                style,
                { maxHeight: maximumSheetHeight },
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
                waitForContentLayoutBeforeEnter && !entryContentReady && styles.preparingSheet,
                sheetStyle,
              ]}
            >
              {dragArea ? dragArea(renderedChildren) : renderedChildren}
            </Animated.View>
          </SheetDragContext.Provider>
        </View>
        {overlay}
      </View>
    </Modal>
  );
}

export function ForgeBottomSheetHandle() {
  const theme = useForgeTheme();
  const pan = useContext(SheetDragContext);
  const isInsideDragArea = useContext(SheetDragAreaContext);
  const handle = (
    <View testID="forge-sheet-drag-tab" collapsable={false} style={styles.handleTouchArea}>
      <View style={[styles.handle, { backgroundColor: theme.divider }]} />
    </View>
  );
  return pan && !isInsideDragArea ? <GestureDetector gesture={pan}>{handle}</GestureDetector> : handle;
}

export function ForgeBottomSheetDragArea({ children }: { children: React.ReactNode }) {
  const pan = useContext(SheetDragContext);
  const isInsideDragArea = useContext(SheetDragAreaContext);
  const area = (
    <SheetDragAreaContext.Provider value>
      <View testID="forge-sheet-drag-area" collapsable={false} style={styles.dragArea}>
        {children}
      </View>
    </SheetDragAreaContext.Provider>
  );
  return pan && !isInsideDragArea ? <GestureDetector gesture={pan}>{area}</GestureDetector> : area;
}

const styles = StyleSheet.create({
  pointerEventsBoxNone: { pointerEvents: 'box-none' },
  backdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  // Only the dimmer fades. The sheet must stay fully opaque throughout its
  // entrance, otherwise the underlying screen becomes readable through it.
  backdropVisual: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23,25,28,0.24)',
  },
  strongBackdrop: { backgroundColor: 'rgba(23,25,28,0.42)' },
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
  preparingSheet: { opacity: 0 },
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
  dragArea: { alignSelf: 'stretch' },
});
