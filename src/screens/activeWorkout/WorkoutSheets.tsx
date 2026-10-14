import type { ExerciseInfoTab, ExerciseInfoReview, ExerciseInfoHeader } from '../../components/exerciseInfo/ExerciseInfoTabs';
import { ForgePressable as Pressable } from '../../components/ui/ForgePressable';
import { scaleUI } from '../../theme/scale';
import { trackingModeLabel } from '../../domain/exercises/tracking';
import { TrackingChoices, type TrackingConfirmation } from './TrackingChoices';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  Button,
  ForgeActionSheet,
  ForgeConfirmationDialog,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeCard,
  ForgeCatalogFilterContent,
  ForgeDurationWheel,
  ForgePickerDefaultAction,
  ForgeEditorBackButton,
  ForgeFloatingCta,
  ForgeSheetHeader,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  HeaderAction,
  Icon,
} from '../../components/ui';
import { forgeSheetHeader } from '../../components/ui/ForgeBottomSheet';
import { useForgeFloatingCtaClearance } from '../../components/ui/ForgeFloatingCta';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';
import type { ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { exerciseCatalogById } from '../../data/exerciseCatalog';
import { useExerciseCatalog } from '../../state/ExerciseCatalogContext';
import { useSettings } from '../../state/SettingsContext';
import { CompletionCheck } from './CompletionCheck';

import { animateLayout, animateSheetContent, lightHaptic, mediumHaptic, selectionHaptic } from './activeWorkoutFeedback';
import type { Workout, WorkoutExercise } from '../../types';
import { ExerciseInfoContent, WarmupSetsContent } from './ExerciseOptionSheets';
import { catalogFacets, filterCatalog, groupCatalogByPrimaryEquipment } from '../../domain/exercises/catalogSelectors';
import { formatCatalogVariation, formatPickerPrimaryEquipment } from '../../domain/exercises/exercisePresentation';
import { isUnilateralExercise } from '../../domain/exercises/laterality';
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

type CatalogMovementData = {
  category: string;
  group: string;
  variations: ExerciseCatalogItem[];
  family: VariationFamily;
  equipmentGroups: { equipment: string; exercises: ExerciseCatalogItem[] }[];
  first: boolean;
  last: boolean;
};
const EMPTY_SELECTION: ReadonlySet<string> = new Set();

type VariationResolution = { direct: ExerciseCatalogItem[]; choices: ResolvedVariation[] };

const EMPTY_CATALOG: ExerciseCatalogItem[] = [];

export const AddExerciseSheet = React.memo(function AddExerciseSheet({
  visible,
  session = 0,
  workoutType,
  selectionLimit,
  title = 'Add exercises',
  persistDerivedExercises = true,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  /** Changes for each opening so the same sheet instance can start cleanly. */
  session?: number;
  /** The active workout or editor type provides a removable initial scope. */
  workoutType?: string;
  /** Replacement uses the same catalogue surface but must choose one movement. */
  selectionLimit?: number;
  title?: string;
  /** Import keeps newly resolved variations in its draft until the atomic save. */
  persistDerivedExercises?: boolean;
  onClose: () => void;
  onSubmit: (exercises: ExerciseCatalogItem[]) => void;
}) {
  const reducedMotion = useForgeReducedMotion();
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
  // The sheet's handle, title, close, and search field are usable the moment it
  // opens. The full-catalogue index build (search + facets) is deferred until the
  // sheet entrance has settled, so a compact loading state fills the list body on
  // first open instead of the entrance waiting on it.
  const [catalogueReady, setCatalogueReady] = useState(false);
  useEffect(() => {
    if (!visible) {
      setCatalogueReady(false);
      return undefined;
    }
    // Yield one frame so the sheet entrance and its header/search paint before
    // the full-catalogue index build runs.
    const frame = requestAnimationFrame(() => setCatalogueReady(true));
    return () => cancelAnimationFrame(frame);
  }, [visible]);
  const projectionCatalog = catalogueReady ? exerciseCatalog : EMPTY_CATALOG;
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
      const scoped = filterCatalog(projectionCatalog, {
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
        options: catalogFacets(projectionCatalog).equipment.map((value) => ({ value, label: value })),
        optionsFor: (draft) => catalogFacets(optionsFor(draft, false)).equipment.map((value) => ({ value, label: value })),
      },
      {
        key: 'exerciseCategories', title: 'Category', icon: 'activity',
        options: [...new Set(projectionCatalog.map((exercise) => exercise.category))].sort().map((value) => ({ value, label: value })),
        optionsFor: (draft) => [...new Set(optionsFor(draft, true).map((exercise) => exercise.category))].sort().map((value) => ({ value, label: value })),
      },
    ];
  }, [projectionCatalog, preferences.workoutTypes]);
  const filteredExercises = useMemo(
    () => filterCatalog(projectionCatalog, {
      query,
      types: filters.types,
      equipment: filters.equipment,
      exerciseCategories: filters.exerciseCategories,
      includeGroupInSearch: false,
    }),
    [projectionCatalog, filters.equipment, filters.exerciseCategories, filters.types, query],
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
  const groupedExercises = useMemo<CatalogMovementData[]>(() => {
    const categories = new Map<string, Map<string, ExerciseCatalogItem[]>>();
    filteredExercises.forEach((exercise) => {
      const groups = categories.get(exercise.category) ?? new Map<string, ExerciseCatalogItem[]>();
      const variations = groups.get(exercise.group) ?? [];
      variations.push(exercise);
      groups.set(exercise.group, variations);
      categories.set(exercise.category, groups);
    });
    return [...categories].flatMap(([category, groups]) =>
      [...groups].map(([group, variations], index) => ({
        category, group, variations,
        family: buildVariationFamily(variations),
        equipmentGroups: groupCatalogByPrimaryEquipment(variations).map(([equipment, exercises]) => ({ equipment, exercises })),
        first: index === 0, last: index === groups.size - 1,
      })),
    );
  }, [filteredExercises]);
  const activeFilterCount = catalogFilterCount(filters);
  const toggleExercise = useCallback((exercise: ExerciseCatalogItem): void => {
    Keyboard.dismiss();
    lightHaptic();
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(exercise.id)) next.delete(exercise.id);
      else {
        if (selectionLimit === 1) next.clear();
        next.add(exercise.id);
      }
      return next;
    });
  }, [selectionLimit]);
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
    animateSheetContent(reducedMotion);
    setExpandedGroup(expanded ? null : key);
    setExpandedEquipment(null);
  }, [reducedMotion]);
  const toggleEquipment = useCallback((key: string, expanded: boolean): void => {
    Keyboard.dismiss();
    selectionHaptic();
    animateSheetContent(reducedMotion);
    setExpandedEquipment(expanded ? null : key);
  }, [reducedMotion]);
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
    if (persistDerivedExercises) unique.filter((exercise) => exercise.id.startsWith('custom-derived-') && !exerciseCatalog.some((item) => item.id === exercise.id)).forEach(addCustomExercise);
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
  }, [addCustomExercise, defaultTypeKey, exerciseCatalog, onSubmit, persistDerivedExercises]);
  const submit = (): void => {
    const direct = exerciseCatalog.filter((exercise) => selected.has(exercise.id));
    const ambiguous: ResolvedVariation[] = [];
    modifierSelections.forEach((ids, familyKey) => {
      const variants = allVariantsByGroup.get(familyKey) ?? [];
      const resolved = resolveVariationPalette(buildVariationFamily(variants), ids);
      if (resolved.length === 1) direct.push(resolved[0].exercise);
      else if (resolved.length > 1) ambiguous.push(...resolved);
    });
    if (selectionLimit === 1 && direct.length + ambiguous.length > 1) {
      setVariationResolution({ direct: [], choices: [...new Map([
        ...direct.map((exercise): ResolvedVariation => ({ exercise, source: exercise.id.startsWith('custom-derived-') ? 'derived' : 'bundled' })),
        ...ambiguous,
      ].map((item) => [item.exercise.id, item])).values()] });
      return;
    }
    if (!ambiguous.length) { commit(direct); return; }
    setVariationResolution({ direct, choices: [...new Map(ambiguous.map((item) => [item.exercise.id, item])).values()] });
  };

  return (
    <>
    <ForgeBottomSheet
      visible={visible}
      onClose={onClose}
      // Clear the picker's own selection state as the exit begins. The shared
      // sheet already notifies the parent synchronously on every close intent,
      // so this no longer needs to force the close itself.
      onCloseStart={reset}
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
      // Ease the surface height when swapping the tall catalogue for the compact
      // filter (and back), so the shrink is a smooth transition, not a jump.
      animateContentLayout
      // The catalogue needs a tall fixed height for its virtualised list; the
      // in-place filter hugs its content so the sheet shrinks to it like the
      // library's own filter sheet instead of leaving a large empty gap.
      style={filtersOpen ? styles.pickerSheetAuto : styles.pickerSheet}
    >
      {(closeSheet) => (
        <>
          {variationResolution ? (
            <ExerciseOutputChooser
              resolution={variationResolution}
              selectionLimit={selectionLimit}
              onBack={() => setVariationResolution(null)}
              onClose={closeSheet}
              onConfirm={(choices) => commit([...variationResolution.direct, ...choices])}
            />
          ) : filtersOpen ? (
            <View style={styles.filterSheetHug}>
              <ForgeCatalogFilterContent
                filters={filters}
                facets={filterFacets}
                headerWithDragHandle
                onBack={() => setFiltersOpen(false)}
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
              title={title}
              compactTitle={selectionLimit === 1}
              autoShrinkTitle={selectionLimit === 1}
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
            keyExtractor={(item) => `${item.category}\u0001${item.group}`}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
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
              <CatalogMovement
                movement={item}
                selectedKey={item.variations.filter((exercise) => selected.has(exercise.id)).map((exercise) => exercise.id).join('\u0001')}
                expanded={expandedGroup === `${item.category}-${item.group}`}
                expandedEquipment={expandedGroup === `${item.category}-${item.group}` ? expandedEquipment : null}
                onToggleExercise={toggleExercise}
                onToggleGroup={toggleGroup}
                onToggleEquipment={toggleEquipment}
                selectedModifiers={modifierSelections.get(`${item.category}\u0001${item.group}`) ?? EMPTY_SELECTION}
                onToggleModifier={toggleModifier}
              />
            )}
            ListEmptyComponent={!catalogueReady ? (
              <View testID="add-exercise-loading" style={styles.emptyState}>
                <ActivityIndicator size="small" color={dashboardTheme.slate} />
              </View>
            ) : !filteredExercises.length ? (
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
            label={selectionLimit === 1 ? 'Choose exercise' : `Add exercises${selected.size + [...modifierSelections.values()].reduce((count, values) => count + values.size, 0) ? ` (${selected.size + [...modifierSelections.values()].reduce((count, values) => count + values.size, 0)})` : ''}`}
            accessibilityLabel="Confirm selected exercises"
            labelStyle={selectionLimit === 1 && (selected.size > 0 || modifierSelections.size > 0) ? { color: theme.textPrimary } : undefined}
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

function ExerciseOutputChooser({ resolution, selectionLimit, onBack, onClose, onConfirm }: {
  resolution: VariationResolution;
  selectionLimit?: number;
  onBack: () => void;
  onClose: () => void;
  onConfirm: (choices: ExerciseCatalogItem[]) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  return <>
    <ForgeBottomSheetHandle />
    <ForgeSheetHeader title={selectionLimit === 1 ? 'Choose one' : 'Choose exercises'} compactTitle autoShrinkTitle={selectionLimit === 1} onClose={onClose} leading={<ForgeEditorBackButton onPress={onBack} accessibilityLabel="Back to exercise choices" />} />
    <FlatList
      testID="variation-output-chooser"
      // Always-full (ADR 0005): fill the fixed-height picker card like the
      // catalogue list, so a long resolved-variation list scrolls instead of
      // sizing to content and clipping under the floating CTA.
      style={styles.pickerList}
      data={resolution.choices}
      keyExtractor={(item) => item.exercise.id}
      contentContainerStyle={[styles.outputChooserContent, { paddingBottom: 124 }]}
      renderItem={({ item }) => {
        const checked = selected.has(item.exercise.id);
        return <Pressable accessibilityRole="checkbox" accessibilityLabel={item.exercise.name} accessibilityState={{ checked }} aria-checked={checked} onPress={() => setSelected((current) => {
          const next = new Set(current); if (next.has(item.exercise.id)) next.delete(item.exercise.id); else { if (selectionLimit === 1) next.clear(); next.add(item.exercise.id); } return next;
        })} style={({ pressed }) => [styles.outputChoice, checked && styles.outputChoiceSelected, pressed && styles.exerciseOptionPressed]}>
          <View style={styles.exerciseOptionCopy}><Text style={styles.groupName}>{item.exercise.name}</Text>{formatCatalogVariation(item.exercise.name, item.exercise.variation) ? <Text style={styles.groupMeta}>{formatCatalogVariation(item.exercise.name, item.exercise.variation)}</Text> : null}</View>
          <CompletionCheck selected={checked} tone="selection" />
        </Pressable>;
      }}
    />
    <ForgeFloatingCta label={selectionLimit === 1 ? 'Use exercise' : `Add exercises${selected.size ? ` (${selected.size + resolution.direct.length})` : ''}`} labelStyle={selectionLimit === 1 && (selected.size > 0 || resolution.direct.length > 0) ? { color: theme.textPrimary } : undefined} accessibilityLabel="Confirm resolved exercises" disabled={!selected.size && !resolution.direct.length} icon="check" tone={selected.size || resolution.direct.length ? 'success' : 'neutral'} theme={theme} onPress={() => onConfirm(resolution.choices.filter((item) => selected.has(item.exercise.id)).map((item) => item.exercise))} />
  </>;
}

const CatalogMovement = React.memo(function CatalogMovement({
  movement,
  selectedKey,
  expanded,
  expandedEquipment,
  onToggleExercise,
  onToggleGroup,
  onToggleEquipment,
  selectedModifiers,
  onToggleModifier,
}: {
  movement: CatalogMovementData;
  selectedKey: string;
  expanded: boolean;
  expandedEquipment: string | null;
  onToggleExercise: (exercise: ExerciseCatalogItem) => void;
  onToggleGroup: (key: string, expanded: boolean) => void;
  onToggleEquipment: (key: string, expanded: boolean) => void;
  selectedModifiers: ReadonlySet<string>;
  onToggleModifier: (familyKey: string, inputId: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { category, group, variations, family, equipmentGroups, first, last } = movement;
  const selected = useMemo(
    () => new Set(selectedKey ? selectedKey.split('\u0001') : []),
    [selectedKey],
  );
  const groupKey = `${category}-${group}`;
  const familyKey = `${category}\u0001${group}`;
  const selectedCount = selected.size + selectedModifiers.size;
  const content = (() => {
    if (variations.length === 1) {
      const exercise = variations[0];
      const isSelected = selected.has(exercise.id);
      return (
        <Pressable
          key={group}
          accessibilityRole="checkbox"
          accessibilityLabel={`${group}, variation`}
          accessibilityState={{ checked: isSelected }}
          aria-checked={isSelected}
          onPress={() => onToggleExercise(exercise)}
          style={({ pressed }) => [
            styles.groupRow,
            styles.singleGroupRow,
            !first && styles.groupRowDivider,
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
            !first && styles.groupRowDivider,
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
        {expanded && hasComposableInputs(family) ? (
          <FacetPickerRows
            family={family}
            familyKey={familyKey}
            selected={selectedModifiers}
            onToggle={onToggleModifier}
          />
        ) : null}
        {expanded &&
          hasComposableInputs(family) &&
          family.standalone.map((exercise) => {
            const isSelected = selected.has(exercise.id);
            return (
              <Pressable
                key={exercise.id}
                accessibilityRole="checkbox"
                accessibilityLabel={`${group}, ${exercise.name}`}
                accessibilityState={{ checked: isSelected }}
                aria-checked={isSelected}
                onPress={() => onToggleExercise(exercise)}
                style={({ pressed }) => [
                  styles.subVariationRow,
                  isSelected && styles.subVariationRowSelected,
                  pressed && styles.exerciseOptionPressed,
                ]}
              >
                <View style={styles.exerciseOptionCopy}>
                  <Text style={styles.variationName}>{exercise.name}</Text>
                  {formatCatalogVariation(exercise.name, exercise.variation) ? (
                    <Text style={styles.equipmentMeta}>
                      {formatCatalogVariation(exercise.name, exercise.variation)}
                    </Text>
                  ) : null}
                </View>
                <CompletionCheck
                  selected={isSelected}
                  tone="selection"
                  testID={`exercise-selection-${exercise.id}`}
                />
              </Pressable>
            );
          })}
        {expanded && !hasComposableInputs(family) &&
          equipmentGroups.map(({ equipment, exercises }) => {
            const equipmentSelectedCount = exercises.filter((exercise) =>
              selected.has(exercise.id),
            ).length;
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
                  aria-checked={isSelected}
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
                  style={({ pressed }) => [
                    styles.equipmentRow,
                    pressed && styles.exerciseOptionPressed,
                  ]}
                >
                  <View style={styles.exerciseOptionCopy}>
                    <Text style={styles.equipmentName}>{equipment}</Text>
                    <Text style={styles.equipmentMeta}>{exercises.length} variations</Text>
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
                    const isSelected = selected.has(exercise.id);
                    const label =
                      formatCatalogVariation(exercise.name, exercise.variation) || exercise.name;
                    return (
                      <Pressable
                        key={exercise.id}
                        accessibilityRole="checkbox"
                        accessibilityLabel={`${group}, ${equipment}, ${label}`}
                        accessibilityState={{ checked: isSelected }}
                        aria-checked={isSelected}
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
  })();
  return (
    <View>
      {first ? <Text style={styles.categoryTitle}>{category}</Text> : null}
      <View
        style={[
          styles.categoryCard,
          styles.categorySegment,
          first && styles.categoryFirst,
          last && styles.categoryLast,
        ]}
      >
        {content}
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
      <ForgeCard variant="nested" style={styles.facetGroupCard}>
        {inputs.map((input, index) => {
          const checked = selected.has(input.id);
          return <Pressable key={input.id} accessibilityRole="checkbox" accessibilityLabel={`${family.group}, ${input.label}`} accessibilityState={{ checked }} aria-checked={checked} onPress={() => onToggle(familyKey, input.id)} style={({ pressed }) => [styles.facetRow, index > 0 && styles.groupRowDivider, checked && styles.subVariationRowSelected, pressed && styles.exerciseOptionPressed]}>
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
  // A plain icon swap, not a Reanimated rotate. The catalogue can show ~150 of
  // these at once for a large category, and mounting that many worklet-backed
  // animated views is what made the picker open with a visible lag.
  return <Icon name={expanded ? 'chevron-down' : 'chevron-forward'} size={18} color={theme.slate} />;
}

function AnimatedCount({ count }: { count: number }) {
  const styles = useThemedStyles(createStyles);
  return (
    <Text style={[styles.groupCountText, count > 0 && styles.groupCountTextActive]}>{count}</Text>
  );
}

export function ExerciseOptionsSheet({
  onTrackingChange,
  resolveTrackingSelection = false,
  visible,
  exercise,
  onClose,
  onClosed,
  onEditNote,
  onOpenPreviousSessions,
  addWarmupSets,
  onOpenExerciseInfo,
  onOpenWorkout,
  excludeWorkoutId,
  readOnly = false,
  completedWorkouts = [],
  onRemove,
  onReplaceExercise,
  onToggleOffSession,
  enterInstant = false,
}: {
  onTrackingChange?: (mode: import('../../types').TrackingType, confirmed?: boolean) => void | Promise<import('../../domain/exercises/trackingChanges').TrackingChangeResult>;
  resolveTrackingSelection?: boolean;
  visible: boolean;
  exercise: WorkoutExercise;
  onClose: () => void;
  /** Fires once the sheet has fully dismissed; use to present a follow-up modal. */
  onClosed?: () => void;
  onEditNote?: (note: string) => void;
  onOpenPreviousSessions?: () => void;
  /** Present when warm-up ramps apply; opens an in-place warm-up view. */
  addWarmupSets?: (sets: readonly { weight: string; reps: string }[]) => void;
  onOpenExerciseInfo?: () => void;
  onOpenWorkout?: (workoutId: string) => void;
  excludeWorkoutId?: string;
  readOnly?: boolean;
  completedWorkouts?: readonly Workout[];
  onRemove?: () => void;
  onReplaceExercise?: () => void;
  /** Toggle the per-exercise off-session stamp (kept in history, counts for nothing). */
  onToggleOffSession?: () => void;
  /** Restore the sheet already open when returning from a pushed workout. */
  enterInstant?: boolean;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useForgeReducedMotion();
  const { preferences, updatePreferences } = useSettings();
  const [view, setView] = useState<
    'actions' | 'note' | 'history' | 'info' | 'rest' | 'rest-unilateral' | 'warmup' | 'tracking'
  >('actions');
  // Cross-fade each view's content while the surface height eases (ADR 0005 /
  // .agents/rules/design Motion): a hierarchical drill-in, never a lateral slide.
  const viewEntering = reducedMotion ? undefined : FadeIn.duration(forgeMotion.state);
  const viewExiting = reducedMotion ? undefined : FadeOut.duration(forgeMotion.feedback);
  const [trackingConfirmation, setTrackingConfirmation] = useState<TrackingConfirmation | null>(null);
  const [noteDraft, setNoteDraft] = useState(exercise.note ?? '');
  const [noteHeight, setNoteHeight] = useState(156);
  const [infoReview, setInfoReview] = useState<ExerciseInfoReview>({});
  const [infoTab, setInfoTab] = useState<ExerciseInfoTab>('info');
  const [infoHeader, setInfoHeader] = useState<ExerciseInfoHeader | null>(null);
  const pendingWorkoutIdRef = useRef<string | null>(null);
  // Each fresh open starts on the action list. The parent now defers this
  // sheet's unmount past its slide-out (and cancels it on a quick reopen), so
  // the component can survive a close/reopen — reset the sub-view here on open
  // instead of relying on the unmount, or a fast reopen would show a stale view.
  // `enterInstant` marks a restore (returning from a pushed prior session), which
  // deliberately keeps its sub-view, so it is left untouched.
  useEffect(() => {
    if (visible && !enterInstant) { setView('actions'); setInfoTab('info'); setInfoReview({}); }
  }, [visible, enterInstant]);

  // Per-exercise rest override, editable from Exercise info. Match the read path
  // in ActiveWorkoutScreen.restDurationForExercise.
  const restKey = exercise.exerciseId ?? exercise.exerciseSnapshot?.id ?? exercise.id;
  const restOverride = preferences.exerciseRestSeconds[restKey];
  // The wheel sets the override live as it settles (like the live-workout Rest
  // picker); "Default" clears it and steps back to the info card.
  const applyRest = (seconds: number | undefined): void => {
    const next = { ...preferences.exerciseRestSeconds };
    if (seconds === undefined) delete next[restKey];
    else next[restKey] = seconds;
    updatePreferences({ exerciseRestSeconds: next });
  };
  // Unilateral exercises additionally carry a between-sides rest and a leading
  // side, both editable here and both keyed by the same exercise identity.
  // Match the exercise card's robust detection: fall back to the live catalog so
  // a legacy snapshot without laterality still surfaces the unilateral options.
  const unilateral = isUnilateralExercise(exercise)
    || exerciseCatalogById.get(exercise.exerciseId ?? '')?.laterality === 'unilateral';
  const unilateralRestOverride = preferences.exerciseUnilateralRestSeconds[restKey];
  const applyUnilateralRest = (seconds: number | undefined): void => {
    const next = { ...preferences.exerciseUnilateralRestSeconds };
    if (seconds === undefined) delete next[restKey];
    else next[restKey] = seconds;
    updatePreferences({ exerciseUnilateralRestSeconds: next });
  };
  const leadSide = preferences.exerciseLeadSide[restKey] ?? 'left';
  const toggleLeadSide = (): void => {
    selectionHaptic();
    updatePreferences({
      exerciseLeadSide: { ...preferences.exerciseLeadSide, [restKey]: leadSide === 'left' ? 'right' : 'left' },
    });
  };

  const commitNote = (): void => {
    onEditNote?.(noteDraft.trim());
  };
  const openView = (
    nextView: 'note' | 'history' | 'info' | 'rest' | 'rest-unilateral' | 'warmup' | 'tracking',
  ): void => {
    // These destinations replace the action list in one Forge sheet. The
    // keyed-fragment remount cross-fades each view's content (its Animated root)
    // while ForgeActionSheet's animateContentLayout eases the surface height.
    animateSheetContent(reducedMotion);
    setView(nextView);
  };
  const close = (): void => {
    if (view === 'note') commitNote();
    const pendingWorkoutId = pendingWorkoutIdRef.current;
    pendingWorkoutIdRef.current = null;
    // A React Native Modal always sits above a native-stack screen. Complete
    // its close before pushing, otherwise the previous-sessions card remains
    // physically in front of the destination despite navigation succeeding.
    if (pendingWorkoutId) {
      onOpenWorkout?.(pendingWorkoutId);
      return;
    }
    onClose();
  };
  const backToActions = (): void => {
    commitNote();
    animateSheetContent(reducedMotion);
    setView('actions');
  };

  return (
    <ForgeActionSheet
      visible={visible}
      enterInstant={enterInstant}
      onClose={close}
      onClosed={onClosed}
      accessibilityLabel="Close options"
      title="Exercise options"
      dragEnabled={!trackingConfirmation}
      onBackRequest={() => {
        if (infoHeader && (view === 'info' || view === 'history')) { infoHeader.onBack(); return true; }
        if (!trackingConfirmation) return false;
        trackingConfirmation.onCancel();
        return true;
      }}
      overlay={trackingConfirmation ? (
        <ForgeConfirmationDialog
          presentation="embedded"
          visible
          title="Discard current sets?"
          message={`Switch to ${trackingModeLabel(trackingConfirmation.mode)} with three empty sets. All current set values, targets and completion will be discarded.`}
          cancelLabel="Keep current tracking"
          confirmLabel="Discard sets"
          busy={trackingConfirmation.busy}
          error={trackingConfirmation.error}
          onCancel={trackingConfirmation.onCancel}
          onConfirm={trackingConfirmation.onConfirm}
          testID="discard-tracking-confirmation"
        />
      ) : undefined}
      initialOffset={420}
      closeDistance={520}
      dismissThreshold={260}
      // This sheet eases its own height with LayoutAnimation (animateSheetContent)
      // as it swaps the action list for a taller sub-view, so it must NOT also run
      // ForgeActionSheet's reanimated layout — the two fought and left a shorter
      // view (e.g. back on the action list) sitting low with dead space.
      animateContentLayout={false}
      actions={[
        ...(!readOnly && onTrackingChange
          ? [
              {
                icon: 'measure' as const,
                label: 'Tracking',
                dismiss: false,
                onPress: () => openView('tracking'),
              },
            ]
          : []),
        ...((onEditNote || (readOnly && exercise.note?.trim())) ? [{
          icon: 'note' as const,
          label: readOnly ? 'View note' : exercise.note?.trim() ? 'Edit note' : 'Add note',
          dismiss: false,
          onPress: () => openView('note'),
        }] : []),
        ...(onOpenPreviousSessions ? [{ icon: 'history' as const, label: 'Previous sessions', dismiss: false, onPress: () => { setInfoTab('history'); openView('history'); } }] : []),
        ...(addWarmupSets ? [{ icon: 'temperature-sun' as const, label: 'Warm-up sets', dismiss: false, onPress: () => openView('warmup') }] : []),
        ...(onOpenExerciseInfo ? [{ icon: 'info' as const, label: 'Exercise info', dismiss: false, onPress: () => { setInfoTab('info'); openView('info'); } }] : []),
        ...(!readOnly && onReplaceExercise ? [{ icon: 'replace' as const, label: 'Replace exercise', onPress: onReplaceExercise }] : []),
        ...(!readOnly && onToggleOffSession ? [{
          icon: exercise.offSession ? ('notes' as const) : ('notes-off' as const),
          label: exercise.offSession ? 'Count in session' : 'Mark off-session',
          accessibilityLabel: exercise.offSession
            ? `Count ${exercise.name} in this session`
            : `Mark ${exercise.name} as done off-session`,
          onPress: onToggleOffSession,
        }] : []),
        ...(!readOnly && onRemove ? [{
          icon: 'trash' as const,
          label: 'Remove exercise',
          accessibilityLabel: `Remove ${exercise.name}`,
          tone: 'destructive' as const,
          onPress: onRemove,
        }] : []),
      ]}
      replacement={
        view !== 'actions'
          ? (closeSheet) => (
              <React.Fragment key={view}>
                <ForgeBottomSheetHandle />
                <ForgeSheetHeader
                  title={(view === 'info' || view === 'history') && infoHeader ? infoHeader.title :
                    view === 'tracking'
                      ? 'Tracking'
                      : view === 'note' ? 'Exercise note' : view === 'history' ? 'Exercise info' : view === 'rest' ? 'Duration' : view === 'rest-unilateral' ? 'Side rest' : view === 'warmup' ? 'Warm-up sets' : 'Exercise info'
                  }
                  // The Duration views drop the close X and give their right slot to
                  // Default; Back returns to the info card and the sheet closes there.
                  onClose={view === 'rest' || view === 'rest-unilateral' ? undefined : closeSheet}
                  closeAccessibilityLabel={`Close ${view === 'tracking' ? 'tracking' : view === 'note' ? 'exercise note' : view === 'history' ? 'exercise info' : view === 'warmup' ? 'warm-up sets' : 'exercise info'}`}
                  leading={(view === 'info' || view === 'history') && infoHeader
                ? <ForgeEditorBackButton onPress={infoHeader.onBack} accessibilityLabel={infoHeader.backLabel} disabled={infoHeader.backDisabled} /> :
              view === 'rest' || view === 'rest-unilateral'
                ? <ForgeEditorBackButton onPress={() => openView('info')} accessibilityLabel="Back to exercise info" />
                : <ForgeEditorBackButton onPress={backToActions} accessibilityLabel="Back to exercise options" />
            }
                  trailing={
              (view === 'rest' || view === 'rest-unilateral') && !readOnly ? (
                <ForgePickerDefaultAction
                  accessibilityLabel={view === 'rest-unilateral' ? 'Use default between-sides rest' : 'Use default rest time'}
                  icon="time-outline"
                  haptic="none"
                  onPress={() => { (view === 'rest-unilateral' ? applyUnilateralRest : applyRest)(undefined); openView('info'); }}
                />
              ) : undefined
            }
                />
                {view === 'tracking' && onTrackingChange ? (
                  <TrackingChoices
                    exercise={exercise}
                    onSelect={onTrackingChange}
                    onApplied={closeSheet}
                    resolveSelection={resolveTrackingSelection}
                    onConfirmationChange={resolveTrackingSelection ? setTrackingConfirmation : undefined}
                  />
                ) : null}
                {view === 'info' || view === 'history' ? (
            <ExerciseInfoContent
              exercise={exercise}
              workouts={completedWorkouts}
              excludeWorkoutId={excludeWorkoutId}
              review={infoReview}
              onReviewChange={setInfoReview}
              onHeaderChange={setInfoHeader}
              tab={infoTab}
              onTabChange={setInfoTab}
              onOpenWorkout={(workoutId) => { pendingWorkoutIdRef.current = workoutId; closeSheet(); }}
              onPressRest={readOnly ? undefined : () => openView('rest')}
              unilateral={unilateral}
              leadSide={leadSide}
              unilateralRestOverride={unilateralRestOverride}
              onPressUnilateralRest={readOnly ? undefined : () => openView('rest-unilateral')}
              onToggleLeadSide={readOnly ? undefined : toggleLeadSide}
            />
          ) : null}
                {view === 'warmup' && addWarmupSets ? (
            <WarmupSetsContent
              exercise={exercise}
              workouts={completedWorkouts}
              onAdd={(sets) => {
                addWarmupSets(sets);
                // Close the whole options sheet so the user lands back on the
                // workout with the just-added warm-up sets visible, rather than
                // returning to the action list.
                closeSheet();
              }}
            />
          ) : null}
                {view === 'rest' ? (
            // The wheel must measure against a settled frame to land on the
            // selected row: a reserved min-height plus a plain (non-entering)
            // container, exactly like the settings/library duration wheels. A
            // FadeIn/exiting wrapper here left the drum pinned at the top.
            <View style={styles.restPickerContent}>
              <ForgeDurationWheel
                selectedDuration={restOverride ?? preferences.defaultRestSeconds}
                onSelect={applyRest}
              />
            </View>
          ) : null}
                {view === 'rest-unilateral' ? (
            <View style={styles.restPickerContent}>
              <ForgeDurationWheel
                selectedDuration={unilateralRestOverride ?? preferences.defaultUnilateralRestSeconds}
                onSelect={applyUnilateralRest}
              />
            </View>
          ) : null}
                {view === 'note' && readOnly ? <ExerciseNoteView note={exercise.note ?? ''} /> : null}
                {view === 'note' && !readOnly ? <Animated.View style={styles.exerciseNoteContent} entering={viewEntering} exiting={viewExiting}>
            <ForgeCard variant="nested" style={styles.exerciseNoteCard}>
              <TextInput
                accessibilityLabel="Exercise note"
                value={noteDraft}
                onChangeText={setNoteDraft}
                // Taps inside the field reposition the cursor; keep them from
                // bubbling to the sheet's tap-to-dismiss-keyboard handler.
                onTouchStart={(event) => event.stopPropagation()}
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
          </Animated.View> : null}
              </React.Fragment>
            )
          : null
      }
    />
  );
}

function ExerciseNoteView({ note }: { note: string }) {
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useForgeReducedMotion();
  return (
    <Animated.View
    style={styles.exerciseNoteContent}
    entering={reducedMotion ? undefined : FadeIn.duration(forgeMotion.state)}
    exiting={reducedMotion ? undefined : FadeOut.duration(forgeMotion.feedback)}
  >
      <ForgeCard variant="nested" style={styles.exerciseNoteCard}>
        <Text style={styles.readOnlyExerciseNote}>{note}</Text>
      </ForgeCard>
    </Animated.View>
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
    // The in-place filter view hugs its content, so the sheet drops its fixed
    // catalogue height and shrinks to fit (eased by animateContentLayout).
    pickerSheetAuto: {
      width: '100%',
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
    // Counteract the sheet's own padding so the hugging filter rows span full
    // width and its docked Apply sits at the sheet's bottom edge, like the library.
    filterSheetHug: { alignSelf: 'stretch', marginHorizontal: -20, marginBottom: -12 },
    pickerTitle: { color: dashboardTheme.ink, ...typeScale.headerTitle },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    searchField: {
      flex: 1,
      minWidth: 0,
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      // Dark (reference, unchanged): surfaceMuted fill, no border. Light: elevated fill
      // + visible border so the field reads on the sheet surface (its muted fill blended).
      ...(dashboardTheme.colorScheme === 'light'
        ? { borderWidth: 1, borderColor: dashboardTheme.border, backgroundColor: dashboardTheme.surfaceElevated }
        : { backgroundColor: dashboardTheme.surfaceMuted }),
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
      minWidth: 0,
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
    categorySegment: { borderTopWidth: 0, borderBottomWidth: 0, borderRadius: 0 },
    categoryFirst: { borderTopWidth: 1, borderTopLeftRadius: 13, borderTopRightRadius: 13 },
    categoryLast: { borderBottomWidth: 1, borderBottomLeftRadius: 13, borderBottomRightRadius: 13 },
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
      // Dark (reference, unchanged): surfaceMuted. Light: one clean elevated tone so the
      // expanded region isn't a third grey — muted is reserved there for the selected
      // state, giving surface header -> white list -> grey selection.
      backgroundColor: dashboardTheme.colorScheme === 'light' ? dashboardTheme.surfaceElevated : dashboardTheme.surfaceMuted,
    },
    equipmentRowSelected: {
      backgroundColor: dashboardTheme.successSurface,
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
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: dashboardTheme.divider,
      backgroundColor: dashboardTheme.surfaceElevated,
    },
    subVariationRowSelected: {
      backgroundColor: dashboardTheme.successSurface,
      borderColor: dashboardTheme.selectionIndicator,
    },
    variationName: {
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
    // Center the name/subtitle block within the row. alignSelf 'center' keeps the
    // copy hugging its own content (so a single-line name is centred, not pinned
    // to the top of the taller two-line rows); justifyContent centers it if a
    // platform stretches the flex child to the full row height.
    exerciseOptionCopy: { flex: 1, gap: 2, alignSelf: 'center', justifyContent: 'center' },
    exerciseOptionName: { color: dashboardTheme.ink, ...typeScale.cardTitle },
    exerciseOptionEquipment: { color: theme.textSecondary, ...typeScale.label },
    // A reserved min-height (matching the settings/library duration sheets) gives
    // the wheel a stable frame from the first render so it positions on the
    // selected row rather than measuring mid-entrance.
    restPickerContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, minHeight: 400 },
    restChoiceCard: { overflow: 'hidden', borderRadius: 16 },
    exerciseNoteContent: { paddingHorizontal: 20, paddingBottom: scaleUI(32) },
    exerciseNoteCard: { paddingHorizontal: 14, paddingVertical: 12, minHeight: 156 },
    readOnlyExerciseNote: { color: theme.textPrimary, ...typeScale.body },
    exerciseNoteInput: {
      minHeight: 156,
      // The card already owns the vertical padding; adding it here too pushed
      // the note text noticeably down from the top.
      paddingVertical: 0,
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
    facetRow: { minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    outputChooserContent: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
    outputChoice: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: dashboardTheme.surface },
    outputChoiceSelected: { backgroundColor: dashboardTheme.successSurface, borderColor: dashboardTheme.success },
  });
};
