import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
  ForgeCard,
  ForgeCatalogFilterContent,
  ForgeEditorBackButton,
  ForgeFloatingCta,
  ForgeSheetHeader,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  Icon,
} from '../../components/ui';
import { forgeSheetHeader } from '../../components/ui/ForgeBottomSheet';
import { useForgeFloatingCtaClearance } from '../../components/ui/ForgeFloatingCta';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { useExerciseCatalog } from '../../state/ExerciseCatalogContext';
import { useSettings } from '../../state/SettingsContext';
import { CompletionCheck } from './CompletionCheck';
import { animateLayout, lightHaptic, mediumHaptic, selectionHaptic } from './activeWorkoutFeedback';
import type { Workout, WorkoutExercise } from '../../types';
import { ExerciseInfoContent, PreviousSessionsContent } from './ExerciseOptionSheets';
import { catalogFacets, filterCatalog, groupCatalogByPrimaryEquipment } from '../../domain/exercises/catalogSelectors';
import { formatPickerPrimaryEquipment } from '../../domain/exercises/exercisePresentation';
import {
  buildVariationFamily,
  hasComposableInputs,
  resolveVariationPalette,
  variationAxes,
  variationAxisLabel,
  type ResolvedVariation,
  type VariationFamily,
} from '../../domain/exercises/variationResolver';
import {
  catalogFilterCount,
  emptyCatalogFilters,
  type CatalogFilterFacet,
  type CatalogFilterState,
} from '../../components/ui';

type CatalogCategoryData = {
  category: string;
  groups: { group: string; variations: ExerciseCatalogItem[] }[];
};

type VariationResolution = { direct: ExerciseCatalogItem[]; choices: ResolvedVariation[] };

