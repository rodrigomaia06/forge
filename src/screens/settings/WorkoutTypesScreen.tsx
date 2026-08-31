import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  AppScreen,
  ForgeCard,
  ForgeText as Text,
  HeaderCircleAction,
  Icon,
  lightHaptic,
  mediumHaptic,
  pressedFeedback,
  selectionHaptic,
} from '../../components/ui';
import { usePlans } from '../../state/PlansContext';
import { useSettings } from '../../state/SettingsContext';
import { useWorkouts } from '../../state/WorkoutContext';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import type { RootStackParamList, WorkoutTypePreference } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutTypes'>;
const colors = ['#7C8CF8', '#6BD48F', '#F27D7D', '#F4A261', '#B78AF0', '#9CA3AF'];
const spring = { damping: 22, stiffness: 280, mass: 0.65, overshootClamping: true };

export function WorkoutTypesScreen({ navigation }: Props) {
  const theme = useForgeTheme();
  const { preferences, updatePreferences } = useSettings();
  const { activeWorkout, completedWorkouts } = useWorkouts();
  const { plans, standaloneRoutines } = usePlans();
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const visible = useMemo(
    () => preferences.workoutTypes.filter((type) => !type.hidden),
    [preferences.workoutTypes],
  );
  const hidden = useMemo(
    () => preferences.workoutTypes.filter((type) => type.hidden),
    [preferences.workoutTypes],
  );
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
      initialColor: colors[preferences.workoutTypes.length % colors.length],
    });
  };
  const remove = (type: WorkoutTypePreference) => {
    const hide = type.source === 'builtIn' || type.hasReferencedData || isReferenced(type);
    Alert.alert(
      hide ? 'Hide workout type?' : 'Delete workout type?',
      hide
        ? 'It will disappear from new-workout pickers. Existing training keeps its saved type.'
        : 'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setRevealedId(null) },
        {
          text: hide ? 'Hide' : 'Delete',
          style: 'destructive',
          onPress: () => {
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
            setRevealedId(null);
          },
        },
      ],
    );
  };
  const toggleBuiltInVisibility = (type: WorkoutTypePreference) => {
    selectionHaptic();
    updatePreferences({
      workoutTypes: preferences.workoutTypes.map((item) =>
        item.id === type.id ? { ...item, hidden: !item.hidden } : item,
      ),
    });
  };
  return (
    <AppScreen backgroundColor={theme.background}>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <SettingsDetailHeader
          title="Workout types"
          navigation={navigation}
          rightAction={
            <HeaderCircleAction
              accessibilityLabel="Add workout type"
              icon="add"
              iconSize={20}
              onPress={add}
            />
          }
        />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TypeList
            types={visible}
            revealedId={revealedId}
            setRevealedId={setRevealedId}
            onOpen={(type) => navigation.navigate('WorkoutTypeEditor', { workoutTypeId: type.id })}
            onRemove={remove}
            onToggleVisibility={toggleBuiltInVisibility}
            isReferenced={isReferenced}
          />
          {hidden.length > 0 && (
            <View style={styles.hiddenSection}>
              <Text style={styles.sectionTitle}>Hidden</Text>
              <TypeList
                types={hidden}
                revealedId={null}
                setRevealedId={() => undefined}
                onOpen={(type) =>
                  navigation.navigate('WorkoutTypeEditor', { workoutTypeId: type.id })
                }
                onRemove={remove}
                onToggleVisibility={toggleBuiltInVisibility}
                isReferenced={isReferenced}
                hidden
              />
            </View>
          )}
        </ScrollView>
      </View>
    </AppScreen>
  );
}

function TypeList({
  types,
  revealedId,
  setRevealedId,
  onOpen,
  onRemove,
  onToggleVisibility,
  isReferenced,
  hidden = false,
}: {
  types: WorkoutTypePreference[];
  revealedId: string | null;
  setRevealedId: (id: string | null) => void;
  onOpen: (type: WorkoutTypePreference) => void;
  onRemove: (type: WorkoutTypePreference) => void;
  onToggleVisibility: (type: WorkoutTypePreference) => void;
  isReferenced: (type: WorkoutTypePreference) => boolean;
  hidden?: boolean;
}) {
  return (
    <ForgeCard style={styles.card}>
      {types.map((type) => (
        <React.Fragment key={type.id}>
          <SwipeTypeRow
            type={type}
            hidden={hidden}
            revealed={revealedId === type.id}
            onReveal={(show) => setRevealedId(show ? type.id : null)}
            onOpen={() => onOpen(type)}
            onRemove={() => onRemove(type)}
            onToggleVisibility={() => onToggleVisibility(type)}
            actionLabel={
              type.source === 'builtIn' || type.hasReferencedData || isReferenced(type)
                ? 'Hide'
                : 'Delete'
            }
          />
        </React.Fragment>
      ))}
    </ForgeCard>
  );
}

