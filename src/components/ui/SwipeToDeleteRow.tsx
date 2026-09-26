import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

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
}) {
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  const translateX = useSharedValue(0);
  const open = useSharedValue(false);
  const [revealed, setRevealed] = useState(false);
  const [pressed, setPressed] = useState(false);
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const layerStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -translateX.value / DELETE_WIDTH)),
  }));

  if (!enabled) {
    return (
      <View style={[styles.row, borderRadius != null && { borderRadius }, { backgroundColor: contentBackgroundColor ?? theme.surface }]}>
        {children}
        {showDivider ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
      </View>
    );
  }

  const settle = (shouldOpen: boolean): void => {
    setRevealed(shouldOpen);
    open.value = shouldOpen;
    translateX.value = reducedMotion
      ? (shouldOpen ? -DELETE_WIDTH : 0)
      : withSpring(shouldOpen ? -DELETE_WIDTH : 0, forgeMotion.swipeSpring);
  };
  const remove = (): void => {
    mediumHaptic();
    setRevealed(false);
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
    .activeOffsetX([-16, 16])
    .failOffsetY([-16, 16])
    .onUpdate((gesture) => {
      if (!open.value && gesture.translationX >= 0) return;
      const base = open.value ? -DELETE_WIDTH : 0;
      translateX.value = Math.max(-DELETE_WIDTH, Math.min(0, base + gesture.translationX));
    })
    .onEnd((gesture) => {
      const offset = (open.value ? -DELETE_WIDTH : 0) + gesture.translationX;
      const shouldOpen = Math.max(-DELETE_WIDTH, Math.min(0, offset)) < -DELETE_WIDTH * 0.5;
      runOnJS(settle)(shouldOpen);
    });

  return (
    <GestureDetector gesture={swipe}>
      <View style={[styles.row, borderRadius != null && { borderRadius }, { backgroundColor: theme.destructiveSurface }]}>
        <Animated.View
          style={[
            styles.deleteLayer,
            layerStyle,
            { backgroundColor: pressed ? theme.destructiveSurfacePressed : theme.destructiveSurface, pointerEvents: revealed ? 'auto' : 'none' },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={deleteAccessibilityLabel}
            onPress={remove}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            style={styles.deleteAction}
          >
            <Icon name="trash" size={18} color={theme.textDestructive} />
            <Text style={[styles.deleteText, { color: theme.textDestructive }]}>Delete</Text>
          </Pressable>
        </Animated.View>
        <Animated.View style={[contentStyle, { backgroundColor: contentBackgroundColor ?? theme.surface }]}>
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
  deleteText: { ...typeScale.caption },
  divider: { position: 'absolute', left: 16, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
});
