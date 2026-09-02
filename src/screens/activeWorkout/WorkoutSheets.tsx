import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Button,
  ForgeActionSheet,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  Icon,
  SheetCloseButton,
} from '../../components/ui';
import { forgeSheetHeader } from '../../components/ui/ForgeBottomSheet';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { useExerciseCatalog } from '../../state/ExerciseCatalogContext';
import { CompletionCheck } from './CompletionCheck';
import { animateLayout, lightHaptic, mediumHaptic, selectionHaptic } from './activeWorkoutFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WorkoutExercise } from '../../types';
import { filterCatalog, groupCatalogByEquipment } from '../../domain/exercises/catalogSelectors';

export function AddExerciseSheet({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (names: string[]) => void;
}) {
  const { exercises: exerciseCatalog } = useExerciseCatalog();
  const theme = useForgeTheme();
  const dashboardTheme = theme;
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedEquipment, setExpandedEquipment] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const filteredExercises = filterCatalog(exerciseCatalog, {
    query,
    categories: categoryFilter ? [categoryFilter] : [],
    includeGroupInSearch: false,
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
  const reset = (): void => {
    Keyboard.dismiss();
    setQuery('');
    setSelected([]);
    setFiltersOpen(false);
    setCategoryFilter(null);
    setExpandedGroup(null);
    setExpandedEquipment(null);
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
    <ForgeBottomSheet
      visible={visible}
      onClose={onClose}
      onCloseStart={reset}
      accessibilityLabel="Close add exercises"
      initialOffset={520}
      closeDistance={520}
      dismissThreshold={260}
      keyboardAvoiding
      style={styles.pickerSheet}
    >
      {(closeSheet) => (
        <>
          <ForgeBottomSheetHandle />
          <View style={styles.pickerDragArea}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Add exercises</Text>
              <SheetCloseButton accessibilityLabel="Close add exercises" onPress={closeSheet} />
            </View>
          </View>
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
              style={({ pressed }) => [styles.filterButton, pressed && styles.filterButtonPressed]}
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
                          style={[styles.filterChoiceText, active && styles.filterChoiceTextActive]}
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
                    const equipmentGroups = groupCatalogByEquipment(variations).map(
                      ([equipment, exercises]) => ({ equipment, exercises }),
                    );
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
                            tone="interactive"
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
                              testID={`exercise-group-count-${group}`}
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
                                    tone="interactive"
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
                                      testID={`exercise-equipment-count-${group}-${equipment}`}
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
                                          tone="interactive"
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
              icon="check"
              variant="outline"
              tone={selected.length ? 'success' : 'neutral'}
              style={styles.pickerSubmit}
            />
          </Animated.View>
        </>
      )}
    </ForgeBottomSheet>
  );
}

function AnimatedChevron({ expanded }: { expanded: boolean }) {
  const theme = useForgeTheme();
  const dashboardTheme = theme;
  const styles = useThemedStyles(createStyles);
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
  const styles = useThemedStyles(createStyles);
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
  return (
    <ForgeActionSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel="Close options"
      title="Options"
      initialOffset={420}
      closeDistance={520}
      dismissThreshold={260}
      actions={[
        { icon: 'measure', label: 'Measure by', onPress: () => undefined },
        { icon: 'note', label: 'Add note', onPress: () => undefined },
        { icon: 'history', label: 'Previous sessions', onPress: () => undefined },
        { icon: 'warm-up', label: 'Warm-up sets', onPress: () => undefined },
        { icon: 'info', label: 'Exercise info', onPress: () => undefined },
        {
          icon: 'trash',
          label: 'Remove exercise',
          accessibilityLabel: `Remove ${exercise.name}`,
          tone: 'destructive',
          onPress: onRemove,
        },
      ]}
    />
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
  return (
    <ForgeActionSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel="Close workout options"
      title="Workout options"
      initialOffset={320}
      closeDistance={320}
      dismissThreshold={160}
      actions={[
        ...(onEdit ? [{ icon: 'note' as const, label: 'Edit workout', onPress: onEdit }] : []),
        {
          icon: 'trash',
          label: 'Delete workout',
          accessibilityLabel: `Delete ${workoutName}`,
          tone: 'destructive' as const,
          onPress: onDelete,
        },
      ]}
    />
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) => {
  const dashboardTheme = theme;
  return StyleSheet.create({
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
      height: forgeSheetHeader.height,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pickerDragArea: { marginHorizontal: -20, paddingHorizontal: 20 },
    pickerTitle: { color: dashboardTheme.ink, ...typeScale.headerTitle },
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
      backgroundColor: dashboardTheme.selectionIndicator,
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
    filterChoiceActive: { backgroundColor: dashboardTheme.selectionIndicator },
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
      borderColor: dashboardTheme.selectionIndicator,
      backgroundColor: dashboardTheme.surfaceMuted,
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
      backgroundColor: dashboardTheme.surfaceElevated,
      borderWidth: 1,
      borderColor: dashboardTheme.divider,
    },
    groupCountActive: {
      backgroundColor: dashboardTheme.surfaceMuted,
      borderWidth: 1,
      borderColor: dashboardTheme.selectionIndicator,
    },
    groupCountText: { color: dashboardTheme.slate, ...typeScale.caption },
    groupCountTextActive: { color: dashboardTheme.selectionIndicator },
    equipmentGroup: { overflow: 'hidden' },
    equipmentRow: {
      minHeight: 54,
      paddingHorizontal: 14,
      paddingLeft: 24,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: dashboardTheme.divider,
      backgroundColor: dashboardTheme.surfaceMuted,
    },
    equipmentRowSelected: {
      backgroundColor: dashboardTheme.surfaceMuted,
      borderColor: dashboardTheme.selectionIndicator,
    },
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
      borderTopColor: dashboardTheme.divider,
      backgroundColor: dashboardTheme.surfaceElevated,
    },
    subVariationRowSelected: {
      backgroundColor: dashboardTheme.surfaceMuted,
      borderColor: dashboardTheme.selectionIndicator,
    },
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
      borderColor: dashboardTheme.selectionIndicator,
      backgroundColor: dashboardTheme.surfaceMuted,
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
    },
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
  });
};
