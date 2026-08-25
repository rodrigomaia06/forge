import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Icon } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { selectionHaptic } from './activeWorkoutFeedback';
import { SetRow } from './SetRow';
import { SetDetailsCard } from './SetDetailsCard';
import type { SwipeableSetRowProps } from './activeWorkoutTypes';

function SwipeableSetRowComponent({
  set,
  index,
  onChange,
  onToggle,
  onDelete,
}: SwipeableSetRowProps) {
  const deleteProgress = useRef(new Animated.Value(0)).current;
  const entranceProgress = useRef(new Animated.Value(0)).current;
  const removalProgress = useRef(new Animated.Value(0)).current;
  const deleteFractionRef = useRef(0);
  const openRef = useRef(false);
  const removalStartedRef = useRef(false);
  const touchStartRef = useRef<{ pageX: number; pageY: number } | null>(null);
  const touchActiveRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    Animated.timing(entranceProgress, {
      toValue: 1,
      duration: 120,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    return () => entranceProgress.stopAnimation();
  }, [entranceProgress]);

  useEffect(() => () => removalProgress.stopAnimation(), [removalProgress]);

  const handleDelete = (): void => {
    if (removalStartedRef.current) return;
    removalStartedRef.current = true;
    Animated.timing(removalProgress, {
      toValue: 1,
      duration: 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished) onDelete();
    });
  };

  const settleDelete = (shouldOpen: boolean): void => {
    const wasOpen = openRef.current;
    openRef.current = shouldOpen;
    setIsOpen(shouldOpen);
    if (wasOpen !== shouldOpen) selectionHaptic();
    Animated.timing(deleteProgress, {
      toValue: shouldOpen ? 1 : 0,
      duration: 160,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const updateDeleteFromDelta = (dx: number, dy = 0): boolean => {
    if (Math.abs(dx) <= Math.abs(dy) * 0.9 || (!openRef.current && dx >= 0)) return false;
    const base = openRef.current ? -60 : 0;
    const next = Math.max(-60, Math.min(0, base + dx));
    deleteFractionRef.current = Math.min(1, Math.max(0, Math.abs(next) / 60));
    deleteProgress.setValue(deleteFractionRef.current);
    if (!openRef.current && next <= -30) setIsOpen(true);
    return true;
  };

  const onInputTouchStart = (event: GestureResponderEvent): void => {
    const { pageX, pageY } = event.nativeEvent;
    touchStartRef.current = { pageX, pageY };
    touchActiveRef.current = false;
  };
  const onInputTouchMove = (event: GestureResponderEvent): void => {
    if (!touchStartRef.current) return;
    const { pageX, pageY } = event.nativeEvent;
    const dx = pageX - touchStartRef.current.pageX;
    const dy = pageY - touchStartRef.current.pageY;
    if (updateDeleteFromDelta(dx, dy)) touchActiveRef.current = true;
  };
  const onInputTouchEnd = (): void => {
    if (touchActiveRef.current) settleDelete(deleteFractionRef.current >= 0.5);
    touchStartRef.current = null;
    touchActiveRef.current = false;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        Math.abs(gesture.dx) > 3 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 0.65 &&
        (openRef.current || gesture.dx < 0),
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 3 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 0.65 &&
        (openRef.current || gesture.dx < 0),
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => updateDeleteFromDelta(gesture.dx, gesture.dy),
      onPanResponderRelease: (_, gesture) =>
        settleDelete(Math.max(-60, Math.min(0, (openRef.current ? -60 : 0) + gesture.dx)) < -30),
    }),
  ).current;

  return (
    <View {...panResponder.panHandlers} style={styles.swipeRow}>
      <View pointerEvents={isOpen ? 'auto' : 'none'} style={styles.deleteActionLayer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete set ${index + 1}`}
          onPress={handleDelete}
          style={styles.deleteSetInline}
        >
          <Icon name="trash" size={21} color={dashboardTheme.surface} weight="regular" />
        </Pressable>
      </View>
      <Animated.View
        pointerEvents="auto"
        accessibilityLabel={`Set ${index + 1}`}
        accessibilityActions={[{ name: 'delete', label: 'Delete set' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') handleDelete();
        }}
        style={[
          styles.swipeContent,
          {
            opacity: removalProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              {
                translateX: Animated.add(
                  deleteProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }),
                  removalProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }),
                ),
              },
            ],
          },
        ]}
      >
        <Animated.View
          style={{
            opacity: entranceProgress,
            transform: [
              {
                translateY: entranceProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [4, 0],
                }),
              },
            ],
          }}
        >
          <SetRow
            set={set}
            index={index}
            onChange={onChange}
            onToggle={onToggle}
            onDelete={handleDelete}
            onOpenDetails={() => setDetailsOpen(true)}
            onInputTouchStart={onInputTouchStart}
            onInputTouchMove={onInputTouchMove}
            onInputTouchEnd={onInputTouchEnd}
          />
          {detailsOpen ? (
            <SetDetailsCard
              visible
              set={set}
              index={index}
              onChange={onChange}
              onDelete={handleDelete}
              onDone={() => setDetailsOpen(false)}
            />
          ) : null}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export const SwipeableSetRow = React.memo(
  SwipeableSetRowComponent,
  (previous, next) => previous.set === next.set && previous.index === next.index,
);

const styles = StyleSheet.create({
  swipeRow: { position: 'relative', overflow: 'hidden' },
  swipeContent: { zIndex: 1, backgroundColor: dashboardTheme.surface },
  deleteActionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 60,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  deleteSetInline: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C54848',
  },
});
