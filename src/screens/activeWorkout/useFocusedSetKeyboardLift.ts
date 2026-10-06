import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

import type { MeasureSetInput } from './activeWorkoutTypes';

type OffsetScrollable = {
  scrollToOffset: (params: { offset: number; animated?: boolean }) => void;
};

/**
 * Keeps a set input clear of the number keyboard without permanently moving
 * the workout list. The caller owns the scroll view and its UI-thread offset.
 */
export function useFocusedSetKeyboardLift(
  scrollRef: React.RefObject<OffsetScrollable | null>,
  suppliedScrollOffset?: SharedValue<number>,
) {
  const localScrollOffset = useSharedValue(0);
  const scrollOffset = suppliedScrollOffset ?? localScrollOffset;
  const restoreScrollOffsetRef = useRef<number | null>(null);
  const preFocusScrollOffsetRef = useRef<number | null>(null);
  const focusedSetMeasureRef = useRef<MeasureSetInput | null>(null);
  const keyboardFrameRef = useRef<KeyboardEvent['endCoordinates'] | null>(null);
  // Extra scroll room added while the keyboard is up so even the last exercise
  // can lift its focused field clear of the keyboard (otherwise the list has no
  // content below it to scroll into view).
  const [keyboardSpacer, setKeyboardSpacer] = useState(0);

  const restoreScrollPosition = useCallback((): void => {
    const offset = restoreScrollOffsetRef.current;
    restoreScrollOffsetRef.current = null;
    preFocusScrollOffsetRef.current = null;
    focusedSetMeasureRef.current = null;
    keyboardFrameRef.current = null;
    setKeyboardSpacer(0);
    if (offset === null) return;
    scrollRef.current?.scrollToOffset({ offset, animated: true });
  }, [scrollRef]);

  const liftFocusedSetInput = useCallback((): void => {
    const measure = focusedSetMeasureRef.current;
    const keyboard = keyboardFrameRef.current ?? Keyboard.metrics();
    if (!measure || !keyboard) return;
    measure(({ y, height }) => {
      const breathingRoom = 48;
      const fieldBottom = y + height;
      if (fieldBottom <= keyboard.screenY - breathingRoom) return;
      if (restoreScrollOffsetRef.current === null) {
        restoreScrollOffsetRef.current = preFocusScrollOffsetRef.current ?? scrollOffset.get();
      }
      // Keep the focused number field in the comfortable centre of the
      // visible area, rather than pinning it directly above the keyboard.
      const targetCenter = Math.max(118, (keyboard.screenY + 64) / 2);
      const nextOffset = Math.max(
        0,
        scrollOffset.get() + y + height / 2 - targetCenter,
      );
      scrollRef.current?.scrollToOffset({ offset: nextOffset, animated: true });
    });
  }, [scrollRef, scrollOffset]);

  const onSetInputFocus = useCallback((measure: MeasureSetInput): void => {
    if (preFocusScrollOffsetRef.current === null) {
      preFocusScrollOffsetRef.current = scrollOffset.get();
    }
    focusedSetMeasureRef.current = measure;
    requestAnimationFrame(liftFocusedSetInput);
  }, [liftFocusedSetInput, scrollOffset]);

  useEffect(() => {
    const settleFocusedInput = (event: KeyboardEvent) => {
      // The event always includes its final keyboard frame. Unlike
      // Keyboard.metrics(), it is also available during keyboardWillShow.
      keyboardFrameRef.current = event.endCoordinates;
      setKeyboardSpacer(event.endCoordinates.height);
      requestAnimationFrame(() => requestAnimationFrame(liftFocusedSetInput));
    };
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      settleFocusedInput,
    );
    // The initial iOS event lets the list move with the keyboard. Repeating
    // after its native frame settles avoids relying on pre-animation metrics.
    const didShow = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardDidShow', settleFocusedInput)
      : null;
    const frameChange = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillChangeFrame', settleFocusedInput)
      : null;
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      restoreScrollPosition,
    );
    return () => {
      show.remove();
      didShow?.remove();
      frameChange?.remove();
      hide.remove();
    };
  }, [liftFocusedSetInput, restoreScrollPosition]);

  const onScrollOffsetChange = useCallback((offset: number): void => {
    scrollOffset.set(offset);
  }, [scrollOffset]);

  return { onSetInputFocus, onScrollOffsetChange, keyboardSpacer };
}
