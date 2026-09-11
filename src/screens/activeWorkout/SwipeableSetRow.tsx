import React, { useEffect, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Icon } from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { mediumHaptic } from './activeWorkoutFeedback';
import { SetDetailsCard } from './SetDetailsCard';
import { SetRow } from './SetRow';
import type { SwipeableSetRowProps } from './activeWorkoutTypes';

const DELETE_ACTION_WIDTH = 52;

function SwipeableSetRowComponent({
  set,
  index,
  onChange,
  onToggle,
  onDelete,
  deleteRevealed,
  onDeleteRevealChange,
  showCompletion = true,
  onInputFocus,
  trackingType,
}: SwipeableSetRowProps) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const deleteTranslateX = useSharedValue(deleteRevealed ? -DELETE_ACTION_WIDTH : 0);
  const deleteOpen = useSharedValue(deleteRevealed);
  const entranceProgress = useRef(new RNAnimated.Value(0)).current;
  const removalProgress = useRef(new RNAnimated.Value(0)).current;
  const deleteFractionRef = useRef(deleteRevealed ? 1 : 0);
  const removalStartedRef = useRef(false);
  const touchStartRef = useRef<{ pageX: number; pageY: number } | null>(null);
  const touchActiveRef = useRef(false);
  const openRef = useRef(deleteRevealed);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    RNAnimated.timing(entranceProgress, {
      toValue: 1,
      duration: 120,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    return () => entranceProgress.stopAnimation();
  }, [entranceProgress]);

  useEffect(() => {
    openRef.current = deleteRevealed;
    deleteFractionRef.current = deleteRevealed ? 1 : 0;
    deleteOpen.value = deleteRevealed;
    deleteTranslateX.value = withSpring(deleteRevealed ? -DELETE_ACTION_WIDTH : 0, {
      damping: 22,
      stiffness: 280,
      mass: 0.65,
      overshootClamping: true,
    });
  }, [deleteOpen, deleteRevealed, deleteTranslateX]);

  useEffect(() => () => removalProgress.stopAnimation(), [removalProgress]);

  const handleDelete = (): void => {
    if (removalStartedRef.current) return;
    removalStartedRef.current = true;
    RNAnimated.timing(removalProgress, {
      toValue: 1,
      duration: 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished) onDelete();
    });
  };

  const settleDelete = (shouldOpen: boolean): void => {
    if (shouldOpen !== openRef.current) {
      mediumHaptic();
      onDeleteRevealChange(shouldOpen);
      return;
    }
    deleteTranslateX.value = withSpring(shouldOpen ? -DELETE_ACTION_WIDTH : 0, {
      damping: 22,
      stiffness: 280,
      mass: 0.65,
      overshootClamping: true,
    });
  };

  const updateDeleteFromDelta = (dx: number, dy = 0): boolean => {
    if (Math.abs(dx) <= Math.abs(dy) * 0.9 || (!openRef.current && dx >= 0)) return false;
    const base = openRef.current ? -DELETE_ACTION_WIDTH : 0;
    const unconstrained = base + dx;
    const resisted =
      unconstrained < -DELETE_ACTION_WIDTH
        ? -DELETE_ACTION_WIDTH + (unconstrained + DELETE_ACTION_WIDTH) * 0.1
        : Math.min(0, unconstrained);
    const next = Math.max(-DELETE_ACTION_WIDTH, Math.min(0, resisted));
    deleteFractionRef.current = Math.min(1, Math.max(0, Math.abs(next) / DELETE_ACTION_WIDTH));
    deleteTranslateX.value = next;
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

  const deleteGesture = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onUpdate((gesture) => {
      if (!deleteOpen.value && gesture.translationX >= 0) return;
      const base = deleteOpen.value ? -DELETE_ACTION_WIDTH : 0;
      deleteTranslateX.value = Math.max(-DELETE_ACTION_WIDTH, Math.min(0, base + gesture.translationX));
    })
    .onEnd((gesture) => {
      const offset = (deleteOpen.value ? -DELETE_ACTION_WIDTH : 0) + gesture.translationX;
      runOnJS(settleDelete)(
        Math.max(-DELETE_ACTION_WIDTH, Math.min(0, offset)) < -DELETE_ACTION_WIDTH * 0.58,
      );
    });
  const deleteSwipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: deleteTranslateX.value }],
  }));

  return (
    <GestureDetector gesture={deleteGesture}>
      <View style={styles.swipeRow}>
      <View
        style={[
          styles.deleteActionLayer,
          { pointerEvents: deleteRevealed ? 'auto' : 'none' },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete set ${index + 1}`}
          onPress={handleDelete}
          style={({ pressed }) => [styles.deleteAction, pressed && styles.deleteActionPressed]}
        >
          <Icon name="trash" size={18} color={theme.textDestructive} weight="regular" />
        </Pressable>
      </View>
      <Animated.View
        accessibilityLabel={`Set ${index + 1}`}
        accessibilityActions={[{ name: 'delete', label: 'Delete set' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') handleDelete();
        }}
        style={[styles.swipeContent, deleteSwipeStyle]}
      >
        <RNAnimated.View
          style={{
            opacity: removalProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              {
                translateX: removalProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }),
              },
            ],
          }}
        >
        <RNAnimated.View
          style={{
            opacity: entranceProgress,
            transform: [
              {
                translateY: entranceProgress.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }),
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
            onInputFocus={onInputFocus}
            showCompletion={showCompletion}
            trackingType={trackingType}
          />
          {detailsOpen ? (
            <SetDetailsCard
              visible
              set={set}
              index={index}
              onChange={onChange}
              onDelete={handleDelete}
              onDone={() => setDetailsOpen(false)}
              trackingType={trackingType}
            />
          ) : null}
        </RNAnimated.View>
        </RNAnimated.View>
      </Animated.View>
      </View>
    </GestureDetector>
  );
}

export const SwipeableSetRow = React.memo(
  SwipeableSetRowComponent,
  (previous, next) =>
    previous.set === next.set &&
    previous.index === next.index &&
    previous.deleteRevealed === next.deleteRevealed &&
    previous.showCompletion === next.showCompletion,
);

const createStyles = (theme: import('../../types').ForgeTheme) => {
  const dashboardTheme = theme;
  return StyleSheet.create({
  swipeRow: { position: 'relative', overflow: 'hidden' },
  swipeContent: {
    zIndex: 1,
    backgroundColor: dashboardTheme.surface,
  },
  deleteActionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: DELETE_ACTION_WIDTH,
    backgroundColor: dashboardTheme.destructiveSurface,
  },
  deleteAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: 0 }],
  },
  deleteActionPressed: { backgroundColor: dashboardTheme.destructiveSurfacePressed },
  });
};
