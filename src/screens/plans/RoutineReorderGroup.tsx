import { scheduleOnRN } from 'react-native-worklets';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import Animated, {
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
  dragPointerY: SharedValue<number | null>;
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

/** Nested FlatLists inherit the Plans list's scroll metrics without adding a scroller. */
export function RoutineReorderGroup<T>({
  data,
  enabled,
  rowHeight,
  reducedMotion,
  keyExtractor,
  outerScrollOffset,
  onReorder,
  onDragStateChange,
  dragPointerY,
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
  const { height: viewportHeight } = useWindowDimensions();
  const [windowSize, setWindowSize] = useState(7);
  const latest = useRef({
    renderedData,
    keyExtractor,
    onReorder,
    onDragStateChange,
    dragPointerY,
    onDragBoundsChange,
  });
  latest.current = {
    renderedData,
    keyExtractor,
    onReorder,
    onDragStateChange,
    dragPointerY,
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
    dragPointerY.set(null);
    latest.current.onDragBoundsChange(false, false);
    latest.current.onDragStateChange(false);
    setWindowSize(7);
  }, [activeIndex, dragStartScrollOffset, outerScrollOffset, rawTranslation, dragPointerY]);

  // Reset the shared transforms right after the reordered data commits (before
  // paint), so the settled rows land at their new slots with translateY 0.
  useLayoutEffect(() => {
    if (!pendingReset.current) return;
    pendingReset.current = false;
    resetDrag();
  }, [renderedData, resetDrag]);

  const beginDrag = useCallback((index: number) => {
    selectionHaptic();
    latest.current.onDragBoundsChange(index > 0, index < latest.current.renderedData.length - 1);
    latest.current.onDragStateChange(true);
  }, []);

  const updateBounds = useCallback((index: number) => {
    latest.current.onDragBoundsChange(index > 0, index < latest.current.renderedData.length - 1);
  }, []);

  const finishDrag = useCallback(
    (from: number, to: number) => {
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
    },
    [resetDrag],
  );

  const cancelDrag = useCallback(() => {
    resetDrag();
  }, [resetDrag]);

  useAnimatedReaction(
    () => targetIndex.value,
    (current, previous) => {
      if (current >= 0 && current !== previous) scheduleOnRN(updateBounds, current);
    },
    [updateBounds],
  );

  // Keep the held gesture cell mounted during edge scrolling. Expand only the
  // traversed window, then restore the ordinary window when the drag ends.
  useAnimatedReaction(
    () =>
      activeIndex.value < 0
        ? 7
        : 7 +
          2 *
            Math.ceil(
              Math.abs(outerScrollOffset.value - dragStartScrollOffset.value) /
                (viewportHeight / 2),
            ),
    (current, previous) => {
      if (current !== previous) scheduleOnRN(setWindowSize, current);
    },
    [viewportHeight],
  );

  return (
    <FlatList
      data={renderedData}
      keyExtractor={keyExtractor}
      scrollEnabled={false}
      style={{ height: renderedData.length * rowHeight }}
      getItemLayout={(_data, index) => ({ length: rowHeight, offset: rowHeight * index, index })}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={windowSize}
      removeClippedSubviews={false}
      extraData={enabled}
      renderItem={({ item, index }) => (
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
          dragPointerY={dragPointerY}
          onFinishDrag={finishDrag}
          onCancelDrag={cancelDrag}
        >
          {(dragGesture) =>
            renderItem({
              item,
              index,
              last: index === renderedData.length - 1,
              dragGesture,
            })
          }
        </RoutineReorderItem>
      )}
    />
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
  dragPointerY,
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
  onBeginDrag: (index: number) => void;
  dragPointerY: SharedValue<number | null>;
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
      transform: [
        {
          translateY: reducedMotion
            ? destination
            : withSpring(destination, DASHBOARD_REORDER_SPRING),
        },
      ],
    };
  }, [index, itemCount, reducedMotion, rowHeight]);

  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled && itemCount > 1)
        .activateAfterLongPress(140)
        .maxPointers(1)
        .onStart((event) => {
          dragPointerY.set(event.absoluteY);
          activeIndex.value = index;
          rawTranslation.value = 0;
          dragStartScrollOffset.value = outerScrollOffset.value;
          scheduleOnRN(onBeginDrag, index);
        })
        .onUpdate((event) => {
          rawTranslation.value = event.translationY;
          dragPointerY.set(event.absoluteY);
        })
        // Snap the held row to its destination slot and commit in the same commit
        // the data reorders (the layout effect resets transforms). Committing here
        // rather than in a settle-spring callback means an interrupted animation
        // can never silently drop the reorder.
        .onEnd(() => {
          dragPointerY.set(null);
          const destination = targetIndex.value;
          const scrollDelta = outerScrollOffset.value - dragStartScrollOffset.value;
          rawTranslation.value = (destination - index) * rowHeight - scrollDelta;
          scheduleOnRN(onFinishDrag, index, destination);
        })
        .onFinalize((_event, success) => {
          if (success || activeIndex.value !== index) return;
          dragPointerY.set(null);
          scheduleOnRN(onCancelDrag);
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
      dragPointerY,
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
  return <Animated.View style={[styles.row, animatedStyle]}>{children(dragGesture)}</Animated.View>;
}

/** Keeps the drag GestureDetector local to the visible handle. */
export function RoutineDragHandle({
  gesture,
  children,
}: {
  gesture: PanGesture;
  children: React.ReactNode;
}) {
  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}

const styles = StyleSheet.create({
  row: { position: 'relative' },
});
