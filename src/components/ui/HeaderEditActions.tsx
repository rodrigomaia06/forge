import { ForgePressable as Pressable } from './ForgePressable';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { HeaderAction } from './HeaderAction';
import { HeaderActionGroup, joinedHeaderAction } from './HeaderActionGroup';
import { Icon } from './Icon';
import { pressedFeedback } from './pressFeedback';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useForgeReducedMotion } from '../../theme/motion';

interface HeaderEditActionsProps {
  editing: boolean;
  onToggleEdit: () => void;
  onAdd: () => void;
  editLabel: string;
  doneLabel: string;
  addLabel: string;
  /** Wrap the add button so an anchored menu can measure it as its anchor. */
  addRef?: React.Ref<View>;
  testID?: string;
}

/**
 * The morphing edit/add control that lives at a tab header's top-right. Both
 * states share one fixed pill slot and are absolutely stacked, so toggling
 * crossfades in place rather than sliding two pills apart. While editing the
 * whole pill becomes a single Done control with the same footprint, so there is
 * no add button to tap by mistake. Shared by the Dashboard and Plans headers.
 */
export function HeaderEditActions({
  editing,
  onToggleEdit,
  onAdd,
  editLabel,
  doneLabel,
  addLabel,
  addRef,
  testID,
}: HeaderEditActionsProps) {
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  const enter = reducedMotion ? undefined : FadeIn.duration(180);
  const exit = reducedMotion ? undefined : FadeOut.duration(140);
  const isDark = theme.colorScheme === 'dark';

  const addAction = (
    <HeaderAction
      accessibilityLabel={addLabel}
      icon="add"
      iconSize={22}
      iconOnly
      variant="ghost"
      style={joinedHeaderAction}
      onPress={onAdd}
    />
  );

  return (
    <View style={styles.morphSlot}>
      {editing ? (
        <Animated.View key="done" entering={enter} exiting={exit} style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={doneLabel}
            onPress={onToggleEdit}
            style={({ pressed }) => [
              styles.donePill,
              {
                backgroundColor: isDark ? theme.surfaceMuted : theme.surface,
                borderColor: theme.border,
                borderWidth: 0,
              },
              pressed && pressedFeedback,
            ]}
          >
            <Icon name="check" size={22} color={theme.ink} weight="bold" />
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View key="group" entering={enter} exiting={exit} style={StyleSheet.absoluteFill}>
          <HeaderActionGroup testID={testID}>
            <HeaderAction
              accessibilityLabel={editLabel}
              icon="note"
              iconSize={20}
              iconOnly
              variant="ghost"
              style={joinedHeaderAction}
              onPress={onToggleEdit}
            />
            {addRef ? (
              <View ref={addRef} collapsable={false}>
                {addAction}
              </View>
            ) : (
              addAction
            )}
          </HeaderActionGroup>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fixed pill footprint (the joined edit+add group width) that both states
  // stack inside, so the swap crossfades in place instead of resizing.
  morphSlot: { width: 90, height: 44 },
  donePill: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
