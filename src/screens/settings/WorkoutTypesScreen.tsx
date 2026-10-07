import { ForgePressable as Pressable } from '../../components/ui/ForgePressable';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import {
  AppScreen,
  ForgeText as Text,
  ForgeConfirmationDialog,
  HeaderAction,
  Icon,
  lightHaptic,
  mediumHaptic,
  pressedFeedback,
} from '../../components/ui';
import { usePlans } from '../../state/PlansContext';
import { useSettings } from '../../state/SettingsContext';
import { useActiveWorkout, useWorkouts } from '../../state/WorkoutContext';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';
import type { RootStackParamList, WorkoutTypePreference } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { SettingsRow, SettingsSection, settingsLayout } from './SettingsRow';
import { defaultCustomWorkoutTypeColor } from '../../domain/workouts/workoutTypeDefaults';
import { workoutTypeIcon } from '../../domain/workouts/workoutTypeMetadata';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutTypes'>;
const spring = forgeMotion.swipeSpring;

export function WorkoutTypesScreen({ navigation }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const theme = useForgeTheme();
  const { preferences, updatePreferences } = useSettings();
  const activeWorkout = useActiveWorkout();
  const { completedWorkouts } = useWorkouts();
  const { plans, standaloneRoutines } = usePlans();
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [headerElevated, setHeaderElevated] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{
    type: WorkoutTypePreference;
    hide: boolean;
  } | null>(null);
  const orderedTypes = useMemo(
    () =>
      [...preferences.workoutTypes].sort((left, right) =>
        left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true }),
      ),
    [preferences.workoutTypes],
  );
  const visible = orderedTypes.filter((type) => !type.hidden);
  const hidden = orderedTypes.filter((type) => type.hidden);
  const isReferenced = (type: WorkoutTypePreference) =>
    [activeWorkout, ...completedWorkouts]
      .filter(Boolean)
      .some((workout) => workout?.type === type.name) ||
    [...standaloneRoutines, ...plans.flatMap((plan) => plan.routines)].some(
      (routine) => routine.type === type.name,
    );
  const add = () => {
    lightHaptic();
    navigation.navigate('WorkoutTypeEditor', {
      mode: 'create',
      draftId: `type-${Date.now()}`,
      initialColor: defaultCustomWorkoutTypeColor,
    });
  };
  const remove = (type: WorkoutTypePreference) => {
    const hide = type.source === 'builtIn' || type.hasReferencedData || isReferenced(type);
    setPendingRemoval({ type, hide });
  };
  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <SettingsDetailHeader
          title="Workout types"
          navigation={navigation}
          elevated={headerElevated}
          rightAction={
            <HeaderAction
              accessibilityLabel="Add workout type"
              icon="add"
              iconSize={20}
              iconOnly
              onPress={add}
            />
          }
        />
        <ScrollView
          testID="workout-types-scroll"
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: styles.content.paddingBottom + bottomInset },
          ]}
          showsVerticalScrollIndicator={false}
          directionalLockEnabled
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
        >
          {(['builtIn', 'custom'] as const).map((source) =>
            visible.some((type) => type.source === source) ? (
              <TypeList
                key={source}
                title={source === 'builtIn' ? 'Included' : 'Custom'}
                types={visible.filter((type) => type.source === source)}
                revealedId={revealedId}
                setRevealedId={setRevealedId}
                onOpen={(type) =>
                  navigation.navigate('WorkoutTypeEditor', { workoutTypeId: type.id })
                }
                onRemove={remove}
                isReferenced={isReferenced}
              />
            ) : null,
          )}
          {hidden.length > 0 && (
            <TypeList
              title="Hidden"
              types={hidden}
              revealedId={null}
              setRevealedId={() => undefined}
              onOpen={(type) =>
                navigation.navigate('WorkoutTypeEditor', { workoutTypeId: type.id })
              }
              onRemove={remove}
              isReferenced={isReferenced}
              hidden
            />
          )}
        </ScrollView>
        <ForgeConfirmationDialog
          visible={pendingRemoval !== null}
          title={pendingRemoval?.hide ? 'Hide workout type?' : 'Delete workout type?'}
          message={
            pendingRemoval?.hide
              ? 'It will disappear from new-workout pickers. Existing training keeps its saved type.'
              : 'This cannot be undone.'
          }
          cancelLabel="Cancel"
          confirmLabel={pendingRemoval?.hide ? 'Hide type' : 'Delete type'}
          onCancel={() => {
            setPendingRemoval(null);
            setRevealedId(null);
          }}
          onConfirm={() => {
            if (!pendingRemoval) return;
            const { type, hide } = pendingRemoval;
            lightHaptic();
            updatePreferences({
              workoutTypes: hide
                ? preferences.workoutTypes.map((item) =>
                    item.id === type.id
                      ? {
                          ...item,
                          hidden: true,
                          hasReferencedData: item.hasReferencedData || isReferenced(type),
                        }
                      : item,
                  )
                : preferences.workoutTypes.filter((item) => item.id !== type.id),
            });
            setPendingRemoval(null);
            setRevealedId(null);
          }}
          testID="workout-type-removal-confirmation"
        />
      </View>
    </AppScreen>
  );
}

