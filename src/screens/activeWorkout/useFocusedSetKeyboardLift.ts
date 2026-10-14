import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, type KeyboardEvent } from 'react-native';

import type { MeasureSetInput } from './activeWorkoutTypes';
import { addForgeKeyboardListener, forgeKeyboardMetrics } from '../../components/ui/forgeKeyboard';

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
  const focusGeneration = useRef(0);
  // Extra scroll room added while the keyboard is up so even the last exercise
  // can lift its focused field clear of the keyboard (otherwise the list has no
  // content below it to scroll into view).
  const [keyboardSpacer, setKeyboardSpacer] = useState(0);

  const restoreScrollPosition = useCallback((): void => {
    focusGeneration.current += 1;
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
    const keyboard = keyboardFrameRef.current ?? forgeKeyboardMetrics();
    if (!measure || !keyboard) return;
    const generation = focusGeneration.current;
    measure(({ y, height }) => {
      // Native measurements can arrive after keyboard dismissal or another
      // input's focus event; they must not lift the list using the old frame.
      if (generation !== focusGeneration.current) return;
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
    focusGeneration.current += 1;
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
    const show = addForgeKeyboardListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      settleFocusedInput,
    );
    // The initial iOS event lets the list move with the keyboard. Repeating
    // after its native frame settles avoids relying on pre-animation metrics.
    const didShow = Platform.OS === 'ios'
      ? addForgeKeyboardListener('keyboardDidShow', settleFocusedInput)
      : null;
    const frameChange = Platform.OS === 'ios'
      ? addForgeKeyboardListener('keyboardWillChangeFrame', settleFocusedInput)
      : null;
    const hide = addForgeKeyboardListener(
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
