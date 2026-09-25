import React, { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import type { IconName } from '../../types';
import { ForgeText as Text } from './ForgeText';
import { Icon } from './Icon';
import { selectionHaptic } from './haptics';
import { pressedFeedback } from './pressFeedback';

/** Window-space rectangle of the trigger the menu should anchor to. */
export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Wires a trigger to an anchored menu: attach `ref` to a `collapsable={false}`
 * View wrapping the trigger, call `open` from the trigger's onPress, and pass
 * `visible`/`anchor`/`close` to <ForgeAnchoredMenu>.
 */
export function useAnchoredMenu() {
  const ref = useRef<View>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const open = () => {
    ref.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  };
  const close = () => setAnchor(null);
  return { ref, anchor, visible: anchor !== null, open, close };
}

const GAP = 8;
const MARGIN = 12;
const MIN_SPACE_BELOW = 220;
// A dropdown shows a handful of rows then scrolls, rather than filling the screen.
const PREFERRED_MAX_HEIGHT = 340;

/**
 * A lightweight dropdown anchored to a measured trigger rect. Hosted in a Modal
 * so it floats above headers, sheets and the dock without being clipped; it
 * drops below the trigger (or above when there isn't room), aligns to the
 * trigger's right edge, and clamps to the screen. Fade + reduced-motion aware.
 */
export function ForgeAnchoredMenu({
  visible,
  anchor,
  onClose,
  children,
  minWidth = 208,
  align = 'end',
  initialScrollOffset,
  testID,
}: {
  visible: boolean;
  anchor: AnchorRect | null;
  onClose: () => void;
  children: React.ReactNode;
  minWidth?: number;
  /** 'end' aligns the menu's right edge to the trigger (compact menus); 'stretch'
   * matches the trigger's full width (settings rows). */
  align?: 'end' | 'stretch';
  /** Opens the menu scrolled to this y offset, e.g. to reveal the current choice. */
  initialScrollOffset?: number;
  testID?: string;
}) {
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  if (!visible || !anchor) return null;

  const anchorBottom = anchor.y + anchor.height;
  const spaceBelow = screenH - anchorBottom - insets.bottom - MARGIN;
  const spaceAbove = anchor.y - insets.top - MARGIN;
  const dropUp = spaceBelow < MIN_SPACE_BELOW && spaceAbove > spaceBelow;
  const available = (dropUp ? spaceAbove : spaceBelow) - GAP;
  const maxHeight = Math.max(120, Math.min(PREFERRED_MAX_HEIGHT, available));
  const vertical = dropUp ? { bottom: screenH - anchor.y + GAP } : { top: anchorBottom + GAP };
  // 'stretch' matches the trigger width (settings rows); 'end' aligns the menu's
  // right edge to the trigger's right edge (compact header/action menus).
  const horizontal = align === 'stretch'
    ? {
        left: Math.max(MARGIN, Math.min(anchor.x, screenW - anchor.width - MARGIN)),
        width: Math.min(anchor.width, screenW - MARGIN * 2),
      }
    : { right: Math.max(MARGIN, screenW - (anchor.x + anchor.width)) };
  const position = { ...vertical, ...horizontal };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss menu"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        testID={testID}
        entering={reducedMotion ? undefined : FadeIn.duration(forgeMotion.state)}
        exiting={reducedMotion ? undefined : FadeOut.duration(forgeMotion.feedback)}
        style={[
          styles.menu,
          position,
          {
            minWidth,
            maxWidth: screenW - MARGIN * 2,
            maxHeight,
            backgroundColor: theme.surfaceElevated,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentOffset={initialScrollOffset ? { x: 0, y: initialScrollOffset } : undefined}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

export interface AnchoredMenuActionItem {
  label: string;
  icon: IconName;
  onPress: () => void;
  tone?: 'neutral' | 'destructive';
  disabled?: boolean;
  accessibilityLabel?: string;
}

/** Renders a short action list inside <ForgeAnchoredMenu>, closing on select. */
export function AnchoredMenuActions({
  actions,
  onClose,
}: {
  actions: readonly AnchoredMenuActionItem[];
  onClose: () => void;
}) {
  const theme = useForgeTheme();
  return (
    <View>
      {actions.map((action, index) => {
        const destructive = action.tone === 'destructive';
        const color = action.disabled
          ? theme.textDisabled
          : destructive
            ? theme.textDestructive
            : theme.textPrimary;
        return (
          <React.Fragment key={action.label}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              accessibilityState={{ disabled: action.disabled }}
              disabled={action.disabled}
              onPress={() => {
                selectionHaptic();
                onClose();
                action.onPress();
              }}
              style={({ pressed }) => [styles.action, pressed && !action.disabled && [styles.pressed, { backgroundColor: theme.pressed }]]}
            >
              <Icon name={action.icon} size={19} color={color} />
              <Text style={[styles.actionLabel, { color }]}>{action.label}</Text>
            </Pressable>
            {index < actions.length - 1 ? <View style={[styles.divider, { backgroundColor: theme.divider }]} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  action: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 11 },
  actionLabel: { ...typeScale.controlLabel },
  pressed: {},
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 46 },
});
