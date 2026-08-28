import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Button, ForgeText as Text, ForgeTextInput as TextInput, Icon } from '../../components/ui';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { typeScale } from '../../theme/tokens';
import { exerciseCatalog, type ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { CompletionCheck } from './CompletionCheck';
import { animateLayout, lightHaptic, mediumHaptic, selectionHaptic } from './activeWorkoutFeedback';
import { styles as activeWorkoutStyles } from './activeWorkoutStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WorkoutExercise } from '../../types';

export function AddExerciseSheet({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (names: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedEquipment, setExpandedEquipment] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(520);
  const backdropOpacity = useSharedValue(0);
  const closing = useSharedValue(false);
  const dragStartOffset = useSharedValue(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const finishClose = useCallback(() => onCloseRef.current(), []);
  const closeSheet = useCallback((): void => {
    if (closing.value) return;
    closing.value = true;
    lightHaptic();
    Keyboard.dismiss();
    translateY.value = withTiming(520, { duration: 200 }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
    backdropOpacity.value = withTiming(0, { duration: 160 });
  }, [backdropOpacity, closing, finishClose, translateY]);

  useEffect(() => {
    if (!visible) return undefined;
    closing.value = false;
    translateY.value = 520;
    backdropOpacity.value = 0;
    const frame = requestAnimationFrame(() => {
      translateY.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 });
      backdropOpacity.value = withTiming(1, { duration: 180 });
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, translateY, backdropOpacity, closing]);

  const sheetGesture = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .failOffsetX([-24, 24])
    .onStart(() => {
      dragStartOffset.value = translateY.value;
    })
    .onUpdate((event) => {
      translateY.value = Math.max(0, dragStartOffset.value + event.translationY);
    })
    .onEnd((event) => {
      const projectedOffset = Math.max(
        0,
        dragStartOffset.value + event.translationY + event.velocityY * 0.12,
      );
      if (projectedOffset >= 260 || event.velocityY > 900) {
        closing.value = true;
        translateY.value = withTiming(520, { duration: 200 }, (finished) => {
          if (finished) runOnJS(finishClose)();
        });
        backdropOpacity.value = withTiming(0, { duration: 160 });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropAnimatedStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!visible) return null;

  const filteredExercises = exerciseCatalog.filter((exercise) => {
    if (categoryFilter && exercise.category !== categoryFilter) return false;
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return [exercise.name, exercise.equipment, exercise.category, ...exercise.aliases]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const categories = [...new Set(filteredExercises.map((exercise) => exercise.category))];
  const groupedExercises = categories.map((category) => ({
    category,
    groups: [
      ...new Set(
        filteredExercises
          .filter((exercise) => exercise.category === category)
          .map((exercise) => exercise.group),
      ),
    ],
  }));
  const activeFilterCount = categoryFilter ? 1 : 0;
  const toggleExercise = (exercise: ExerciseCatalogItem): void => {
    lightHaptic();
    setSelected((current) =>
      current.includes(exercise.id)
        ? current.filter((id) => id !== exercise.id)
        : [...current, exercise.id],
    );
  };
  const resetAndClose = (): void => {
    Keyboard.dismiss();
    setQuery('');
    setSelected([]);
    setFiltersOpen(false);
    setCategoryFilter(null);
    setExpandedGroup(null);
    setExpandedEquipment(null);
    closeSheet();
  };
  const submit = (): void => {
    const names = exerciseCatalog
      .filter((exercise) => selected.includes(exercise.id))
      .map((exercise) => exercise.name);
    if (!names.length) return;
    Keyboard.dismiss();
    setQuery('');
    setSelected([]);
    setFiltersOpen(false);
    setCategoryFilter(null);
    setExpandedGroup(null);
    setExpandedEquipment(null);
    mediumHaptic();
    onSubmit(names);
  };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={resetAndClose}>
      <Animated.View style={[styles.pickerBackdrop, backdropAnimatedStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close add exercises"
          onPress={resetAndClose}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          style={styles.pickerKeyboardArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[styles.pickerSheet, sheetAnimatedStyle]}>
            <GestureDetector gesture={sheetGesture}>
              <View style={styles.pickerDragArea}>
                <View style={styles.sheetHandle} />
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Add exercises</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close add exercises"
                    onPress={resetAndClose}
                    style={({ pressed }) => [
                      activeWorkoutStyles.restCloseButton,
                      pressed && activeWorkoutStyles.restClosePressed,
                    ]}
                  >
                    <Icon name="close" size={20} color={dashboardTheme.slate} />
                  </Pressable>
                </View>
              </View>
            </GestureDetector>
            <View style={styles.searchRow}>
              <View style={styles.searchField}>
                <Icon name="search" size={22} color={dashboardTheme.slate} />
                <TextInput
                  accessibilityLabel="Search exercises"
                  placeholder="Search exercises"
                  placeholderTextColor={dashboardTheme.muted}
                  value={query}
                  onChangeText={setQuery}
                  style={styles.searchInput}
                  returnKeyType="search"
                />
                {!!query && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear exercise search"
                    onPress={() => setQuery('')}
                    style={({ pressed }) => [
                      styles.searchClear,
                      pressed && styles.searchClearPressed,
                    ]}
                  >
                    <Icon name="close" size={16} color={dashboardTheme.slate} />
                  </Pressable>
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Filters${activeFilterCount ? `, ${activeFilterCount} active` : ''}`}
                onPress={() => {
                  selectionHaptic();
                  animateLayout();
                  setFiltersOpen((current) => !current);
                }}
                style={({ pressed }) => [
                  styles.filterButton,
                  pressed && styles.filterButtonPressed,
                ]}
              >
                <Icon name="filter" size={17} color={dashboardTheme.ink} />
                <Text style={styles.filterText}>Filters</Text>
                {activeFilterCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>
            {filtersOpen && (
              <View style={styles.filterPanel}>
                <Text style={styles.filterPanelTitle}>Category</Text>
                <View style={styles.filterChoices}>
                  {['All', ...new Set(exerciseCatalog.map((exercise) => exercise.category))].map(
                    (category) => {
                      const active = category === (categoryFilter || 'All');
                      return (
                        <Pressable
                          key={category}
                          accessibilityRole="button"
                          accessibilityLabel={`Filter ${category}`}
                          onPress={() => {
                            selectionHaptic();
                            setCategoryFilter(category === 'All' ? null : category);
                          }}
                          style={[styles.filterChoice, active && styles.filterChoiceActive]}
                        >
                          <Text
                            style={[
                              styles.filterChoiceText,
                              active && styles.filterChoiceTextActive,
                            ]}
                          >
                            {category}
                          </Text>
                        </Pressable>
                      );
                    },
                  )}
                </View>
              </View>
            )}
            <ScrollView
              style={styles.pickerList}
              contentContainerStyle={[
                styles.pickerListContent,
                { paddingBottom: 108 + insets.bottom },
              ]}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={Keyboard.dismiss}
              onTouchStart={Keyboard.dismiss}
              showsVerticalScrollIndicator={false}
            >
              {groupedExercises.map(({ category, groups }) => (
                <View key={category}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  <View style={styles.categoryCard}>
                    {groups.map((group, groupIndex) => {
                      const variations = filteredExercises.filter(
                        (exercise) => exercise.category === category && exercise.group === group,
                      );
                      const selectedCount = variations.filter((exercise) =>
                        selected.includes(exercise.id),
                      ).length;
                      const expanded = expandedGroup === `${category}-${group}`;
                      const equipmentGroups = [
                        ...new Set(variations.map((exercise) => exercise.equipment)),
                      ].map((equipment) => ({
                        equipment,
                        exercises: variations.filter(
                          (exercise) => exercise.equipment === equipment,
                        ),
                      }));
                      if (variations.length === 1) {
                        const exercise = variations[0];
                        const isSelected = selected.includes(exercise.id);
                        return (
                          <Pressable
                            key={group}
                            accessibilityRole="checkbox"
                            accessibilityLabel={`${group}, variation`}
                            accessibilityState={{ checked: isSelected }}
                            onPress={() => toggleExercise(exercise)}
                            style={({ pressed }) => [
                              styles.groupRow,
                              styles.singleGroupRow,
                              groupIndex > 0 && styles.groupRowDivider,
                              isSelected && styles.singleGroupRowSelected,
                              pressed && styles.groupRowPressed,
                            ]}
                          >
                            <View style={styles.exerciseOptionCopy}>
                              <Text style={styles.groupName}>{group}</Text>
                            </View>
                            <CompletionCheck
                              selected={isSelected}
                              testID={`exercise-selection-${exercise.id}`}
                            />
                          </Pressable>
                        );
                      }

                      return (
                        <View key={group} style={styles.exerciseGroup}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${group}, ${variations.length} variations`}
                            onPress={() => {
                              selectionHaptic();
                              animateLayout();
                              setExpandedGroup(expanded ? null : `${category}-${group}`);
                              setExpandedEquipment(null);
                            }}
                            style={({ pressed }) => [
                              styles.groupRow,
                              groupIndex > 0 && styles.groupRowDivider,
                              pressed && styles.groupRowPressed,
                            ]}
                          >
                            <View style={styles.exerciseOptionCopy}>
                              <Text style={styles.groupName}>{group}</Text>
                              <Text style={styles.groupMeta}>{variations.length} variations</Text>
                            </View>
                            <View style={styles.groupActions}>
                              <View
                                style={[
                                  styles.groupCount,
                                  selectedCount > 0 && styles.groupCountActive,
                                ]}
                              >
                                <AnimatedCount count={selectedCount} />
                              </View>
                              <AnimatedChevron expanded={expanded} />
                            </View>
                          </Pressable>
                          {expanded &&
                            equipmentGroups.map(({ equipment, exercises }) => {
                              const equipmentSelectedCount = exercises.filter((exercise) =>
                                selected.includes(exercise.id),
                              ).length;
                              const hasSubVariations = exercises.length > 1;
                              const equipmentKey = `${category}-${group}-${equipment}`;
                              const equipmentExpanded = expandedEquipment === equipmentKey;

                              if (!hasSubVariations) {
                                const exercise = exercises[0];
                                const isSelected = selected.includes(exercise.id);
                                return (
                                  <Pressable
                                    key={equipment}
                                    accessibilityRole="checkbox"
                                    accessibilityLabel={`${group}, ${equipment}`}
                                    accessibilityState={{ checked: isSelected }}
                                    onPress={() => toggleExercise(exercise)}
                                    style={({ pressed }) => [
                                      styles.equipmentRow,
                                      isSelected && styles.equipmentRowSelected,
                                      pressed && styles.exerciseOptionPressed,
                                    ]}
                                  >
                                    <Text style={styles.equipmentName}>{equipment}</Text>
                                    <CompletionCheck
                                      selected={isSelected}
                                      testID={`exercise-selection-${exercise.id}`}
                                    />
                                  </Pressable>
                                );
                              }

                              return (
                                <View key={equipment} style={styles.equipmentGroup}>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`${equipment}, ${exercises.length} variations`}
                                    onPress={() => {
                                      selectionHaptic();
                                      animateLayout();
                                      setExpandedEquipment(equipmentExpanded ? null : equipmentKey);
                                    }}
                                    style={({ pressed }) => [
                                      styles.equipmentRow,
                                      pressed && styles.exerciseOptionPressed,
                                    ]}
                                  >
                                    <View style={styles.exerciseOptionCopy}>
                                      <Text style={styles.equipmentName}>{equipment}</Text>
                                      <Text style={styles.equipmentMeta}>
                                        {exercises.length} variations
                                      </Text>
                                    </View>
                                    <View style={styles.groupActions}>
                                      <View
                                        style={[
                                          styles.groupCount,
                                          equipmentSelectedCount > 0 && styles.groupCountActive,
                                        ]}
                                      >
                                        <AnimatedCount count={equipmentSelectedCount} />
                                      </View>
                                      <AnimatedChevron expanded={equipmentExpanded} />
                                    </View>
                                  </Pressable>
                                  {equipmentExpanded &&
                                    exercises.map((exercise) => {
                                      const isSelected = selected.includes(exercise.id);
                                      const label = exercise.variation || exercise.name;
                                      return (
                                        <Pressable
                                          key={exercise.id}
                                          accessibilityRole="checkbox"
                                          accessibilityLabel={`${group}, ${equipment}, ${label}`}
                                          accessibilityState={{ checked: isSelected }}
                                          onPress={() => toggleExercise(exercise)}
                                          style={({ pressed }) => [
                                            styles.subVariationRow,
                                            isSelected && styles.subVariationRowSelected,
                                            pressed && styles.exerciseOptionPressed,
                                          ]}
                                        >
                                          <Text style={styles.variationName}>{label}</Text>
                                          <CompletionCheck
                                            selected={isSelected}
                                            testID={`exercise-selection-${exercise.id}`}
                                          />
                                        </Pressable>
                                      );
                                    })}
                                </View>
                              );
                            })}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
              {!filteredExercises.length && (
                <Text style={styles.emptySearch}>No exercises found</Text>
              )}
            </ScrollView>
            <View pointerEvents="none" style={styles.pickerCtaFade}>
              <Svg style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="pickerCtaFade" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={dashboardTheme.surface} stopOpacity="0" />
                    <Stop offset="0.38" stopColor={dashboardTheme.surface} stopOpacity="0.48" />
                    <Stop offset="0.72" stopColor={dashboardTheme.surface} stopOpacity="0.9" />
                    <Stop offset="1" stopColor={dashboardTheme.surface} stopOpacity="1" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#pickerCtaFade)" />
              </Svg>
            </View>
            <Animated.View
              style={[
                styles.pickerCtaDock,
                { bottom: 0, paddingBottom: Math.max(8, insets.bottom - 4) },
              ]}
            >
              <Button
                label={`Add exercises${selected.length ? ` (${selected.length})` : ''}`}
                accessibilityLabel="Confirm selected exercises"
                disabled={!selected.length}
                onPress={submit}
                theme={dashboardTheme}
                style={[styles.pickerSubmit, !selected.length && styles.pickerSubmitDisabled]}
              />
            </Animated.View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

function AnimatedChevron({ expanded }: { expanded: boolean }) {
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, { duration: 140 });
  }, [expanded, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 90}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Icon name="chevron-forward" size={18} color={dashboardTheme.slate} />
    </Animated.View>
  );
}

function AnimatedCount({ count }: { count: number }) {
  const progress = useSharedValue(1);

  useEffect(() => {
    progress.value = 0.8;
    progress.value = withSpring(1, { damping: 16, stiffness: 300 });
  }, [count, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: progress.value }],
  }));

  return (
    <Animated.Text
      style={[styles.groupCountText, count > 0 && styles.groupCountTextActive, animatedStyle]}
    >
      {count}
    </Animated.Text>
  );
}

export function ExerciseOptionsSheet({
  visible,
  exercise,
  onClose,
  onRemove,
}: {
  visible: boolean;
  exercise: WorkoutExercise;
  onClose: () => void;
  onRemove: () => void;
}) {
  const translateY = useSharedValue(420);
  const backdropOpacity = useSharedValue(0);
  const closing = useSharedValue(false);
  const dragStartOffset = useSharedValue(0);

  const finishClose = useCallback(() => onClose(), [onClose]);
  const closeSheet = useCallback(() => {
    if (closing.value) return;
    closing.value = true;
    translateY.value = withTiming(520, { duration: 200 }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
    backdropOpacity.value = withTiming(0, { duration: 160 });
  }, [backdropOpacity, closing, finishClose, translateY]);

  useEffect(() => {
    if (!visible) return undefined;
    closing.value = false;
    translateY.value = 420;
    backdropOpacity.value = 0;
    const frame = requestAnimationFrame(() => {
      translateY.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 });
      backdropOpacity.value = withTiming(1, { duration: 180 });
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, translateY, backdropOpacity]);

  const sheetGesture = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .failOffsetX([-24, 24])
    .onStart(() => {
      dragStartOffset.value = translateY.value;
    })
    .onUpdate((event) => {
      translateY.value = Math.max(0, dragStartOffset.value + event.translationY);
    })
    .onEnd((event) => {
      const projectedOffset = Math.max(
        0,
        dragStartOffset.value + event.translationY + event.velocityY * 0.12,
      );
      if (projectedOffset >= 260 || event.velocityY > 900) {
        closing.value = true;
        translateY.value = withTiming(520, { duration: 200 }, (finished) => {
          if (finished) runOnJS(finishClose)();
        });
        backdropOpacity.value = withTiming(0, { duration: 160 });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropAnimatedStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={closeSheet}>
      <Animated.View style={[styles.optionsBackdrop, backdropAnimatedStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close options"
          onPress={closeSheet}
          style={StyleSheet.absoluteFill}
        />
        <GestureDetector gesture={sheetGesture}>
          <Animated.View style={[styles.optionsSheet, sheetAnimatedStyle]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Options</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close options"
                onPress={closeSheet}
                style={({ pressed }) => [styles.sheetClose, pressed && styles.sheetClosePressed]}
              >
                <Icon name="close" size={24} color={dashboardTheme.slate} />
              </Pressable>
            </View>
            <View style={styles.optionList}>
              <OptionRow icon="measure" label="Measure by" onPress={closeSheet} showArrow />
              <OptionRow icon="note" label="Add note" onPress={closeSheet} />
              <OptionRow icon="history" label="Previous sessions" onPress={closeSheet} />
              <OptionRow icon="warm-up" label="Warm-up sets" onPress={closeSheet} />
              <OptionRow icon="info" label="Exercise info" onPress={closeSheet} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${exercise.name}`}
              onPress={onRemove}
              style={({ pressed }) => [
                styles.destructiveAction,
                pressed && styles.destructivePressed,
              ]}
            >
              <Icon name="trash" size={22} color="#FF3B30" />
              <Text style={styles.destructiveText}>Remove exercise</Text>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </Modal>
  );
}

export function WorkoutOptionsSheet({
  visible,
  workoutName,
  onClose,
  onDelete,
  onEdit,
}: {
  visible: boolean;
  workoutName: string;
  onClose: () => void;
  onDelete: () => void;
  onEdit?: () => void;
}) {
  const translateY = useSharedValue(320);
  const backdropOpacity = useSharedValue(0);
  const closing = useSharedValue(false);
  const dragStartOffset = useSharedValue(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const finishClose = useCallback(() => onCloseRef.current(), []);
  const closeSheet = useCallback(() => {
    if (closing.value) return;
    closing.value = true;
    lightHaptic();
    translateY.value = withTiming(320, { duration: 200 }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
    backdropOpacity.value = withTiming(0, { duration: 160 });
  }, [backdropOpacity, closing, finishClose, translateY]);

  useEffect(() => {
    if (!visible) return undefined;
    closing.value = false;
    translateY.value = 320;
    backdropOpacity.value = 0;
    const frame = requestAnimationFrame(() => {
      translateY.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 });
      backdropOpacity.value = withTiming(1, { duration: 180 });
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, translateY, backdropOpacity, closing]);

  const sheetGesture = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .failOffsetX([-24, 24])
    .onStart(() => {
      dragStartOffset.value = translateY.value;
    })
    .onUpdate((event) => {
      translateY.value = Math.max(0, dragStartOffset.value + event.translationY);
    })
    .onEnd((event) => {
      const projectedOffset = Math.max(
        0,
        dragStartOffset.value + event.translationY + event.velocityY * 0.12,
      );
      if (projectedOffset >= 160 || event.velocityY > 900) {
        closing.value = true;
        translateY.value = withTiming(320, { duration: 200 }, (finished) => {
          if (finished) runOnJS(finishClose)();
        });
        backdropOpacity.value = withTiming(0, { duration: 160 });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 });
      }
    });
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropAnimatedStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={closeSheet}>
      <Animated.View style={[styles.optionsBackdrop, backdropAnimatedStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close workout options"
          onPress={closeSheet}
          style={StyleSheet.absoluteFill}
        />
        <GestureDetector gesture={sheetGesture}>
          <Animated.View style={[styles.optionsSheet, sheetAnimatedStyle]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Workout options</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close workout options"
                onPress={closeSheet}
                style={({ pressed }) => [styles.sheetClose, pressed && styles.sheetClosePressed]}
              >
                <Icon name="close" size={24} color={dashboardTheme.slate} />
              </Pressable>
            </View>
            {onEdit && <OptionRow icon="note" label="Edit workout" onPress={onEdit} />}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${workoutName}`}
              onPress={onDelete}
              style={({ pressed }) => [
                styles.destructiveAction,
                pressed && styles.destructivePressed,
              ]}
            >
              <Icon name="trash" size={22} color="#FF3B30" />
              <Text style={styles.destructiveText}>Delete workout</Text>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </Modal>
  );
}

function OptionRow({
  icon,
  label,
  onPress,
  showArrow = false,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
  showArrow?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
    >
      <Icon name={icon} size={23} color={dashboardTheme.ink} />
      <Text style={styles.optionLabel}>{label}</Text>
      {showArrow && <Icon name="arrow-forward" size={19} color={dashboardTheme.slate} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pickerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(23,25,28,0.20)',
  },
  pickerKeyboardArea: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  pickerSheet: {
    width: '100%',
    height: '92%',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: dashboardTheme.surface,
    position: 'relative',
  },
  pickerHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerDragArea: { marginHorizontal: -20, paddingHorizontal: 20 },
  pickerTitle: { color: dashboardTheme.ink, ...typeScale.sectionTitle },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchField: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: dashboardTheme.surfaceMuted,
  },
  searchClear: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(85,88,92,0.10)',
  },
  searchClearPressed: { opacity: 0.65 },
  filterButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: 12,
    backgroundColor: dashboardTheme.surfaceMuted,
  },
  filterButtonPressed: { opacity: 0.7 },
  filterText: { color: dashboardTheme.ink, ...typeScale.label },
  filterBadge: {
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#6678F0',
  },
  filterBadgeText: { color: dashboardTheme.surface, ...typeScale.caption },
  filterPanel: {
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: dashboardTheme.surfaceMuted,
  },
  filterPanelTitle: { marginBottom: 8, color: dashboardTheme.slate, ...typeScale.label },
  filterChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterChoice: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: dashboardTheme.surface,
  },
  filterChoiceActive: { backgroundColor: '#6678F0' },
  filterChoiceText: { color: dashboardTheme.slate, ...typeScale.label },
  filterChoiceTextActive: { color: dashboardTheme.surface },
  searchInput: {
    flex: 1,
    minHeight: 40,
    paddingVertical: 0,
    color: dashboardTheme.ink,
    ...typeScale.label,
  },
  pickerList: { flex: 1, marginTop: 10 },
  pickerListContent: { paddingBottom: 22 },
  categoryTitle: {
    marginTop: 14,
    marginBottom: 7,
    color: dashboardTheme.slate,
    ...typeScale.cardTitle,
  },
  categoryCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: dashboardTheme.divider,
    borderRadius: 13,
    backgroundColor: dashboardTheme.surface,
  },
  exerciseGroup: {
    overflow: 'hidden',
  },
  groupRow: {
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupRowDivider: { borderTopWidth: 1, borderTopColor: dashboardTheme.divider },
  groupRowPressed: { backgroundColor: dashboardTheme.surfaceMuted },
  singleGroupRow: {
    backgroundColor: dashboardTheme.surface,
  },
  singleGroupRowSelected: {
    borderColor: 'rgba(77,123,103,0.18)',
    backgroundColor: 'rgba(77,123,103,0.10)',
  },
  groupName: { color: dashboardTheme.ink, ...typeScale.body },
  groupMeta: { color: dashboardTheme.slate, ...typeScale.caption },
  groupActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  groupCount: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F0F3FA',
  },
  groupCountActive: { backgroundColor: '#E5EBFF' },
  groupCountText: { color: dashboardTheme.slate, ...typeScale.caption },
  groupCountTextActive: { color: '#5269D9' },
  equipmentGroup: { overflow: 'hidden' },
  equipmentRow: {
    minHeight: 54,
    paddingHorizontal: 14,
    paddingLeft: 24,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#D8DAD7',
    backgroundColor: '#E7E9E6',
  },
  equipmentRowSelected: { backgroundColor: 'rgba(98,201,138,0.12)' },
  equipmentName: {
    flex: 1,
    color: dashboardTheme.ink,
    ...typeScale.body,
  },
  equipmentMeta: { color: dashboardTheme.slate, ...typeScale.caption },
  subVariationRow: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingLeft: 42,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#D8DAD7',
    backgroundColor: '#EFF0ED',
  },
  subVariationRowSelected: { backgroundColor: 'rgba(98,201,138,0.18)' },
  variationName: {
    flex: 1,
    color: dashboardTheme.ink,
    ...typeScale.body,
  },
  exerciseOption: {
    minHeight: 66,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dashboardTheme.divider,
    borderRadius: 16,
    backgroundColor: dashboardTheme.surface,
  },
  exerciseOptionSelected: {
    borderColor: 'rgba(102,120,240,0.16)',
    backgroundColor: 'rgba(102,120,240,0.10)',
  },
  exerciseOptionPressed: { opacity: 0.72 },
  exerciseOptionCopy: { flex: 1, gap: 2 },
  exerciseOptionName: { color: dashboardTheme.ink, ...typeScale.cardTitle },
  exerciseOptionEquipment: { color: '#4F625A', ...typeScale.label },
  emptySearch: {
    paddingVertical: 28,
    color: dashboardTheme.slate,
    ...typeScale.cardTitle,
    textAlign: 'center',
  },
  pickerSubmit: {
    marginTop: 0,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: dashboardTheme.accent,
  },
  pickerSubmitDisabled: { backgroundColor: '#B7BCBE' },
  pickerCtaFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 142,
    zIndex: 1,
  },
  pickerCtaDock: {
    position: 'absolute',
    left: 20,
    right: 20,
    paddingTop: 8,
    backgroundColor: 'transparent',
    borderRadius: 18,
    zIndex: 2,
  },
  optionsBackdrop: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(23,25,28,0.12)',
  },
  optionsSheet: {
    backgroundColor: dashboardTheme.surface,
    borderRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 22,
    paddingBottom: 24,
    gap: 0,
    width: '100%',
    maxWidth: 430,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: dashboardTheme.divider,
  },
  sheetTitle: {
    color: dashboardTheme.ink,
    ...typeScale.sectionTitle,
    textAlign: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
  },
  sheetHeader: { height: 44, alignItems: 'center', justifyContent: 'center' },
  sheetClose: {
    position: 'absolute',
    right: 0,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: dashboardTheme.surfaceMuted,
  },
  sheetClosePressed: { transform: [{ scale: 0.92 }], opacity: 0.72 },
  optionList: {
    marginTop: 10,
  },
  optionRow: {
    minHeight: 46,
    marginHorizontal: -22,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    borderBottomWidth: 1,
    borderBottomColor: dashboardTheme.divider,
  },
  optionRowPressed: { backgroundColor: dashboardTheme.surfaceMuted, opacity: 0.8 },
  optionLabel: { flex: 1, color: dashboardTheme.ink, ...typeScale.cardTitle },
  destructiveAction: {
    minHeight: 65,
    marginHorizontal: -22,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  destructivePressed: { backgroundColor: 'rgba(255,59,48,0.08)', opacity: 0.8 },
  destructiveText: { color: '#FF3B30', ...typeScale.cardTitle },
});
