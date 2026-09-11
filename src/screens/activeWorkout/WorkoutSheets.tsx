import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
  ForgeBottomSheetDragArea,
  ForgeBottomSheetHandle,
  ForgeCatalogFilterContent,
  ForgeFloatingCta,
  ForgeSheetHeader,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  Icon,
} from '../../components/ui';
import { forgeSheetHeader } from '../../components/ui/ForgeBottomSheet';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { useExerciseCatalog } from '../../state/ExerciseCatalogContext';
import { useSettings } from '../../state/SettingsContext';
import { CompletionCheck } from './CompletionCheck';
import { animateLayout, lightHaptic, mediumHaptic, selectionHaptic } from './activeWorkoutFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WorkoutExercise } from '../../types';
import { catalogFacets, filterCatalog, groupCatalogByEquipment } from '../../domain/exercises/catalogSelectors';
import {
  catalogFilterCount,
  emptyCatalogFilters,
  type CatalogFilterFacet,
  type CatalogFilterState,
} from '../../components/ui';

export function AddExerciseSheet({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (exercises: ExerciseCatalogItem[]) => void;
}) {
  const { exercises: exerciseCatalog } = useExerciseCatalog();
  const { preferences } = useSettings();
  const theme = useForgeTheme();
  const dashboardTheme = theme;
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<CatalogFilterState>(emptyCatalogFilters());
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedEquipment, setExpandedEquipment] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const filterFacets = useMemo<CatalogFilterFacet[]>(() => {
    const optionsFor = (draft: CatalogFilterState, includeEquipment: boolean) => {
      const scoped = filterCatalog(exerciseCatalog, {
        types: draft.types,
        equipment: includeEquipment ? draft.equipment : [],
        includeGroupInSearch: false,
      });
      return scoped;
    };
    return [
      {
        key: 'types', title: 'Workout type', icon: 'layers',
        options: preferences.workoutTypes.filter((type) => !type.hidden).map((type) => ({ value: type.id, label: type.name })),
      },
      {
        key: 'equipment', title: 'Equipment', icon: 'fitness-outline',
        options: catalogFacets(exerciseCatalog).equipment.map((value) => ({ value, label: value })),
        optionsFor: (draft) => catalogFacets(optionsFor(draft, false)).equipment.map((value) => ({ value, label: value })),
      },
      {
        key: 'exerciseCategories', title: 'Category', icon: 'activity',
        options: [...new Set(exerciseCatalog.map((exercise) => exercise.category))].sort().map((value) => ({ value, label: value })),
        optionsFor: (draft) => [...new Set(optionsFor(draft, true).map((exercise) => exercise.category))].sort().map((value) => ({ value, label: value })),
      },
    ];
  }, [exerciseCatalog, preferences.workoutTypes]);
  const filteredExercises = filterCatalog(exerciseCatalog, {
    query,
    types: filters.types,
    equipment: filters.equipment,
    exerciseCategories: filters.exerciseCategories,
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
  const activeFilterCount = catalogFilterCount(filters);
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
    setFilters(emptyCatalogFilters());
    setExpandedGroup(null);
    setExpandedEquipment(null);
  };
  const submit = (): void => {
    const exercises = exerciseCatalog.filter((exercise) => selected.includes(exercise.id));
    if (!exercises.length) return;
    Keyboard.dismiss();
    setQuery('');
    setSelected([]);
    setFiltersOpen(false);
    setFilters(emptyCatalogFilters());
    setExpandedGroup(null);
    setExpandedEquipment(null);
    mediumHaptic();
    onSubmit(exercises);
  };

  return (
    <>
    <ForgeBottomSheet
      visible={visible}
      onClose={onClose}
      onCloseStart={reset}
      accessibilityLabel="Close add exercises"
      initialOffset={520}
      closeDistance={520}
      dismissThreshold={260}
      preload
      keyboardAvoiding
      surfaceTestID="add-exercise-sheet-surface"
      style={styles.pickerSheet}
    >
      {(closeSheet) => (
        <>
          {filtersOpen ? (
            <View style={styles.filterSheetFill}>
              <ForgeCatalogFilterContent
                filters={filters}
                facets={filterFacets}
                fill
                headerWithDragHandle
                onCancel={() => setFiltersOpen(false)}
                onApply={(next) => {
                  setFilters(next);
                  setFiltersOpen(false);
                }}
              />
            </View>
          ) : (
            <>
          <ForgeBottomSheetDragArea>
            <ForgeBottomSheetHandle />
            <View style={styles.sheetHeaderDivider}>
              <ForgeSheetHeader
                title="Add exercises"
                onClose={closeSheet}
                closeAccessibilityLabel="Close add exercises"
                horizontalInset={0}
              />
            </View>
          </ForgeBottomSheetDragArea>
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
              onPress={() => setFiltersOpen(true)}
              style={({ pressed }) => [
                styles.filterButton,
                activeFilterCount > 0 && styles.filterButtonActive,
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
                          unstable_pressDelay={80}
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
                            tone="selection"
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
                          unstable_pressDelay={80}
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
                                  unstable_pressDelay={80}
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
                                    tone="selection"
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
                                  unstable_pressDelay={80}
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
                                        unstable_pressDelay={80}
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
                                          tone="selection"
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
              <View style={styles.emptyState}>
                <Text style={styles.emptySearch}>{query && activeFilterCount ? 'No exercises match this search and filters' : query ? 'No exercises match this search' : 'No exercises match these filters'}</Text>
                {(query || activeFilterCount > 0) && (
                  <Button
                    label={activeFilterCount > 0 ? 'Clear filters' : 'Clear search'}
                    variant="ghost"
                    onPress={() => activeFilterCount > 0 ? setFilters(emptyCatalogFilters()) : setQuery('')}
                  />
                )}
              </View>
            )}
          </ScrollView>
          <ForgeFloatingCta
            label={`Add exercises${selected.length ? ` (${selected.length})` : ''}`}
            accessibilityLabel="Confirm selected exercises"
            disabled={!selected.length}
            onPress={submit}
            theme={dashboardTheme}
            icon="check"
            tone={selected.length ? 'success' : 'neutral'}
          />
            </>
          )}
        </>
      )}
    </ForgeBottomSheet>
    </>
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
      title="Exercise options"
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
    sheetHeaderDivider: { borderBottomWidth: 1, borderBottomColor: dashboardTheme.border },
    pickerHeader: {
      height: forgeSheetHeader.height,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    // Normal flow deliberately shares the Add Exercises header origin, which
    // keeps both X controls in the exact same screen position.
    filterSheetFill: { flex: 1, alignSelf: 'stretch', marginHorizontal: -20, marginBottom: -12 },
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
    filterButtonActive: { borderWidth: 1, borderColor: dashboardTheme.selectionIndicator },
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
    emptyState: { alignItems: 'center', paddingHorizontal: 20 },
  });
};