export const AddExerciseSheet = React.memo(function AddExerciseSheet({
  visible,
  session = 0,
  workoutType,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  /** Changes for each opening so the same sheet instance can start cleanly. */
  session?: number;
  /** The active workout or editor type provides a removable initial scope. */
  workoutType?: string;
  onClose: () => void;
  onSubmit: (exercises: ExerciseCatalogItem[]) => void;
}) {
  const { exercises: exerciseCatalog, addCustomExercise } = useExerciseCatalog();
  const { preferences } = useSettings();
  const theme = useForgeTheme();
  const dashboardTheme = theme;
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [modifierSelections, setModifierSelections] = useState<ReadonlyMap<string, ReadonlySet<string>>>(() => new Map());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [variationResolution, setVariationResolution] = useState<VariationResolution | null>(null);
  const [filters, setFilters] = useState<CatalogFilterState>(emptyCatalogFilters());
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedEquipment, setExpandedEquipment] = useState<string | null>(null);
  const initializedSession = useRef<number | null>(null);
  const floatingCtaClearance = useForgeFloatingCtaClearance();
  const defaultTypeIds = useMemo(() => {
    const name = workoutType?.trim().toLocaleLowerCase();
    if (!name) return [];
    return preferences.workoutTypes
      .filter((type) => type.name.trim().toLocaleLowerCase() === name)
      .map((type) => type.id);
  }, [preferences.workoutTypes, workoutType]);
  // Settings hydration reconstructs its workout-type array even when the
  // resolved IDs have not changed. Keep this scalar stable so an in-flight
  // catalogue search is never reset by that harmless provider refresh.
  const defaultTypeKey = defaultTypeIds.join('\u0001');
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
  const filteredExercises = useMemo(
    () => filterCatalog(exerciseCatalog, {
      query,
      types: filters.types,
      equipment: filters.equipment,
      exerciseCategories: filters.exerciseCategories,
      includeGroupInSearch: false,
    }),
    [exerciseCatalog, filters.equipment, filters.exerciseCategories, filters.types, query],
  );
  const allVariantsByGroup = useMemo(() => {
    const groups = new Map<string, ExerciseCatalogItem[]>();
    exerciseCatalog.forEach((exercise) => {
      const key = `${exercise.category}\u0001${exercise.group}`;
      const current = groups.get(key) ?? [];
      current.push(exercise);
      groups.set(key, current);
    });
    return groups;
  }, [exerciseCatalog]);
  const groupedExercises = useMemo<CatalogCategoryData[]>(() => {
    const categories = new Map<string, Map<string, ExerciseCatalogItem[]>>();
    filteredExercises.forEach((exercise) => {
      const groups = categories.get(exercise.category) ?? new Map<string, ExerciseCatalogItem[]>();
      const variations = groups.get(exercise.group) ?? [];
      variations.push(exercise);
      groups.set(exercise.group, variations);
      categories.set(exercise.category, groups);
    });
    return [...categories].map(([category, groups]) => ({
      category,
      groups: [...groups].map(([group, variations]) => ({ group, variations })),
    }));
  }, [filteredExercises]);
  const activeFilterCount = catalogFilterCount(filters);
  const toggleExercise = useCallback((exercise: ExerciseCatalogItem): void => {
    Keyboard.dismiss();
    lightHaptic();
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(exercise.id)) next.delete(exercise.id);
      else next.add(exercise.id);
      return next;
    });
  }, []);
  const toggleModifier = useCallback((familyKey: string, inputId: string): void => {
    Keyboard.dismiss();
    lightHaptic();
    setModifierSelections((current) => {
      const next = new Map(current);
      const values = new Set(current.get(familyKey) ?? []);
      if (values.has(inputId)) values.delete(inputId); else values.add(inputId);
      if (values.size) next.set(familyKey, values); else next.delete(familyKey);
      return next;
    });
  }, []);
  const toggleGroup = useCallback((key: string, expanded: boolean): void => {
    Keyboard.dismiss();
    selectionHaptic();
    animateLayout();
    setExpandedGroup(expanded ? null : key);
    setExpandedEquipment(null);
  }, []);
  const toggleEquipment = useCallback((key: string, expanded: boolean): void => {
    Keyboard.dismiss();
    selectionHaptic();
    animateLayout();
    setExpandedEquipment(expanded ? null : key);
  }, []);
  const reset = useCallback((): void => {
    Keyboard.dismiss();
    setQuery('');
    setSelected(new Set());
    setModifierSelections(new Map());
    setFiltersOpen(false);
    setVariationResolution(null);
    setFilters({ ...emptyCatalogFilters(), types: defaultTypeKey ? defaultTypeKey.split('\u0001') : [] });
    setExpandedGroup(null);
    setExpandedEquipment(null);
  }, [defaultTypeKey]);
  useEffect(() => {
    if (!visible) {
      initializedSession.current = null;
      return;
    }
    // A modal can render more than once while its host route and settings
    // settle. Reset only once per explicitly opened picker session; otherwise
    // an innocent render can clear a just-tapped exercise.
    if (initializedSession.current === session) return;
    initializedSession.current = session;
    reset();
  }, [reset, session, visible]);
  const commit = useCallback((exercises: ExerciseCatalogItem[]): void => {
    const unique = [...new Map(exercises.map((exercise) => [exercise.id, exercise])).values()];
    if (!unique.length) return;
    unique.filter((exercise) => exercise.id.startsWith('custom-derived-') && !exerciseCatalog.some((item) => item.id === exercise.id)).forEach(addCustomExercise);
    Keyboard.dismiss();
    setQuery('');
    setSelected(new Set());
    setModifierSelections(new Map());
    setFiltersOpen(false);
    setVariationResolution(null);
    setFilters({ ...emptyCatalogFilters(), types: defaultTypeKey ? defaultTypeKey.split('\u0001') : [] });
    setExpandedGroup(null);
    setExpandedEquipment(null);
    mediumHaptic();
    onSubmit(unique);
  }, [addCustomExercise, defaultTypeKey, exerciseCatalog, onSubmit]);
  const submit = (): void => {
    const direct = exerciseCatalog.filter((exercise) => selected.has(exercise.id));
    const ambiguous: ResolvedVariation[] = [];
    modifierSelections.forEach((ids, familyKey) => {
      const variants = allVariantsByGroup.get(familyKey) ?? [];
      const resolved = resolveVariationPalette(buildVariationFamily(variants), ids);
      if (resolved.length === 1) direct.push(resolved[0].exercise);
      else if (resolved.length > 1) ambiguous.push(...resolved);
    });
    if (!ambiguous.length) { commit(direct); return; }
    setVariationResolution({ direct, choices: [...new Map(ambiguous.map((item) => [item.exercise.id, item])).values()] });
  };

  return (
    <>
    <ForgeBottomSheet
      visible={visible}
      onClose={onClose}
      // The picker can be dismissed while an automation clock is frozen for a
      // rest-timer scenario; release its modal ownership at close start rather
      // than waiting for a motion callback that has no advancing frame clock.
      onCloseStart={() => { reset(); onClose(); }}
      accessibilityLabel="Close add exercises"
      initialOffset={360}
      closeDistance={520}
      dismissThreshold={260}
      keyboardAvoiding
      // The catalogue owns vertical drags, including when the search keyboard is open.
      dismissTextKeyboardOnTap={false}
      surfaceTestID="add-exercise-sheet-surface"
      // The Dashboard blank-workout handoff presents this mandatory picker
      // immediately. Measure first so the complete card enters from below
      // rather than being visible before its Forge sheet animation begins.
      waitForContentLayoutBeforeEnter
      style={styles.pickerSheet}
    >
      {(closeSheet) => (
        <>
          {variationResolution ? (
            <ExerciseOutputChooser
              resolution={variationResolution}
              onBack={() => setVariationResolution(null)}
              onClose={closeSheet}
              onConfirm={(choices) => commit([...variationResolution.direct, ...choices])}
            />
          ) : filtersOpen ? (
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
            <ForgeBottomSheetHandle />
            <ForgeSheetHeader
              title="Add exercises"
              onClose={closeSheet}
              closeAccessibilityLabel="Close add exercises"
              horizontalInset={0}
            />
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
          <FlatList
            testID="add-exercise-catalogue"
            style={styles.pickerList}
            data={groupedExercises}
            keyExtractor={(item) => item.category}
            initialNumToRender={3}
            maxToRenderPerBatch={2}
            updateCellsBatchingPeriod={32}
            windowSize={5}
            removeClippedSubviews={Platform.OS !== 'web'}
            contentContainerStyle={[
              styles.pickerListContent,
              { paddingBottom: floatingCtaClearance },
            ]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <CatalogCategory
                category={item.category}
                groups={item.groups}
                selected={selected}
                expandedGroup={expandedGroup}
                expandedEquipment={expandedEquipment}
                onToggleExercise={toggleExercise}
                onToggleGroup={toggleGroup}
                onToggleEquipment={toggleEquipment}
                modifierSelections={modifierSelections}
                onToggleModifier={toggleModifier}
              />
            )}
            ListEmptyComponent={!filteredExercises.length ? (
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
            ) : null}
          />
          <ForgeFloatingCta
            label={`Add exercises${selected.size + [...modifierSelections.values()].reduce((count, values) => count + values.size, 0) ? ` (${selected.size + [...modifierSelections.values()].reduce((count, values) => count + values.size, 0)})` : ''}`}
            accessibilityLabel="Confirm selected exercises"
            disabled={!selected.size && !modifierSelections.size}
            onPress={submit}
            theme={dashboardTheme}
            icon="check"
            tone={selected.size || modifierSelections.size ? 'success' : 'neutral'}
          />
            </>
          )}
        </>
      )}
    </ForgeBottomSheet>
    </>
  );
});

