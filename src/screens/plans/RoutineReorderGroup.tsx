import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { selectionHaptic } from '../../components/ui';

const DASHBOARD_REORDER_SPRING = {
  damping: 20,
  mass: 0.2,
  stiffness: 100,
  overshootClamping: false,
  restSpeedThreshold: 0.2,
  restDisplacementThreshold: 0.2,
} as const;

export type RoutineReorderRenderItem<T> = {
  item: T;
  index: number;
  last: boolean;
  dragGesture: PanGesture;
};

type Props<T> = {
  data: T[];
  enabled: boolean;
  rowHeight: number;
  reducedMotion: boolean;
  keyExtractor: (item: T) => string;
  outerScrollOffset: SharedValue<number>;
  onReorder: (data: T[]) => void;
  onDragStateChange: (active: boolean) => void;
  onDragPointerChange: (absoluteY: number | null) => void;
  onDragBoundsChange: (canMoveUp: boolean, canMoveDown: boolean) => void;
  renderItem: (info: RoutineReorderRenderItem<T>) => React.ReactNode;
};

function moveItem<T>(data: T[], from: number, to: number): T[] {
  const next = [...data];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function sameKeys<T>(before: T[], after: T[], keyExtractor: (item: T) => string): boolean {
  if (before.length !== after.length) return false;
  const beforeKeys = before.map(keyExtractor).sort();
  const afterKeys = after.map(keyExtractor).sort();
  return beforeKeys.every((key, index) => key === afterKeys[index]);
}

/**
 * A fixed-height, non-virtualized reorder surface for the small routine groups
 * on Plans. Keeping every row mounted and in normal flow preserves the grouped
 * card's exact height while transforms provide the Dashboard-style hover.
 */
export function RoutineReorderGroup<T>({
  data,
  enabled,
  rowHeight,
  reducedMotion,
  keyExtractor,
  outerScrollOffset,
  onReorder,
  onDragStateChange,
  onDragPointerChange,
  onDragBoundsChange,
  renderItem,
}: Props<T>) {
  // Controlled local order so the transformed rows and their reordered data
  // settle in the same React commit. The Reanimated transform stays applied at
  // all times (never conditionally swapped for a static style — on native that
  // leaves the view's last animated transform stuck and blanks the card); at
  // rest the worklet simply returns translateY 0.
  const [renderedData, setRenderedData] = useState(data);
  const activeIndex = useSharedValue(-1);
  const rawTranslation = useSharedValue(0);
  const dragStartScrollOffset = useSharedValue(0);
  const pendingReset = useRef(false);

  const latest = useRef({
    renderedData,
    keyExtractor,
    onReorder,
    onDragStateChange,
    onDragPointerChange,
    onDragBoundsChange,
  });
  latest.current = {
    renderedData,
    keyExtractor,
    onReorder,
    onDragStateChange,
    onDragPointerChange,
    onDragBoundsChange,
  };

  useEffect(() => {
    if (activeIndex.value < 0) setRenderedData(data);
  }, [activeIndex, data]);

  const effectiveTranslation = useDerivedValue(
    () => rawTranslation.value + outerScrollOffset.value - dragStartScrollOffset.value,
  );
  const targetIndex = useDerivedValue(() => {
    if (activeIndex.value < 0) return -1;
    const unclamped = activeIndex.value + Math.round(effectiveTranslation.value / rowHeight);
    return Math.max(0, Math.min(renderedData.length - 1, unclamped));
  }, [renderedData.length, rowHeight]);

  const resetDrag = useCallback(() => {
    activeIndex.value = -1;
    rawTranslation.value = 0;
    dragStartScrollOffset.value = outerScrollOffset.value;
    latest.current.onDragPointerChange(null);
    latest.current.onDragBoundsChange(false, false);
    latest.current.onDragStateChange(false);
  }, [activeIndex, dragStartScrollOffset, outerScrollOffset, rawTranslation]);

  // Reset the shared transforms right after the reordered data commits (before
  // paint), so the settled rows land at their new slots with translateY 0.
  useLayoutEffect(() => {
    if (!pendingReset.current) return;
    pendingReset.current = false;
    resetDrag();
  }, [renderedData, resetDrag]);

  const beginDrag = useCallback((index: number, absoluteY: number) => {
    selectionHaptic();
    latest.current.onDragPointerChange(absoluteY);
    latest.current.onDragBoundsChange(index > 0, index < latest.current.renderedData.length - 1);
    latest.current.onDragStateChange(true);
  }, []);

  const updatePointer = useCallback((absoluteY: number) => {
    latest.current.onDragPointerChange(absoluteY);
  }, []);

  const updateBounds = useCallback((index: number) => {
    latest.current.onDragBoundsChange(index > 0, index < latest.current.renderedData.length - 1);
  }, []);

  const finishDrag = useCallback((from: number, to: number) => {
    const current = latest.current.renderedData;
    if (from === to) {
      resetDrag();
      return;
    }

    const next = moveItem(current, from, to);
    const valid = sameKeys(current, next, latest.current.keyExtractor);
    if (__DEV__) {
      console.assert(valid, 'Routine reorder must preserve every routine id.', {
        before: current.map(latest.current.keyExtractor),
        after: next.map(latest.current.keyExtractor),
      });
    }
    if (!valid) {
      resetDrag();
      return;
    }

    // Commit the reordered data and reset the transforms together: the layout
    // effect above fires on this renderedData change and zeroes the shared
    // transforms before paint, so the rows land at their new slots.
    pendingReset.current = true;
    setRenderedData(next);
    latest.current.onReorder(next);
  }, [resetDrag]);

  const cancelDrag = useCallback(() => {
    resetDrag();
  }, [resetDrag]);

  useAnimatedReaction(
    () => targetIndex.value,
    (current, previous) => {
      if (current >= 0 && current !== previous) runOnJS(updateBounds)(current);
    },
    [updateBounds],
  );

  return (
    <>
      {renderedData.map((item, index) => (
        <RoutineReorderItem
          key={keyExtractor(item)}
          index={index}
          itemCount={renderedData.length}
          enabled={enabled}
          rowHeight={rowHeight}
          reducedMotion={reducedMotion}
          activeIndex={activeIndex}
          targetIndex={targetIndex}
          rawTranslation={rawTranslation}
          effectiveTranslation={effectiveTranslation}
          dragStartScrollOffset={dragStartScrollOffset}
          outerScrollOffset={outerScrollOffset}
          onBeginDrag={beginDrag}
          onUpdatePointer={updatePointer}
          onFinishDrag={finishDrag}
          onCancelDrag={cancelDrag}
        >
          {(dragGesture) => renderItem({
            item,
            index,
            last: index === renderedData.length - 1,
            dragGesture,
          })}
        </RoutineReorderItem>
      ))}
    </>
  );
}

function RoutineReorderItem({
  index,
  itemCount,
  enabled,
  rowHeight,
  reducedMotion,
  activeIndex,
  targetIndex,
  rawTranslation,
  effectiveTranslation,
  dragStartScrollOffset,
  outerScrollOffset,
  onBeginDrag,
  onUpdatePointer,
  onFinishDrag,
  onCancelDrag,
  children,
}: {
  index: number;
  itemCount: number;
  enabled: boolean;
  rowHeight: number;
  reducedMotion: boolean;
  activeIndex: SharedValue<number>;
  targetIndex: SharedValue<number>;
  rawTranslation: SharedValue<number>;
  effectiveTranslation: SharedValue<number>;
  dragStartScrollOffset: SharedValue<number>;
  outerScrollOffset: SharedValue<number>;
  onBeginDrag: (index: number, absoluteY: number) => void;
  onUpdatePointer: (absoluteY: number) => void;
  onFinishDrag: (from: number, to: number) => void;
  onCancelDrag: () => void;
  children: (dragGesture: PanGesture) => React.ReactNode;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const from = activeIndex.value;
    const to = targetIndex.value;
    let destination = 0;

    // At rest (no active drag): hold every row at its natural position with no
    // animation. Springing back to 0 here would fight the committed reorder that
    // has already moved each row, producing a post-drop momentum slide.
    if (from < 0) {
      return { zIndex: 0, elevation: 0, opacity: 1, transform: [{ translateY: 0 }] };
    }

    if (from === index) {
      const minimum = -from * rowHeight;
      const maximum = (itemCount - 1 - from) * rowHeight;
      destination = Math.max(minimum, Math.min(maximum, effectiveTranslation.value));
      return {
        zIndex: 999,
        elevation: 1,
        opacity: 0.97,
        transform: [{ translateY: destination }],
      };
    }
    if (from < to && index > from && index <= to) destination = -rowHeight;
    if (from > to && index >= to && index < from) destination = rowHeight;

    // Only the make-room shift while a drag is live is sprung; the drop itself
    // resets to 0 above, so rows settle exactly where the reorder placed them.
    return {
      zIndex: 0,
      elevation: 0,
      opacity: 1,
      transform: [{
        translateY: reducedMotion
          ? destination
          : withSpring(destination, DASHBOARD_REORDER_SPRING),
      }],
    };
  }, [index, itemCount, reducedMotion, rowHeight]);

  const dragGesture = useMemo(
    () => Gesture.Pan()
      .enabled(enabled && itemCount > 1)
      .activateAfterLongPress(140)
      .maxPointers(1)
      .onStart((event) => {
        activeIndex.value = index;
        rawTranslation.value = 0;
        dragStartScrollOffset.value = outerScrollOffset.value;
        runOnJS(onBeginDrag)(index, event.absoluteY);
      })
      .onUpdate((event) => {
        rawTranslation.value = event.translationY;
        runOnJS(onUpdatePointer)(event.absoluteY);
      })
      // Snap the held row to its destination slot and commit in the same commit
      // the data reorders (the layout effect resets transforms). Committing here
      // rather than in a settle-spring callback means an interrupted animation
      // can never silently drop the reorder.
      .onEnd(() => {
        const destination = targetIndex.value;
        const scrollDelta = outerScrollOffset.value - dragStartScrollOffset.value;
        rawTranslation.value = (destination - index) * rowHeight - scrollDelta;
        runOnJS(onFinishDrag)(index, destination);
      })
      .onFinalize((_event, success) => {
        if (success || activeIndex.value !== index) return;
        runOnJS(onCancelDrag)();
      }),
    [
      activeIndex,
      dragStartScrollOffset,
      enabled,
      index,
      itemCount,
      onBeginDrag,
      onCancelDrag,
      onFinishDrag,
      onUpdatePointer,
      outerScrollOffset,
      rawTranslation,
      reducedMotion,
      rowHeight,
      targetIndex,
    ],
  );

  // The animated style is always applied; at rest its worklet returns
  // translateY 0. Never swap it for a static style — on native that leaves the
  // last animated transform stuck on the view and blanks the card.
  return (
    <Animated.View style={[styles.row, animatedStyle]}>
      {children(dragGesture)}
    </Animated.View>
  );
}

/** Keeps the drag GestureDetector local to the visible handle. */
export function RoutineDragHandle({ gesture, children }: { gesture: PanGesture; children: React.ReactNode }) {
  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}

const styles = StyleSheet.create({
  row: { position: 'relative' },
});