function TypeList({
  title,
  types,
  revealedId,
  setRevealedId,
  onOpen,
  onRemove,
  isReferenced,
  hidden = false,
}: {
  title?: string;
  types: WorkoutTypePreference[];
  revealedId: string | null;
  setRevealedId: (id: string | null) => void;
  onOpen: (type: WorkoutTypePreference) => void;
  onRemove: (type: WorkoutTypePreference) => void;
  isReferenced: (type: WorkoutTypePreference) => boolean;
  hidden?: boolean;
}) {
  return (
    <SettingsSection title={title}>
      {types.map((type, index) => (
        <React.Fragment key={type.id}>
          <SwipeTypeRow
            type={type}
            hidden={hidden}
            revealed={revealedId === type.id}
            onReveal={(show) => setRevealedId(show ? type.id : null)}
            onOpen={() => onOpen(type)}
            onRemove={() => onRemove(type)}
            actionLabel={
              type.source === 'builtIn' || type.hasReferencedData || isReferenced(type)
                ? 'Hide'
                : 'Delete'
            }
            divider={index < types.length - 1}
          />
        </React.Fragment>
      ))}
    </SettingsSection>
  );
}

function SwipeTypeRow({
  type,
  hidden,
  revealed,
  onReveal,
  onOpen,
  onRemove,
  actionLabel,
  divider,
}: {
  type: WorkoutTypePreference;
  hidden: boolean;
  revealed: boolean;
  onReveal: (show: boolean) => void;
  onOpen: () => void;
  onRemove: () => void;
  actionLabel: 'Hide' | 'Delete';
  divider: boolean;
}) {
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  const width = 72;
  const x = useSharedValue(revealed ? -width : 0);
  const open = useSharedValue(revealed);
  const suppress = useRef(false);
  useEffect(() => {
    open.value = revealed;
    x.value = reducedMotion ? (revealed ? -width : 0) : withSpring(revealed ? -width : 0, spring);
  }, [open, reducedMotion, revealed, x]);
  const settle = (next: boolean, dragged: boolean) => {
    if (dragged) suppress.current = true;
    if (next !== revealed) {
      mediumHaptic();
      onReveal(next);
    } else x.value = reducedMotion ? (next ? -width : 0) : withSpring(next ? -width : 0, spring);
  };
  const pan = Gesture.Pan()
    // Vertical list scrolling must win before a slight diagonal drag can reveal actions.
    .activeOffsetX([-16, 16])
    .failOffsetY([-16, 16])
    .onUpdate((event) => {
      if (!open.value && event.translationX >= 0) return;
      x.value = Math.max(-width, Math.min(0, (open.value ? -width : 0) + event.translationX));
    })
    .onEnd((event) => {
      const next = (open.value ? -width : 0) + event.translationX < -width * 0.55;
      scheduleOnRN(settle, next, Math.abs(event.translationX) > 6);
    });
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const content = (
    <View style={styles.swipe}>
      {type.source !== 'builtIn' && (
        <View
          testID="workout-type-destructive-surface"
          style={[
            styles.actionLayer,
            {
              backgroundColor: theme.destructiveSurface,
              pointerEvents: revealed ? 'auto' : 'none',
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel} ${type.name}`}
            onPress={onRemove}
            style={({ pressed }) => [
              styles.swipeAction,
              pressed && { backgroundColor: theme.destructiveSurfacePressed },
            ]}
          >
            <Icon
              name={actionLabel === 'Hide' ? 'close' : 'trash'}
              size={18}
              color={theme.textDestructive}
            />
            <Text style={[styles.swipeActionText, { color: theme.textDestructive }]}>
              {actionLabel}
            </Text>
          </Pressable>
        </View>
      )}
      <Animated.View style={[styles.rowSurface, { backgroundColor: theme.surface }, animated]}>
        <SettingsRow
          title={type.name}
          accessibilityLabel={`${type.name} workout type`}
          onPress={() => {
            if (suppress.current) {
              suppress.current = false;
              return;
            }
            lightHaptic();
            onOpen();
          }}
          haptic="none"
          leading={
            <Icon
              testID={`workout-type-icon-${type.id}`}
              name={workoutTypeIcon(type)}
              size={26}
              color={type.color}
            />
          }
          trailing={
            <>
              <Icon
                name={type.source === 'builtIn' ? 'verified' : 'note'}
                size={17}
                color={theme.textSecondary}
                accessibilityLabel={
                  type.source === 'builtIn' ? 'Included with Forge' : 'Created by you'
                }
              />
              {hidden ? (
                <Text style={[styles.hidden, { color: theme.textSecondary }]}>Hidden</Text>
              ) : null}
            </>
          }
          disclosure
          showDivider={divider}
        />
      </Animated.View>
    </View>
  );
  return hidden || type.source === 'builtIn' ? (
    content
  ) : (
    <GestureDetector gesture={pan}>{content}</GestureDetector>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    padding: settingsLayout.screenPadding,
    paddingTop: settingsLayout.contentTop,
    paddingBottom: settingsLayout.contentBottom,
    gap: settingsLayout.sectionGap,
  },
  swipe: {
    position: 'relative',
    overflow: 'hidden',
  },
  actionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 72,
  },
  swipeAction: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  swipeActionText: typeScale.caption,
  rowSurface: { zIndex: 1, flex: 1, alignSelf: 'stretch' },
  hidden: typeScale.caption,
});
