import { scheduleOnRN } from 'react-native-worklets';
import React, { useEffect, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { ForgeText as Text } from './ForgeText';
import { Icon } from './Icon';
import { mediumHaptic } from './haptics';

const DELETE_WIDTH = 88;

/**
 * A single list row that slides left to reveal a destructive Delete action,
 * matching the swipe pattern used on dashboard tiles and live-workout sets. The
 * whole revealed surface darkens on press (driven by press state, not RN's
 * pressed prop, which under-fills inside a gesture). Rounding is left to the
 * parent (wrap the rows in an overflow-hidden card).
 */
export function SwipeToDeleteRow({
  children,
  onDelete,
  deleteAccessibilityLabel,
  showDivider = false,
  contentBackgroundColor,
  enabled = true,
  borderRadius,
  deleteWidth = DELETE_WIDTH,
  deleteIconSize = 18,
  insetDeleteButton = false,
  gestureEnabled = true,
  deferCloseOnDelete = false,
  closeSignal,
  onRevealChange,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  deleteAccessibilityLabel: string;
  showDivider?: boolean;
  contentBackgroundColor?: string;
  /** When false, the row renders its content without the swipe/delete affordance. */
  enabled?: boolean;
  /** Rounds the swipe surface (and its red reveal) to match a rounded card. */
  borderRadius?: number;
  /** Width of the revealed Delete panel (larger reads more like a card action). */
  deleteWidth?: number;
  /** Size of the trash glyph in the revealed panel. */
  deleteIconSize?: number;
  /** Reveal a floating rounded red button (like the set delete) instead of a
   * full-height red panel — for inset rows rather than whole cards. */
  insetDeleteButton?: boolean;
  /** Suppresses the swipe recognizer (and closes any open reveal) without
   * changing the rendered tree, so a sibling drag can own the gesture without
   * remounting this row. Distinct from `enabled`, which gates the affordance. */
  gestureEnabled?: boolean;
  /** Keep the row slid open when Delete is tapped and just fire `onDelete` (e.g.
   * to raise a confirmation), instead of closing and collapsing immediately.
   * The row then closes on `closeSignal` (cancel) or unmounts (confirmed). */
  deferCloseOnDelete?: boolean;
  /** A value the parent changes to slide an open row closed — used to dismiss
   * the reveal when a deferred confirmation is cancelled. */
  closeSignal?: number;
  /** Reports whether the Delete action is open so compound gestures can coordinate. */
  onRevealChange?: (revealed: boolean) => void;
}) {
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  const translateX = useSharedValue(0);
  const open = useSharedValue(false);
  const [revealed, setRevealed] = useState(false);
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const layerStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -translateX.value / deleteWidth)),
  }));

  const settle = (shouldOpen: boolean): void => {
    setRevealed(shouldOpen);
    onRevealChange?.(shouldOpen);
    open.value = shouldOpen;
    translateX.value = reducedMotion
      ? (shouldOpen ? -deleteWidth : 0)
      : withSpring(shouldOpen ? -deleteWidth : 0, forgeMotion.swipeSpring);
  };
  useEffect(() => {
    if (enabled && gestureEnabled) return;
    setRevealed(false);
    onRevealChange?.(false);
    open.value = false;
    translateX.value = 0;
  }, [enabled, gestureEnabled, onRevealChange, open, translateX]);

  // Slide an open row closed when the parent bumps `closeSignal` (e.g. a deferred
  // delete confirmation was cancelled). Only acts when currently revealed, so it
  // is a no-op on mount.
  useEffect(() => {
    if (closeSignal === undefined) return;
    if (!open.value) return;
    setRevealed(false);
    onRevealChange?.(false);
    open.value = false;
    translateX.value = reducedMotion ? 0 : withSpring(0, forgeMotion.swipeSpring);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeSignal]);

  // When disabled (outside edit mode, or while a sibling drag owns the gesture)
  // render only the content: no destructive control exists at rest, and an open
  // reveal collapses closed — the reset effect above returns the shared values.
  if (!enabled) {
    return (
      <View style={[styles.row, borderRadius != null && { borderRadius }, { backgroundColor: contentBackgroundColor ?? theme.surface }]}>
        {children}
        {showDivider ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
      </View>
    );
  }

  const remove = (): void => {
    // Deferred mode: keep the row slid open and let the caller confirm first.
    // The dialog owns the haptic; the row closes on `closeSignal` or unmounts.
    if (deferCloseOnDelete) {
      onDelete();
      return;
    }
    mediumHaptic();
    setRevealed(false);
    onRevealChange?.(false);
    open.value = false;
    translateX.value = 0;
    // Collapse the row's height and fade siblings up rather than letting them jump.
    if (!reducedMotion && Platform.OS !== 'web') {
      if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)
        UIManager.setLayoutAnimationEnabledExperimental(true);
      LayoutAnimation.configureNext(
        LayoutAnimation.create(forgeMotion.feedback, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
      );
    }
    onDelete();
  };

  const swipe = Gesture.Pan()
    .enabled(gestureEnabled)
    .activeOffsetX([-16, 16])
    .failOffsetY([-16, 16])
    .onUpdate((gesture) => {
      if (!open.value && gesture.translationX >= 0) return;
      const base = open.value ? -deleteWidth : 0;
      translateX.value = Math.max(-deleteWidth, Math.min(0, base + gesture.translationX));
    })
    .onEnd((gesture) => {
      const offset = (open.value ? -deleteWidth : 0) + gesture.translationX;
      const shouldOpen = Math.max(-deleteWidth, Math.min(0, offset)) < -deleteWidth * 0.5;
      scheduleOnRN(settle, shouldOpen);
    });

  return (
    <GestureDetector gesture={swipe}>
      <View style={[styles.row, borderRadius != null && { borderRadius }, { backgroundColor: insetDeleteButton ? (contentBackgroundColor ?? theme.surface) : theme.destructiveSurface }]}>
        <Animated.View
          style={[
            styles.deleteLayer,
            { width: deleteWidth },
            layerStyle,
            { backgroundColor: insetDeleteButton ? 'transparent' : theme.destructiveSurface, pointerEvents: revealed ? 'auto' : 'none' },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={deleteAccessibilityLabel}
            onPress={remove}
            style={({ pressed }) => [
              insetDeleteButton ? styles.insetDeleteAction : styles.deleteAction,
              insetDeleteButton && { backgroundColor: theme.destructiveSurface },
              pressed && styles.deleteActionPressed,
            ]}
          >
            <Icon name="trash" size={deleteIconSize} color={theme.textDestructive} />
            {insetDeleteButton ? null : <Text style={[styles.deleteText, { color: theme.textDestructive }]}>Delete</Text>}
          </Pressable>
        </Animated.View>
        {/* The sliding content keeps the card's rounding so its right edge curves
            away as it slides — the dashboard-card delete look, not a straight
            square edge against the red panel. */}
        <Animated.View
          style={[
            contentStyle,
            borderRadius != null && { borderRadius, overflow: 'hidden' },
            { backgroundColor: contentBackgroundColor ?? theme.surface },
          ]}
        >
          {children}
          {showDivider ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: { position: 'relative', overflow: 'hidden' },
  deleteLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: DELETE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAction: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: 3 },
  // A fixed rounded-square red button (centered by the delete layer), so tall
  // rows don't stretch it into a long pill.
  insetDeleteAction: { width: 56, height: 56, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  deleteActionPressed: { opacity: 0.8 },
  deleteText: { ...typeScale.caption },
  divider: { position: 'absolute', left: 16, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
});