function ExerciseOutputChooser({ resolution, onBack, onClose, onConfirm }: {
  resolution: VariationResolution;
  onBack: () => void;
  onClose: () => void;
  onConfirm: (choices: ExerciseCatalogItem[]) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  return <>
    <ForgeBottomSheetHandle />
    <ForgeSheetHeader title="Choose exercises" onClose={onClose} leading={<ForgeEditorBackButton onPress={onBack} accessibilityLabel="Back to exercise choices" />} />
    <FlatList
      testID="variation-output-chooser"
      data={resolution.choices}
      keyExtractor={(item) => item.exercise.id}
      contentContainerStyle={[styles.outputChooserContent, { paddingBottom: 124 }]}
      renderItem={({ item }) => {
        const checked = selected.has(item.exercise.id);
        return <Pressable accessibilityRole="checkbox" accessibilityLabel={item.exercise.name} accessibilityState={{ checked }} onPress={() => setSelected((current) => {
          const next = new Set(current); if (next.has(item.exercise.id)) next.delete(item.exercise.id); else next.add(item.exercise.id); return next;
        })} style={({ pressed }) => [styles.outputChoice, checked && styles.outputChoiceSelected, pressed && styles.exerciseOptionPressed]}>
          <View style={styles.exerciseOptionCopy}><Text style={styles.groupName}>{item.exercise.name}</Text><Text style={styles.groupMeta}>{item.exercise.variation || (item.source === 'derived' ? 'New variation' : 'Catalogue exercise')}</Text></View>
          <CompletionCheck selected={checked} tone="selection" />
        </Pressable>;
      }}
    />
    <ForgeFloatingCta label={`Add exercises${selected.size ? ` (${selected.size + resolution.direct.length})` : ''}`} accessibilityLabel="Confirm resolved exercises" disabled={!selected.size && !resolution.direct.length} icon="check" tone={selected.size || resolution.direct.length ? 'success' : 'neutral'} theme={theme} onPress={() => onConfirm(resolution.choices.filter((item) => selected.has(item.exercise.id)).map((item) => item.exercise))} />
  </>;
}

const CatalogCategory = React.memo(function CatalogCategory({
  category,
  groups,
  selected,
  expandedGroup,
  expandedEquipment,
  onToggleExercise,
  onToggleGroup,
  onToggleEquipment,
  modifierSelections,
  onToggleModifier,
}: {
  category: string;
  groups: CatalogCategoryData['groups'];
  selected: ReadonlySet<string>;
  expandedGroup: string | null;
  expandedEquipment: string | null;
  onToggleExercise: (exercise: ExerciseCatalogItem) => void;
  onToggleGroup: (key: string, expanded: boolean) => void;
  onToggleEquipment: (key: string, expanded: boolean) => void;
  modifierSelections: ReadonlyMap<string, ReadonlySet<string>>;
  onToggleModifier: (familyKey: string, inputId: string) => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View>
      <Text style={styles.categoryTitle}>{category}</Text>
      <View style={styles.categoryCard}>
        {groups.map(({ group, variations }, groupIndex) => {
          const groupKey = `${category}-${group}`;
          const familyKey = `${category}\u0001${group}`;
          const expanded = expandedGroup === groupKey;
          const family = buildVariationFamily(variations);
          const selectedModifiers = modifierSelections.get(familyKey) ?? new Set<string>();
          const selectedCount = variations.filter((exercise) => selected.has(exercise.id)).length + selectedModifiers.size;
          const equipmentGroups = expanded
            ? groupCatalogByPrimaryEquipment(variations).map(([equipment, exercises]) => ({ equipment, exercises }))
            : [];

          if (variations.length === 1) {
            const exercise = variations[0];
            const isSelected = selected.has(exercise.id);
            return (
              <Pressable
                key={group}
                accessibilityRole="checkbox"
                accessibilityLabel={`${group}, variation`}
                accessibilityState={{ checked: isSelected }}
                onPress={() => onToggleExercise(exercise)}
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
                  {exercise.variation ? <Text style={styles.groupMeta}>{exercise.variation}</Text> : null}
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
                accessibilityLabel={`${group} & ${variations.length} variations`}
                onPress={() => onToggleGroup(groupKey, expanded)}
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
                    style={[styles.groupCount, selectedCount > 0 && styles.groupCountActive]}
                  >
                    <AnimatedCount count={selectedCount} />
                  </View>
                  <AnimatedChevron expanded={expanded} />
                </View>
              </Pressable>
              {expanded && hasComposableInputs(family) ? <FacetPickerRows family={family} familyKey={familyKey} selected={selectedModifiers} onToggle={onToggleModifier} /> : null}
              {expanded && hasComposableInputs(family) && family.standalone.map((exercise) => {
                const isSelected = selected.has(exercise.id);
                return <Pressable key={exercise.id} accessibilityRole="checkbox" accessibilityLabel={`${group}, ${exercise.name}`} accessibilityState={{ checked: isSelected }} onPress={() => onToggleExercise(exercise)} style={({ pressed }) => [styles.subVariationRow, isSelected && styles.subVariationRowSelected, pressed && styles.exerciseOptionPressed]}>
                  <View style={styles.exerciseOptionCopy}><Text style={styles.variationName}>{exercise.name}</Text><Text style={styles.equipmentMeta}>{exercise.variation || 'Named variation'}</Text></View>
                  <CompletionCheck selected={isSelected} tone="selection" testID={`exercise-selection-${exercise.id}`} />
                </Pressable>;
              })}
              {!hasComposableInputs(family) && equipmentGroups.map(({ equipment, exercises }) => {
                const equipmentSelectedCount = exercises.filter((exercise) => selected.has(exercise.id)).length;
                const hasSubVariations = exercises.length > 1;
                const equipmentKey = `${groupKey}-${equipment}`;
                const equipmentExpanded = expandedEquipment === equipmentKey;

                if (!hasSubVariations) {
                  const exercise = exercises[0];
                  const equipmentLabel = formatPickerPrimaryEquipment(exercise, equipment);
                  const isSelected = selected.has(exercise.id);
                  return (
                    <Pressable
                      key={equipment}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${group}, ${equipmentLabel}`}
                      accessibilityState={{ checked: isSelected }}
                      onPress={() => onToggleExercise(exercise)}
                      style={({ pressed }) => [
                        styles.equipmentRow,
                        isSelected && styles.equipmentRowSelected,
                        pressed && styles.exerciseOptionPressed,
                      ]}
                    >
                      <Text style={styles.equipmentName}>{equipmentLabel}</Text>
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
                      accessibilityLabel={`${equipment} & ${exercises.length} variations`}
                      onPress={() => onToggleEquipment(equipmentKey, equipmentExpanded)}
                      style={({ pressed }) => [styles.equipmentRow, pressed && styles.exerciseOptionPressed]}
                    >
                      <View style={styles.exerciseOptionCopy}>
                        <Text style={styles.equipmentName}>{equipment}</Text>
                        <Text style={styles.equipmentMeta}>{exercises.length} variations</Text>
                      </View>
                      <View style={styles.groupActions}>
                        <View
                          testID={`exercise-equipment-count-${group}-${equipment}`}
                          style={[styles.groupCount, equipmentSelectedCount > 0 && styles.groupCountActive]}
                        >
                          <AnimatedCount count={equipmentSelectedCount} />
                        </View>
                        <AnimatedChevron expanded={equipmentExpanded} />
                      </View>
                    </Pressable>
                    {equipmentExpanded && exercises.map((exercise) => {
                      const isSelected = selected.has(exercise.id);
                      const label = exercise.variation || exercise.name;
                      return (
                        <Pressable
                          key={exercise.id}
                          accessibilityRole="checkbox"
                          accessibilityLabel={`${group}, ${equipment}, ${label}`}
                          accessibilityState={{ checked: isSelected }}
                          onPress={() => onToggleExercise(exercise)}
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
  );
});

function FacetPickerRows({ family, familyKey, selected, onToggle }: {
  family: VariationFamily;
  familyKey: string;
  selected: ReadonlySet<string>;
  onToggle: (familyKey: string, inputId: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const assistedSelected = family.inputs.some((input) => input.axis === 'load' && input.value === 'Assisted' && selected.has(input.id));
  const groups = variationAxes.map((axis) => ({ axis, inputs: family.inputs.filter((input) => input.axis === axis && (axis !== 'assistance' || assistedSelected)) })).filter((group) => group.inputs.length);
  return <View style={styles.facetPicker}>
    {groups.map(({ axis, inputs }) => <View key={axis} style={styles.facetGroup}>
      <Text style={styles.facetGroupTitle}>{variationAxisLabel(axis)}</Text>
      <ForgeCard variant="outlined" style={styles.facetGroupCard}>
        {inputs.map((input, index) => {
          const checked = selected.has(input.id);
          return <Pressable key={input.id} accessibilityRole="checkbox" accessibilityLabel={`${family.group}, ${input.label}`} accessibilityState={{ checked }} onPress={() => onToggle(familyKey, input.id)} style={({ pressed }) => [styles.facetRow, index > 0 && styles.groupRowDivider, checked && styles.subVariationRowSelected, pressed && styles.exerciseOptionPressed]}>
            <Text style={styles.variationName}>{input.label}</Text>
            <CompletionCheck selected={checked} tone="selection" />
          </Pressable>;
        })}
      </ForgeCard>
    </View>)}
  </View>;
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
  onEditNote,
  onOpenPreviousSessions,
  onOpenWarmupSets,
  onOpenExerciseInfo,
  onOpenWorkout,
  excludeWorkoutId,
  readOnly = false,
  completedWorkouts = [],
  onRemove,
}: {
  visible: boolean;
  exercise: WorkoutExercise;
  onClose: () => void;
  onEditNote?: (note: string) => void;
  onOpenPreviousSessions?: () => void;
  onOpenWarmupSets?: () => void;
  onOpenExerciseInfo?: () => void;
  onOpenWorkout?: (workoutId: string) => void;
  excludeWorkoutId?: string;
  readOnly?: boolean;
  completedWorkouts?: readonly Workout[];
  onRemove?: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const [view, setView] = useState<'actions' | 'note' | 'history' | 'info'>('actions');
  const [noteDraft, setNoteDraft] = useState(exercise.note ?? '');
  const [noteHeight, setNoteHeight] = useState(156);

  const commitNote = (): void => {
    onEditNote?.(noteDraft.trim());
  };
  const close = (): void => {
    if (view === 'note') commitNote();
    onClose();
  };
  const backToActions = (): void => {
    commitNote();
    setView('actions');
  };

  return (
    <ForgeActionSheet
      visible={visible}
      onClose={close}
      accessibilityLabel="Close options"
      title="Exercise options"
      initialOffset={420}
      closeDistance={520}
      dismissThreshold={260}
      actions={[
        ...((onEditNote || (readOnly && exercise.note?.trim())) ? [{
          icon: 'note' as const,
          label: readOnly ? 'View note' : exercise.note?.trim() ? 'Edit note' : 'Add note',
          dismiss: false,
          onPress: () => setView('note'),
        }] : []),
        ...(onOpenPreviousSessions ? [{ icon: 'history' as const, label: 'Previous sessions', dismiss: false, onPress: () => setView('history') }] : []),
        ...(onOpenWarmupSets ? [{ icon: 'warm-up' as const, label: 'Warm-up sets', onPress: onOpenWarmupSets }] : []),
        ...(onOpenExerciseInfo ? [{ icon: 'info' as const, label: 'Exercise info', dismiss: false, onPress: () => setView('info') }] : []),
        ...(!readOnly && onRemove ? [{
          icon: 'trash' as const,
          label: 'Remove exercise',
          accessibilityLabel: `Remove ${exercise.name}`,
          tone: 'destructive' as const,
          onPress: onRemove,
        }] : []),
      ]}
      replacement={view !== 'actions' ? (closeSheet) => (
        <>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader
            title={view === 'note' ? 'Exercise note' : view === 'history' ? 'Previous sessions' : 'Exercise info'}
            onClose={closeSheet}
            closeAccessibilityLabel={`Close ${view === 'note' ? 'exercise note' : view === 'history' ? 'previous sessions' : 'exercise info'}`}
            leading={<ForgeEditorBackButton onPress={backToActions} accessibilityLabel="Back to exercise options" />}
          />
          {view === 'history' ? <PreviousSessionsContent exercise={exercise} workouts={completedWorkouts} excludeWorkoutId={excludeWorkoutId} onOpenWorkout={onOpenWorkout} /> : null}
          {view === 'info' ? <ExerciseInfoContent exercise={exercise} /> : null}
          {view === 'note' && readOnly ? <ExerciseNoteView note={exercise.note ?? ''} /> : null}
          {view === 'note' && !readOnly ? <View style={styles.exerciseNoteContent}>
            <ForgeCard variant="inset" style={styles.exerciseNoteCard}>
              <TextInput
                accessibilityLabel="Exercise note"
                value={noteDraft}
                onChangeText={setNoteDraft}
                onContentSizeChange={(event) => {
                  const contentHeight = Math.ceil(event.nativeEvent.contentSize.height);
                  // Web reports the rendered input height here. Grow only when text
                  // needs more room so that measurement cannot feed back into layout.
                  setNoteHeight((current) => Math.max(current, 156, contentHeight));
                }}
                multiline
                scrollEnabled={false}
                placeholder="Add a note for this exercise..."
                placeholderTextColor={theme.textDisabled}
                style={[styles.exerciseNoteInput, { height: noteHeight, color: theme.textPrimary }]}
              />
            </ForgeCard>
          </View> : null}
        </>
      ) : null}
    />
  );
}

function ExerciseNoteView({ note }: { note: string }) {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.exerciseNoteContent}><ForgeCard variant="inset" style={styles.exerciseNoteCard}><Text style={styles.readOnlyExerciseNote}>{note}</Text></ForgeCard></View>;
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
    composerTrigger: {
      minHeight: 58,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: dashboardTheme.divider,
      backgroundColor: dashboardTheme.surfaceMuted,
    },
    composerTriggerTitle: { color: dashboardTheme.ink, ...typeScale.label },
    composerTriggerDetail: { color: dashboardTheme.slate, ...typeScale.caption },
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
    exerciseNoteContent: { paddingHorizontal: 20, paddingBottom: 28 },
    exerciseNoteCard: { paddingHorizontal: 14, paddingVertical: 12, minHeight: 156 },
    readOnlyExerciseNote: { color: theme.textPrimary, ...typeScale.body },
    exerciseNoteInput: {
      minHeight: 156,
      paddingVertical: 12,
      textAlignVertical: 'top',
      ...typeScale.body,
    },
    emptySearch: {
      paddingVertical: 28,
      color: dashboardTheme.slate,
      ...typeScale.cardTitle,
      textAlign: 'center',
    },
    emptyState: { alignItems: 'center', paddingHorizontal: 20 },
    composerContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 124, gap: 14 },
    composerTitle: { color: dashboardTheme.ink, ...typeScale.sectionTitle },
    composerDescription: { ...typeScale.body },
    composerCard: { overflow: 'hidden', borderRadius: 16 },
    composerFacetRow: { minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
    composerFacetDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: dashboardTheme.divider },
    composerFacetLabel: { color: dashboardTheme.ink, ...typeScale.label },
    composerFacetValue: { ...typeScale.body },
    composerPreview: { padding: 14, gap: 3 },
    composerPreviewLabel: { color: dashboardTheme.slate, ...typeScale.caption },
    composerPreviewTitle: { color: dashboardTheme.ink, ...typeScale.cardTitle },
    composerPreviewMeta: { ...typeScale.body },
    facetPicker: { padding: 14, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: dashboardTheme.divider, backgroundColor: dashboardTheme.surfaceMuted },
    facetGroup: { gap: 6 },
    facetGroupTitle: { ...typeScale.label, color: dashboardTheme.slate, paddingHorizontal: 2 },
    facetGroupCard: { overflow: 'hidden', borderRadius: 14 },
    facetRow: { minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
    outputChooserContent: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
    outputChoice: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: dashboardTheme.border, borderRadius: 16, backgroundColor: dashboardTheme.surface },
    outputChoiceSelected: { backgroundColor: dashboardTheme.successSurface, borderColor: dashboardTheme.success },
  });
};