function SwipeTypeRow({
  type,
  hidden,
  revealed,
  onReveal,
  onOpen,
  onRemove,
  onToggleVisibility,
  actionLabel,
}: {
  type: WorkoutTypePreference;
  hidden: boolean;
  revealed: boolean;
  onReveal: (show: boolean) => void;
  onOpen: () => void;
  onRemove: () => void;
  onToggleVisibility: () => void;
  actionLabel: 'Hide' | 'Delete';
}) {
  const theme = useForgeTheme();
  const width = 72;
  const x = useSharedValue(revealed ? -width : 0);
  const open = useSharedValue(revealed);
  const suppress = useRef(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    open.value = revealed;
    x.value = withSpring(revealed ? -width : 0, spring);
  }, [open, revealed, x]);
  const settle = (next: boolean, dragged: boolean) => {
    if (dragged) suppress.current = true;
    if (next !== revealed) {
      mediumHaptic();
      onReveal(next);
    } else x.value = withSpring(next ? -width : 0, spring);
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      if (!open.value && event.translationX >= 0) return;
      x.value = Math.max(-width, Math.min(0, (open.value ? -width : 0) + event.translationX));
    })
    .onEnd((event) => {
      const next = (open.value ? -width : 0) + event.translationX < -width * 0.55;
      runOnJS(settle)(next, Math.abs(event.translationX) > 6);
    });
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const content = (
    <View style={[styles.swipe, { backgroundColor: type.source === 'builtIn' ? theme.surfaceElevated : theme.overlay }]}>
      {type.source !== 'builtIn' && <View
        pointerEvents={revealed ? 'auto' : 'none'}
        style={[styles.actionLayer, { backgroundColor: theme.overlay }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel} ${type.name}`}
          onPress={onRemove}
          style={({ pressed }) => [styles.swipeAction, pressed && styles.swipeActionPressed]}
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
      </View>}
      <Animated.View
        style={[styles.rowSurface, { backgroundColor: theme.surfaceElevated }, animated]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${type.name} workout type`}
          onPress={() => {
            if (suppress.current) {
              suppress.current = false;
              return;
            }
            if (type.source === 'builtIn') {
              selectionHaptic();
              setExpanded((value) => !value);
            } else {
              lightHaptic();
              onOpen();
            }
          }}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.pressed }]}
        >
          <View style={[styles.swatch, { backgroundColor: type.color }]} />
          <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
            {type.name}
          </Text>
          <Icon
            name={type.source === 'builtIn' ? 'verified' : 'note'}
            size={17}
            color={theme.textSecondary}
            accessibilityLabel={
              type.source === 'builtIn' ? 'Included with Forge' : 'Created by you'
            }
          />
          {hidden && <Text style={[styles.hidden, { color: theme.textSecondary }]}>Hidden</Text>}
          <Icon name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>
      </Animated.View>
      {type.source === 'builtIn' && expanded && (
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={`${hidden ? 'Show' : 'Hide'} ${type.name} in workout pickers`}
          accessibilityState={{ checked: !hidden }}
          onPress={onToggleVisibility}
          style={({ pressed }) => [
            styles.builtInControl,
            pressed && { backgroundColor: theme.pressed },
          ]}
        >
          <Text style={[styles.builtInText, { color: theme.textPrimary }]}>
            {hidden ? 'Show in workout pickers' : 'Hide from workout pickers'}
          </Text>
          <View
            style={[styles.switch, { backgroundColor: !hidden ? theme.marker : theme.divider }]}
          >
            <View
              style={[
                styles.switchThumb,
                { backgroundColor: theme.surfaceElevated },
                !hidden && styles.switchThumbOn,
              ]}
            />
          </View>
        </Pressable>
      )}
    </View>
  );
  return hidden || type.source === 'builtIn' ? (
    content
  ) : (
    <GestureDetector gesture={pan}>{content}</GestureDetector>
  );
}

const card = {
  overflow: 'hidden',
  borderRadius: dashboardTheme.cardRadius,
  borderWidth: 1,
  backgroundColor: dashboardTheme.surface,
  shadowColor: '#17191C',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingTop: 20, paddingBottom: 40, gap: 22 },
  card,
  hiddenSection: { gap: 8 },
  sectionTitle: { ...typeScale.sectionTitle, color: dashboardTheme.slate },
  swipe: { position: 'relative', overflow: 'hidden', backgroundColor: '#F6DCDD' },
  actionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 72,
    backgroundColor: '#F6DCDD',
  },
  swipeAction: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  swipeActionPressed: { backgroundColor: '#F1CED0' },
  swipeActionText: { color: '#D64848', ...typeScale.caption },
  rowSurface: { zIndex: 1, backgroundColor: dashboardTheme.surface },
  row: {
    minHeight: 54,
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  swatch: { width: 13, height: 13, borderRadius: 7 },
  name: { flex: 1, minWidth: 0, color: dashboardTheme.ink, ...typeScale.cardTitle },
  hidden: { color: dashboardTheme.slate, ...typeScale.caption },
  builtInControl: {
    minHeight: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: dashboardTheme.divider,
  },
  builtInText: { flex: 1, ...typeScale.body },
  switch: { width: 42, height: 26, padding: 3, borderRadius: 13 },
  switchThumb: { width: 20, height: 20, borderRadius: 10 },
  switchThumbOn: { alignSelf: 'flex-end' },
});
