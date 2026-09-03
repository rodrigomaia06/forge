import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, Platform } from 'react-native';

import type { MeasureSetInput } from './activeWorkoutTypes';

type OffsetScrollable = {
  scrollToOffset: (params: { offset: number; animated?: boolean }) => void;
};

/**
 * Keeps a set input clear of the number keyboard without permanently moving
 * the workout list. The caller owns the scroll view and reports its offset.
 */
export function useFocusedSetKeyboardLift(
  scrollRef: React.RefObject<OffsetScrollable | null>,
) {
  const scrollOffsetRef = useRef(0);
  const restoreScrollOffsetRef = useRef<number | null>(null);
  const focusedSetMeasureRef = useRef<MeasureSetInput | null>(null);

  const restoreScrollPosition = useCallback((): void => {
    const offset = restoreScrollOffsetRef.current;
    restoreScrollOffsetRef.current = null;
    focusedSetMeasureRef.current = null;
    if (offset === null) return;
    scrollRef.current?.scrollToOffset({ offset, animated: true });
  }, [scrollRef]);

  const liftFocusedSetInput = useCallback((): void => {
    const measure = focusedSetMeasureRef.current;
    const keyboard = Keyboard.metrics();
    if (!measure || !keyboard) return;
    measure(({ y, height }) => {
      const breathingRoom = 48;
      const fieldBottom = y + height;
      if (fieldBottom <= keyboard.screenY - breathingRoom) return;
      if (restoreScrollOffsetRef.current === null) {
        restoreScrollOffsetRef.current = scrollOffsetRef.current;
      }
      // Keep the focused number field in the comfortable centre of the
      // visible area, rather than pinning it directly above the keyboard.
      const targetCenter = Math.max(118, (keyboard.screenY + 64) / 2);
      const nextOffset = Math.max(
        0,
        scrollOffsetRef.current + y + height / 2 - targetCenter,
      );
      scrollRef.current?.scrollToOffset({ offset: nextOffset, animated: true });
    });
  }, [scrollRef]);

  const onSetInputFocus = useCallback((measure: MeasureSetInput): void => {
    focusedSetMeasureRef.current = measure;
    requestAnimationFrame(liftFocusedSetInput);
  }, [liftFocusedSetInput]);

  useEffect(() => {
    const settleFocusedInput = () =>
      requestAnimationFrame(() => requestAnimationFrame(liftFocusedSetInput));
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      settleFocusedInput,
    );
    // The initial iOS event lets the list move with the keyboard. Repeating
    // after its native frame settles avoids relying on pre-animation metrics.
    const didShow = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardDidShow', settleFocusedInput)
      : null;
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      restoreScrollPosition,
    );
    return () => {
      show.remove();
      didShow?.remove();
      hide.remove();
    };
  }, [liftFocusedSetInput, restoreScrollPosition]);

  const onScrollOffsetChange = useCallback((offset: number): void => {
    scrollOffsetRef.current = offset;
  }, []);

  return { onSetInputFocus, onScrollOffsetChange };
}
