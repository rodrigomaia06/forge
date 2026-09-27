import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
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
  Button,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeBackButton,
  ForgeCard,
  ForgeCatalogFilterSheet,
  ForgeFloatingCta,
  ForgeSearchField,
  ForgeSheetHeader,
  ForgeSingleSelectList,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  HeaderAction,
  Icon,
  lightHaptic,
  mediumHaptic,
  pressedFeedback,
  selectionHaptic,
} from '../../components/ui';
import { useForgeFloatingCtaClearance } from '../../components/ui/ForgeFloatingCta';
import { ExerciseDetailBody } from '../../components/ExerciseDetailBody';
import {
  catalogFilterCount,
  emptyCatalogFilters,
  type CatalogFilterFacet,
  type CatalogFilterState,
} from '../../components/ui';
import { forgeSheetHeader } from '../../components/ui/ForgeBottomSheet';
import type { ForgeSingleSelectOption } from '../../components/ui';
import { catalogTaxonomies, taxonomyLabel, type ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { useExerciseCatalog } from '../../state/ExerciseCatalogContext';
import { useSettings } from '../../state/SettingsContext';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';
import type { IconName, RootStackParamList } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { workoutTypeIcon } from './workoutTypeIcon';
import {
  catalogFacets,
  filterCatalog,
  groupCatalogByMovement,
} from '../../domain/exercises/catalogSelectors';
import { formatCatalogVariation } from '../../domain/exercises/exercisePresentation';
import { REST_DURATION_OPTIONS } from '../../domain/rest/restDurationOptions';
import { shareItem } from '../../utils/shareItem';
import { SettingsRow, SettingsSection, settingsLayout } from './SettingsRow';

type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseBrowser'>;
type DetailSheetView = 'details' | 'restTime' | 'options';
type ExerciseFormView =
  | 'details'
  | 'category'
  | 'family'
  | 'equipment'
  | 'customEquipment'
  | 'workoutTypes'
  | 'primaryMuscle'
  | 'secondaryMuscles';
type CatalogSource = 'forge' | 'custom';

function formatPickerDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function customVariationFacets(value: string): import('../../types').ExerciseVariationFacets | undefined {
  const words = value.toLocaleLowerCase().split(/[^a-z]+/).filter(Boolean);
  const pick = (...choices: string[]) => choices.find((choice) => words.includes(choice));
  const load = pick('weighted', 'assisted');
  const grip = pick('pronated', 'supinated', 'neutral');
  const stance = pick('wide', 'narrow', 'close');
  const setup = pick('kneeling', 'standing', 'seated', 'lying', 'incline', 'decline');
  const laterality = pick('unilateral', 'alternating');
  const facets = { ...(load ? { load } : {}), ...(grip ? { grip } : {}), ...(stance ? { stance } : {}), ...(setup ? { setup } : {}), ...(laterality ? { laterality } : {}) };
  return Object.keys(facets).length ? facets : undefined;
}

const restTimeOptions: readonly ForgeSingleSelectOption<number>[] = REST_DURATION_OPTIONS.map(
  (seconds) => ({
    value: seconds,
    label: formatPickerDuration(seconds),
    accessibilityLabel: `Rest duration ${formatPickerDuration(seconds)}`,
  }),
);
const swipeSpring = forgeMotion.swipeSpring;
const EMPTY_ITEMS: ExerciseCatalogItem[] = [];

export function ExerciseBrowserScreen({ navigation, route }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  const styles = useThemedStyles(createStyles);
  const { height: viewportHeight } = useWindowDimensions();
  const floatingCtaClearance = useForgeFloatingCtaClearance();
  const { preferences, updatePreferences } = useSettings();
  const catalog = useExerciseCatalog();
  const fixedTypeId = route.params?.workoutTypeId;
  const customOnly = route.params?.custom === true;
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [filters, setFilters] = useState<CatalogFilterState>(emptyCatalogFilters());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [headerElevated, setHeaderElevated] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formParent, setFormParent] = useState<string | null | undefined>(undefined);
  const [formView, setFormView] = useState<ExerciseFormView>('details');
  const [selectorQuery, setSelectorQuery] = useState('');
  const deferredSelectorQuery = useDeferredValue(selectorQuery);
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [categorySource, setCategorySource] = useState<CatalogSource | null>(null);
  const [equipmentValues, setEquipmentValues] = useState<string[]>(['Bodyweight']);
  const [equipmentDraft, setEquipmentDraft] = useState<string[]>(['Bodyweight']);
  const [primaryMuscle, setPrimaryMuscle] = useState('Accessories');
  const [exerciseCategory, setExerciseCategory] = useState('Full Body');
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);
  const [workoutTypeIds, setWorkoutTypeIds] = useState<string[]>(['strength']);
  const [editing, setEditing] = useState<ExerciseCatalogItem | null>(null);
  const [detail, setDetail] = useState<ExerciseCatalogItem | null>(null);
  const [detailSheetView, setDetailSheetView] = useState<DetailSheetView>('details');
  const savingVariation = useRef(false);
  const source = customOnly ? catalog.customExercises : catalog.exercises;
  // The header, Back, and search field mount immediately. The full-catalogue
  // index build (search + facets) is deferred until the drill-in push settles,
  // so first entry shows a compact loading state in the list body rather than
  // blocking the navigation transition.
  const [bodyReady, setBodyReady] = useState(false);
  useEffect(() => {
    // Yield one frame so the drill-in push and screen shell paint before the
    // full-catalogue index build runs, then never gate on it again.
    const frame = requestAnimationFrame(() => setBodyReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const projectionSource = bodyReady ? source : EMPTY_ITEMS;
  const forgeCatalogSource = bodyReady ? catalog.exercises : EMPTY_ITEMS;
  const title = customOnly
    ? 'Custom exercises'
    : (preferences.workoutTypes.find((item) => item.id === fixedTypeId)?.name ?? 'All exercises');
  const visibleTypes = preferences.workoutTypes.filter((item) => !item.hidden);
  const active = catalogFilterCount(filters);
  const filtered = useMemo(
    () =>
      filterCatalog(projectionSource, {
        query: deferredQuery,
        types: filters.types,
        equipment: filters.equipment,
        exerciseCategories: filters.exerciseCategories,
        includeGroupInSearch: true,
      }).filter((item) => !fixedTypeId || item.workoutTypeIds.includes(fixedTypeId)),
    [projectionSource, fixedTypeId, filters, deferredQuery],
  );
  const groups = useMemo(() => groupCatalogByMovement(filtered), [filtered]);
  const { equipment } = catalogFacets(projectionSource);
  const { equipment: forgeEquipment } = catalogFacets(forgeCatalogSource);
  const { categories: muscles } = catalogFacets(forgeCatalogSource);
  const filterFacets = useMemo<CatalogFilterFacet[]>(() => {
    const scoped = (draft: CatalogFilterState, includeEquipment: boolean) =>
      filterCatalog(projectionSource, {
        types: fixedTypeId ? [fixedTypeId] : draft.types,
        equipment: includeEquipment ? draft.equipment : [],
        includeGroupInSearch: false,
      });
    const typeFacet: CatalogFilterFacet = {
      key: 'types',
      title: 'Workout type',
      icon: 'layers',
      options: visibleTypes.map((item) => ({ value: item.id, label: item.name })),
      readOnly: Boolean(fixedTypeId),
    };
    const common: CatalogFilterFacet[] = [
      {
        key: 'equipment', title: 'Equipment', icon: 'fitness-outline',
        options: equipment.map((value) => ({ value, label: value })),
        optionsFor: (draft) => catalogFacets(scoped(draft, false)).equipment.map((value) => ({ value, label: value })),
      },
      {
        key: 'exerciseCategories', title: 'Category', icon: 'activity',
        options: [...new Set(projectionSource.map((item) => item.category))].sort().map((value) => ({ value, label: value })),
        optionsFor: (draft) => [...new Set(scoped(draft, true).map((item) => item.category))].sort().map((value) => ({ value, label: value })),
      },
    ];
    return [typeFacet, ...common];
  }, [equipment, fixedTypeId, projectionSource, visibleTypes]);
  const editableFilterFacets = useMemo(
    () => filterFacets.filter((facet) => !facet.readOnly),
    [filterFacets],
  );
  // A new custom exercise can choose from the full Forge catalogue even when
  // this browser is scoped to an empty custom-only source.
  const forgeEquipmentOptions = forgeEquipment;
  const customEquipmentOptions = useMemo(
    () => catalogFacets(catalog.customExercises).equipment,
    [catalog.customExercises],
  );
  const equipmentOptions = useMemo(
    // Bodyweight is a first-class default for a new custom exercise even
    // though the imported catalogue expresses it as no equipment.
    () => Array.from(new Set(['Bodyweight', ...forgeEquipmentOptions, ...customEquipmentOptions])),
    [customEquipmentOptions, forgeEquipmentOptions],
  );
  const forgeCategoryOptions = useMemo(
    () => Array.from(new Set(catalog.exercises.map((item) => item.group))),
    [catalog.exercises],
  );
  const customCategoryOptions = useMemo(
    () => Array.from(new Set(catalog.customExercises.map((item) => item.group))),
    [catalog.customExercises],
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set([...forgeCategoryOptions, ...customCategoryOptions])).sort(),
    [customCategoryOptions, forgeCategoryOptions],
  );
  const taxonomyCategoryOptions = useMemo(
    () =>
      catalogTaxonomies.categories.flatMap((value) =>
        typeof value === 'string' ? [] : [value.label],
      ),
    [],
  );
  const formEquipment = useMemo(() => {
    if (!formParent) return [];
    return Array.from(
      new Set(
        [...catalog.exercises, ...catalog.customExercises]
          .filter((item) => item.group === formParent)
          .map((item) => item.equipment),
      ),
    );
  }, [catalog.customExercises, catalog.exercises, formParent]);
  const selectableEquipment = formParent ? formEquipment : equipmentOptions;
  const equipmentValue = equipmentValues[0] ?? 'Bodyweight';
  const usesCustomEquipment = equipmentValues.some((value) => !selectableEquipment.includes(value));
  const sourceForCategory = (value: string): CatalogSource =>
    forgeCategoryOptions.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())
      ? 'forge'
      : 'custom';
  const sourceForEquipment = (value: string): CatalogSource =>
    value === 'Bodyweight' || forgeEquipmentOptions.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())
      ? 'forge'
      : 'custom';
  const categoryMatches = useMemo(() => {
    const query = group.trim().toLocaleLowerCase();
    return query
      ? categoryOptions
          .filter((item) => item.toLocaleLowerCase().includes(query))
          .slice(0, 5)
          .map((item) => ({ label: item, source: sourceForCategory(item) }))
      : [];
  }, [categoryOptions, forgeCategoryOptions, group]);
  const isExistingCategory = categoryOptions.some(
    (item) => item.toLocaleLowerCase() === group.trim().toLocaleLowerCase(),
  );
  const filteredCategoryOptions = useMemo(() => {
    const normalized = deferredSelectorQuery.trim().toLocaleLowerCase();
    return normalized
      ? taxonomyCategoryOptions.filter((item) => item.toLocaleLowerCase().includes(normalized))
      : taxonomyCategoryOptions;
  }, [deferredSelectorQuery, taxonomyCategoryOptions]);
  const filteredEquipmentOptions = useMemo(() => {
    const normalized = deferredSelectorQuery.trim().toLocaleLowerCase();
    return normalized
      ? selectableEquipment.filter((item) => item.toLocaleLowerCase().includes(normalized))
      : selectableEquipment;
  }, [selectableEquipment, deferredSelectorQuery]);
  const isCustom = useCallback(
    (item: ExerciseCatalogItem) => catalog.customExercises.some((custom) => custom.id === item.id),
    [catalog.customExercises],
  );
  const restOverride = (item: ExerciseCatalogItem) =>
    isCustom(item) ? item.restSeconds : preferences.exerciseRestSeconds[item.id];
  const restLabel = (item: ExerciseCatalogItem) => {
    const value = restOverride(item);
    return value === undefined
      ? 'Default'
      : `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  };
  const openCreate = useCallback((parent: string | null) => {
    lightHaptic();
    savingVariation.current = false;
    const inherited = parent
      ? [...catalog.exercises, ...catalog.customExercises].find((item) => item.group === parent)
      : undefined;
    setEditing(null);
    setFormView('details');
    setShowOptionalDetails(false);
    setName('');
    setGroup(parent ?? '');
    setCategorySource(parent
      ? (forgeCategoryOptions.some((item) => item.toLocaleLowerCase() === parent.toLocaleLowerCase()) ? 'forge' : 'custom')
      : null);
    const nextEquipment = inherited?.equipmentIds?.length
      ? inherited.equipmentIds.map((value) => taxonomyLabel('equipment', value))
      : [inherited?.primaryEquipment ?? inherited?.equipment ?? 'Bodyweight'];
    setEquipmentValues(nextEquipment);
    setEquipmentDraft(nextEquipment);
    setPrimaryMuscle(inherited?.primaryMuscle ?? 'Accessories');
    setExerciseCategory(inherited?.category ?? 'Full Body');
    setSecondaryMuscles(inherited?.secondaryMuscles ?? []);
    setWorkoutTypeIds(inherited?.workoutTypeIds ?? (fixedTypeId ? [fixedTypeId] : ['strength']));
    setFormParent(parent);
  }, [catalog.exercises, catalog.customExercises, fixedTypeId, forgeCategoryOptions]);
  const handleToggleMovement = useCallback((movement: string) => {
    selectionHaptic();
    setExpanded((current) => (current === movement ? null : movement));
  }, []);
  const handleOpenExercise = useCallback((item: ExerciseCatalogItem) => {
    setDetailSheetView('details');
    setDetail(item);
  }, []);
  const handleRemoveExercise = useCallback(
    (item: ExerciseCatalogItem) => catalog.removeCustomExercise(item.id),
    [catalog],
  );
  const openEdit = (item: ExerciseCatalogItem) => {
    lightHaptic();
    savingVariation.current = false;
    setDetail(null);
    setFormView('details');
    setEditing(item);
    setName(item.variation || item.name);
    setShowOptionalDetails(true);
    setGroup(item.group);
    setCategorySource(sourceForCategory(item.group));
    const nextEquipment = item.equipmentIds?.length
      ? item.equipmentIds.map((value) => taxonomyLabel('equipment', value))
      : [item.primaryEquipment ?? item.equipment];
    setEquipmentValues(nextEquipment);
    setEquipmentDraft(nextEquipment);
    setPrimaryMuscle(item.primaryMuscle);
    setExerciseCategory(item.category);
    setSecondaryMuscles(item.secondaryMuscles);
    setWorkoutTypeIds(item.workoutTypeIds);
    setFormParent(item.group);
  };
  const save = (): boolean => {
    if (!name.trim() || savingVariation.current) return false;
    savingVariation.current = true;
    const parent = catalog.exercises.find((item) => item.group === group);
    const exercise = {
      id: editing?.id ?? `custom-${Date.now()}`,
      name: name.trim(),
      group: group.trim() || name.trim(),
      variation: name.trim(),
      variationFacets: customVariationFacets(name),
      equipment: equipmentValues.join(' & ') || parent?.equipment || 'Bodyweight',
      equipmentIds: equipmentValues.length ? equipmentValues : ['Bodyweight'],
      primaryEquipment: equipmentValues[0] ?? 'Bodyweight',
      category: exerciseCategory,
      aliases: editing?.aliases ?? [],
      workoutTypeIds,
      primaryMuscle,
      secondaryMuscles,
      restSeconds: editing?.restSeconds,
    };
    if (editing) catalog.updateCustomExercise(exercise);
    else catalog.addCustomExercise(exercise);
    return true;
  };
  const toggleSecondary = (value: string) => {
    selectionHaptic();
    setSecondaryMuscles((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };
  const toggleSection = (value: string) => {
    selectionHaptic();
    setWorkoutTypeIds((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };
  const toggleEquipmentDraft = (value: string) => {
    selectionHaptic();
    setEquipmentDraft((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  };
  const setRestOverride = (item: ExerciseCatalogItem, seconds: number | undefined) => {
    if (isCustom(item)) {
      catalog.updateCustomExercise({ ...item, restSeconds: seconds });
    } else {
      const next = { ...preferences.exerciseRestSeconds };
      if (seconds === undefined) delete next[item.id];
      else next[item.id] = seconds;
      updatePreferences({ exerciseRestSeconds: next });
    }
    setDetail((current) =>
      current && current.id === item.id ? { ...current, restSeconds: seconds } : current,
    );
  };
  const chooseRestOverride = (item: ExerciseCatalogItem, seconds: number | undefined) => {
    if (restOverride(item) === seconds) return;
    setRestOverride(item, seconds);
  };
  const transitionDetailSheet = (nextView: DetailSheetView) => {
    if (reducedMotion) {
      setDetailSheetView(nextView);
      return;
    }
    if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDetailSheetView(nextView);
  };
  const transitionFormView = (nextView: ExerciseFormView) => {
    if (reducedMotion) {
      setSelectorQuery('');
      setFormView(nextView);
      return;
    }
    if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectorQuery('');
    setFormView(nextView);
  };
  const toggleOptionalDetails = () => {
    if (reducedMotion) {
      selectionHaptic();
      setShowOptionalDetails((current) => !current);
      return;
    }
    if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    selectionHaptic();
    setShowOptionalDetails((current) => !current);
  };
  const selectorOptionCount = formView === 'family'
    ? Math.max(categoryMatches.length, categoryOptions.length)
    : formView === 'category'
    ? filteredCategoryOptions.length
    : formView === 'equipment'
        ? filteredEquipmentOptions.length + 1
        : formView === 'customEquipment'
          ? 1
        : formView === 'workoutTypes'
          ? visibleTypes.length
          : formView === 'primaryMuscle'
            ? muscles.length
            : formView === 'secondaryMuscles'
              ? Math.max(0, muscles.length - 1)
              : 0;
  const selectorIsLong = formView !== 'details' && selectorOptionCount > 6;
  // A searchable selector must remain above the keyboard instead of expanding
  // the parent sheet to the top of the viewport.
  const compactSelectorMaxHeight = Math.min(viewportHeight * 0.52, 440);
  // Equipment is commonly the longest Add variation picker. Give its list
  // enough context to compare choices while keeping the confirmation action
  // fixed at the bottom of the sheet.
  const equipmentSelectorMaxHeight = Math.min(viewportHeight * 0.72, 620);
  const activeSelectorMaxHeight = formView === 'equipment'
    ? equipmentSelectorMaxHeight
    : compactSelectorMaxHeight;
  const compactSelectorHeight = Math.min(
    compactSelectorMaxHeight,
    // Handle + header + picker padding + the actual choice rows. This keeps a
    // short replacement view compact without asking ScrollView to infer a
    // height from a flex parent on web.
    92 + (formView === 'family' || formView === 'category' || formView === 'equipment' ? 64 : 0) + Math.max(1, selectorOptionCount) * 56 + 36,
  );
  const detailFormHeight = showOptionalDetails
    ? Math.min(viewportHeight * 0.82, 640)
    : Math.min(viewportHeight * 0.72, 540);
  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={styles.screen}>
        <SettingsDetailHeader
          title={title}
          navigation={navigation}
          elevated={headerElevated}
          backAccessibilityLabel="Back to Exercises"
          rightAction={
            <HeaderAction
              accessibilityLabel="Create custom exercise"
              icon="add"
              label="Add"
              onPress={() => openCreate(null)}
            />
          }
        />
        <FlatList
          testID="exercise-browser-scroll"
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: styles.content.paddingBottom + bottomInset }]}
          data={groups}
          keyExtractor={([group]) => group}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          directionalLockEnabled
          onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
          extraData={expanded}
          ListHeaderComponent={<View style={styles.searchRow}>
            <View style={styles.search}>
              <Icon name="search" size={20} color={theme.slate} />
              <TextInput
                accessibilityLabel="Search exercises"
                value={query}
                onChangeText={setQuery}
                placeholder="Search exercises"
                placeholderTextColor={theme.muted}
                style={styles.searchInput}
              />
            </View>
            {!customOnly && (
              <Button
                accessibilityLabel={`Filters${active ? `, ${active} active` : ''}`}
                label={active ? `Filters (${active})` : 'Filters'}
                icon="filter"
                variant="secondary"
                tone="neutral"
                onPress={() => {
                  setFiltersOpen(true);
                }}
                style={[styles.filters, active > 0 && styles.filtersActive]}
              />
            )}
          </View>}
          renderItem={({ item: [group, items] }) => (
            <Movement
              group={group}
              items={items}
              expanded={expanded === group}
              onToggle={handleToggleMovement}
              onOpen={handleOpenExercise}
              onAdd={openCreate}
              isCustom={isCustom}
              onRemove={handleRemoveExercise}
            />
          )}
          ListEmptyComponent={!bodyReady ? (
            <View testID="exercise-browser-loading" style={styles.empty}>
              <ActivityIndicator size="small" color={theme.textSecondary} />
            </View>
          ) : !groups.length ? (
            <View style={styles.empty}>
              <Text style={styles.movementName}>No exercises found</Text>
              <Text style={styles.meta}>{query && active ? 'Try clearing the search or filters.' : query ? 'Try clearing the search.' : 'Try clearing filters or creating a custom exercise.'}</Text>
              {(query || active > 0) && <Button label={active ? 'Clear filters' : 'Clear search'} variant="ghost" onPress={() => active ? setFilters(emptyCatalogFilters()) : setQuery('')} />}
            </View>
          ) : null}
        />
        {!customOnly && <ForgeCatalogFilterSheet
          testID="exercise-filter-sheet"
          visible={filtersOpen}
          filters={filters}
          facets={editableFilterFacets}
          onApply={setFilters}
          onClose={() => setFiltersOpen(false)}
        />}
        <ForgeBottomSheet
          visible={formParent !== undefined}
          onClose={() => {
            savingVariation.current = false;
            setFormParent(undefined);
            setEditing(null);
            setFormView('details');
            setShowOptionalDetails(false);
          }}
          onBackRequest={() => {
            if (formView === 'details') return false;
            transitionFormView('details');
            return true;
          }}
          accessibilityLabel="Close custom exercise form"
          surfaceTestID="custom-exercise-form-surface"
          keyboardAvoiding
        >
          {(close) => (
            <View style={[
              styles.formSheet,
              formView === 'details'
                ? { height: detailFormHeight }
                : { height: selectorIsLong ? activeSelectorMaxHeight : compactSelectorHeight },
            ]}>
              <ForgeBottomSheetHandle />
              <ForgeSheetHeader
                title={formView === 'details'
                  ? editing
                    ? 'Edit variation'
                    : formParent
                      ? 'Add variation'
                      : 'New exercise'
                    : formView === 'category'
                    ? 'Category'
                    : formView === 'family'
                      ? 'Exercise group'
                        : formView === 'equipment'
                          ? 'Equipment'
                          : formView === 'customEquipment'
                            ? 'Custom equipment'
                        : formView === 'workoutTypes'
                          ? 'Workout types'
                          : formView === 'primaryMuscle'
                            ? 'Primary muscle'
                            : 'Secondary muscles'}
                onClose={close}
                closeAccessibilityLabel="Close custom exercise form"
                titleNumberOfLines={2}
                leading={formView !== 'details' ? (
                  <ForgeBackButton
                    accessibilityLabel="Back to exercise form"
                    onPress={() => transitionFormView('details')}
                  />
                ) : undefined}
              />
              {formView === 'details' ? (
                <>
                  <ScrollView
                    style={styles.formScroll}
                    contentContainerStyle={[styles.form, { paddingBottom: floatingCtaClearance }]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    directionalLockEnabled
                  >
                    <ForgeCard variant="nested" style={styles.formNameCard}>
                      <View style={styles.fieldHeader}>
                        <Text style={styles.fieldLabel}>Name</Text>
                        <Text style={styles.fieldRequired}>Required</Text>
                      </View>
                      <TextInput
                        accessibilityLabel="Exercise name"
                        value={name}
                        onChangeText={setName}
                        placeholder={formParent ? 'Variation name' : 'Exercise name'}
                        placeholderTextColor={theme.muted}
                        style={styles.formNameInput}
                      />
                    </ForgeCard>
                    <View style={styles.formEssentialsGrid}>
                      <FormLinkCard
                        icon="fitness-outline"
                        label="Equipment"
                        value={equipmentValues.length > 1 ? `${equipmentValues.length} selected` : equipmentValue || 'Custom'}
                        accessibilityLabel="Equipment"
                        onPress={() => {
                          setEquipmentDraft(equipmentValues);
                          transitionFormView('equipment');
                        }}
                      />
                      {!formParent ? (
                        <FormLinkCard
                          icon="activity"
                          label="Category"
                          value={exerciseCategory}
                          accessibilityLabel="Exercise category"
                          onPress={() => {
                            if (!showOptionalDetails) setShowOptionalDetails(true);
                            transitionFormView('category');
                          }}
                        />
                      ) : null}
                    </View>
                    <ForgeCard variant="nested" style={styles.formOptionalCard}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Optional details"
                        onPress={toggleOptionalDetails}
                        style={({ pressed }) => [styles.optionalTrigger, pressed && pressedFeedback]}
                      >
                        <Icon name="note" size={20} color={theme.textSecondary} />
                        <View style={styles.optionalCopy}>
                          <Text style={styles.optionalTitle}>Optional details</Text>
                          {!showOptionalDetails ? <Text style={styles.optionalSubtitle}>Group, workout types, and muscles</Text> : null}
                        </View>
                        <Icon name={showOptionalDetails ? 'chevron-down' : 'chevron-forward'} size={20} color={theme.textSecondary} />
                      </Pressable>
                      {showOptionalDetails ? (
                        <View style={styles.optionalRows}>
                          {!formParent ? (
                            <>
                              <SettingsRow
                                title="Exercise group"
                                trailing={<Text style={styles.formValue}>{group || 'None'}</Text>}
                                disclosure
                                showDivider
                                onPress={() => transitionFormView('family')}
                              />
                            </>
                          ) : null}
                          <SettingsRow
                            title="Workout types"
                            trailing={<Text style={styles.formValue}>{workoutTypeIds.length ? `${workoutTypeIds.length} selected` : 'None'}</Text>}
                            disclosure
                            showDivider
                            onPress={() => transitionFormView('workoutTypes')}
                          />
                          <SettingsRow
                            title="Primary muscle"
                            trailing={<Text style={styles.formValue}>{primaryMuscle}</Text>}
                            disclosure
                            showDivider
                            onPress={() => transitionFormView('primaryMuscle')}
                          />
                          <SettingsRow
                            title="Secondary muscles"
                            trailing={<Text style={styles.formValue}>{secondaryMuscles.length ? `${secondaryMuscles.length} selected` : 'None'}</Text>}
                            disclosure
                              onPress={() => transitionFormView('secondaryMuscles')}
                            />
                        </View>
                      ) : null}
                    </ForgeCard>
                  </ScrollView>
                  <ForgeFloatingCta
                    label={editing ? 'Save variation' : 'Add exercise'}
                    accessibilityLabel="Save variation"
                    disabled={!name.trim()}
                    tone="success"
                    onPress={() => { if (save()) close(); }}
                  />
                </>
              ) : (
                <>
                <ScrollView
                  testID={formView === 'equipment' ? 'exercise-equipment-selector-scroll' : undefined}
                  style={styles.formScroll}
                  contentContainerStyle={[
                    styles.formPickerContent,
                    formView === 'equipment' && { paddingBottom: floatingCtaClearance },
                  ]}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  directionalLockEnabled
                >
                  {formView === 'family' ? (
                    <>
                      <View style={styles.categorySearch}>
                        <Icon name="search" size={19} color={theme.slate} />
                        <TextInput
                          autoFocus
                          accessibilityLabel="Search exercise groups"
                          value={group}
                          onChangeText={(value) => { setGroup(value); setCategorySource(null); }}
                          placeholder="Search or add an exercise group"
                          placeholderTextColor={theme.muted}
                          style={styles.categorySearchInput}
                        />
                      </View>
                      <ExerciseFormOptionList
                        options={categoryMatches.length ? categoryMatches : categoryOptions.map((label) => ({ label, source: sourceForCategory(label) }))}
                        selected={group}
                        accessibilityPrefix="Use exercise group"
                        onSelect={(value, source) => { setGroup(value); setCategorySource(source); transitionFormView('details'); }}
                        sourceIcon
                        footer={group.trim() && !isExistingCategory ? (
                          <FormChoiceRow
                            label={`Add “${group.trim()}” as an exercise group`}
                            icon="add"
                            accessibilityLabel={`Add ${group.trim()} as a custom exercise group`}
                            onPress={() => { setCategorySource('custom'); transitionFormView('details'); }}
                          />
                        ) : null}
                      />
                    </>
                  ) : null}
                  {formView === 'category' ? (
                    <>
                      <ForgeSearchField
                        value={selectorQuery}
                        onChangeText={setSelectorQuery}
                        accessibilityLabel="Search categories"
                        placeholder="Search categories"
                      />
                      <ExerciseFormOptionList
                        options={filteredCategoryOptions.map((label) => ({ label, source: 'forge' as const }))}
                        selected={exerciseCategory}
                        accessibilityPrefix="Category"
                        onSelect={(value) => { setExerciseCategory(value); transitionFormView('details'); }}
                      />
                    </>
                  ) : null}
                  {formView === 'equipment' ? (
                    <>
                      <ForgeSearchField
                        value={selectorQuery}
                        onChangeText={setSelectorQuery}
                        accessibilityLabel="Search equipment"
                        placeholder="Search equipment"
                      />
                      <FormChoiceRow
                        label={usesCustomEquipment ? `Custom: ${equipmentValue || 'Equipment'}` : 'Custom equipment'}
                        icon="add"
                        role="button"
                        selected={usesCustomEquipment && equipmentDraft.length === 1}
                        accessibilityLabel={usesCustomEquipment ? 'Edit custom equipment' : 'Add custom equipment'}
                        onPress={() => {
                          setEquipmentValues(equipmentDraft);
                          transitionFormView('customEquipment');
                        }}
                      />
                      <ExerciseFormOptionList
                        options={filteredEquipmentOptions.map((label) => ({ label, source: sourceForEquipment(label) }))}
                        selectedValues={equipmentDraft}
                        accessibilityPrefix="Equipment"
                        multiple
                        onSelect={(value) => toggleEquipmentDraft(value)}
                        sourceIcon
                      />
                    </>
                  ) : null}
                  {formView === 'customEquipment' ? (
                    <ForgeCard variant="nested" style={styles.customEquipmentCard}>
                      <Text style={styles.customEquipmentLabel}>Equipment name</Text>
                      <TextInput
                        autoFocus
                        accessibilityLabel="Custom equipment"
                        value={usesCustomEquipment ? equipmentValue : ''}
                        onChangeText={(value) => {
                          const next = value.trim() ? [value] : [];
                          setEquipmentValues(next);
                          setEquipmentDraft(next);
                        }}
                        placeholder="For example, Sandbag"
                        placeholderTextColor={theme.muted}
                        style={styles.input}
                      />
                    </ForgeCard>
                  ) : null}
                  {formView === 'workoutTypes' ? (
                    <View accessibilityLabel="Workout type choices">
                      <ForgeCard variant="nested" size="compact" style={styles.formChoiceList}>
                        {visibleTypes.map((type, index) => (
                          <FormChoiceRow
                            key={type.id}
                            label={type.name}
                            icon={workoutTypeIcon(type)}
                            selected={workoutTypeIds.includes(type.id)}
                            role="checkbox"
                            showDivider={index < visibleTypes.length - 1}
                            accessibilityLabel={`Workout type ${type.name}`}
                            onPress={() => toggleSection(type.id)}
                          />
                        ))}
                      </ForgeCard>
                    </View>
                  ) : null}
                  {formView === 'primaryMuscle' ? (
                    <ExerciseFormOptionList
                      options={muscles.map((label) => ({ label, source: 'forge' as const }))}
                      selected={primaryMuscle}
                      accessibilityPrefix="Primary"
                      onSelect={(value) => { setPrimaryMuscle(value); setSecondaryMuscles((current) => current.filter((item) => item !== value)); transitionFormView('details'); }}
                    />
                  ) : null}
                  {formView === 'secondaryMuscles' ? (
                    <View accessibilityLabel="Secondary muscle choices">
                      <ForgeCard variant="nested" size="compact" style={styles.formChoiceList}>
                        {muscles.filter((muscle) => muscle !== primaryMuscle).map((muscle, index, choices) => (
                          <FormChoiceRow
                            key={muscle}
                            label={muscle}
                            selected={secondaryMuscles.includes(muscle)}
                            role="checkbox"
                            showDivider={index < choices.length - 1}
                            accessibilityLabel={`Secondary ${muscle}`}
                            onPress={() => toggleSecondary(muscle)}
                          />
                        ))}
                      </ForgeCard>
                    </View>
                  ) : null}
                </ScrollView>
                {formView === 'equipment' ? (
                  <ForgeFloatingCta
                    label={`Apply${equipmentDraft.length ? ` (${equipmentDraft.length})` : ''}`}
                    accessibilityLabel="Apply equipment"
                    disabled={!equipmentDraft.length}
                    tone="success"
                    onPress={() => {
                      setEquipmentValues(equipmentDraft);
                      transitionFormView('details');
                    }}
                  />
                ) : null}
                </>
              )}
            </View>
          )}
        </ForgeBottomSheet>
        <ForgeBottomSheet
          visible={detail !== null}
          onClose={() => {
            setDetail(null);
            setDetailSheetView('details');
          }}
          onBackRequest={() => {
            if (detailSheetView === 'details') return false;
            transitionDetailSheet('details');
            return true;
          }}
          accessibilityLabel="Close exercise details"
          backdropTestID="exercise-detail-sheet-backdrop"
          surfaceTestID="exercise-detail-sheet-surface"
        >
          {(close) =>
            detail &&
            (detailSheetView === 'restTime' ? (
              <View testID="exercise-rest-selection-view" style={styles.restTimeSheet}>
                <ForgeBottomSheetHandle />
                <ForgeSheetHeader
                  title="Duration"
                  leading={
                    <ForgeBackButton
                      accessibilityLabel="Back to exercise details"
                      onPress={() => transitionDetailSheet('details')}
                    />
                  }
                  trailing={
                    <HeaderAction
                      accessibilityLabel="Use default rest time"
                      label="Default"
                      icon="time-outline"
                      variant="secondary"
                      haptic="none"
                      onPress={() => {
                        selectionHaptic();
                        chooseRestOverride(detail, undefined);
                        transitionDetailSheet('details');
                      }}
                      style={[
                        styles.restTimeDefaultAction,
                        restOverride(detail) === undefined && styles.restTimeDefaultActionSelected,
                      ]}
                    />
                  }
                />
                <View style={styles.restTimePickerContent}>
                  <ForgeCard variant="nested" size="compact" style={styles.restTimeChoiceCard}>
                    <ForgeSingleSelectList<number>
                      testID="exercise-rest-selection-list"
                      options={restTimeOptions}
                      selectedValue={restOverride(detail) ?? -1}
                      selectedTone="success"
                      maxVisibleRows={6}
                      onSelect={(value) => {
                        chooseRestOverride(detail, value);
                        transitionDetailSheet('details');
                      }}
                      onSelectedPress={() => transitionDetailSheet('details')}
                    />
                  </ForgeCard>
                </View>
              </View>
            ) : detailSheetView === 'options' ? (
              <View style={styles.detailSheet}>
                <ForgeBottomSheetHandle />
                <ForgeSheetHeader
                  title="Options"
                  compactTitle
                  leading={
                    <ForgeBackButton
                      accessibilityLabel="Back to exercise details"
                      onPress={() => transitionDetailSheet('details')}
                    />
                  }
                />
                <View style={styles.optionsList}>
                  <ForgeCard variant="nested" size="compact">
                    <ExerciseOptionRow
                      icon="share"
                      label="Share exercise"
                      onPress={() => {
                        shareItem({ kind: 'exercise', id: detail.id });
                        transitionDetailSheet('details');
                      }}
                    />
                    <ExerciseOptionRow
                      icon="note"
                      label="Edit variation"
                      divider
                      onPress={() => {
                        close();
                        openEdit(detail);
                      }}
                    />
                    <ExerciseOptionRow
                      icon="trash"
                      label="Delete variation"
                      destructive
                      divider
                      onPress={() => {
                        catalog.removeCustomExercise(detail.id);
                        close();
                      }}
                    />
                  </ForgeCard>
                </View>
              </View>
            ) : (
              <View style={styles.detailSheet}>
                <ForgeBottomSheetHandle />
                <ForgeSheetHeader
                  title={detail.name}
                  onClose={close}
                  closeAccessibilityLabel="Close exercise details"
                  // Custom exercises get a "..." that opens an in-sheet options
                  // view (Share / Edit / Delete); built-ins have nothing extra.
                  trailing={
                    isCustom(detail) ? (
                      <HeaderAction
                        accessibilityLabel="Exercise options"
                        icon="ellipsis-horizontal"
                        iconOnly
                        variant="ghost"
                        onPress={() => transitionDetailSheet('options')}
                      />
                    ) : undefined
                  }
                />
                {isCustom(detail) ? (
                  <View style={styles.customBadgeRow}>
                    <View style={styles.customBadge} accessibilityLabel="Custom exercise">
                      <Icon name="sparkles" size={15} color={theme.textSecondary} />
                    </View>
                  </View>
                ) : null}
                <ExerciseDetailBody
                  detail={detail}
                  workoutTypes={preferences.workoutTypes}
                  restLabel={restLabel(detail)}
                  onPressRest={() => transitionDetailSheet('restTime')}
                  bottomPadding={Math.max(30, bottomInset + 20)}
                />
              </View>
            ))
          }
        </ForgeBottomSheet>
      </View>
    </AppScreen>
  );
}

function ExerciseOptionRow({
  icon,
  label,
  destructive = false,
  divider = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  destructive?: boolean;
  divider?: boolean;
  onPress: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.optionRow, divider && styles.optionDivider, pressed && pressedFeedback]}
    >
      <Icon name={icon} size={20} color={destructive ? theme.textDestructive : theme.textSecondary} />
      <Text style={[styles.optionLabel, { color: destructive ? theme.textDestructive : theme.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

function FormChoiceRow({
  label,
  accessibilityLabel,
  selected = false,
  onPress,
  icon,
  role = 'radio',
  showDivider = false,
}: {
  label: string;
  accessibilityLabel: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  role?: 'checkbox' | 'radio' | 'button';
  showDivider?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={role === 'button' ? undefined : { checked: selected }}
      aria-checked={role === 'button' ? undefined : selected}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.formChoice,
        showDivider && styles.formChoiceDivider,
        selected && { backgroundColor: theme.successSurface },
        pressed && pressedFeedback,
      ]}
    >
      {icon && <Icon name={icon} size={18} color={theme.textPrimary} />}
      <Text style={styles.formChoiceText}>{label}</Text>
      {selected ? <Icon name="check" size={20} color={theme.selectionIndicator} weight="bold" testID="choice-selection-check" /> : null}
    </Pressable>
  );
}

function FormLinkCard({
  icon,
  label,
  value,
  accessibilityLabel,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <ForgeCard variant="nested" style={styles.formLinkCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.formLinkCardPressable, pressed && pressedFeedback]}
      >
        <View style={styles.formLinkTopRow}>
          <Icon name={icon} size={20} color={theme.textSecondary} />
          <Icon name="chevron-forward" size={18} color={theme.textSecondary} />
        </View>
        <Text numberOfLines={1} style={styles.formLinkLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.formLinkValue}>{value}</Text>
      </Pressable>
    </ForgeCard>
  );
}

function ExerciseFormOptionList({
  options,
  selected,
  selectedValues,
  accessibilityPrefix,
  onSelect,
  sourceIcon = false,
  footer,
  multiple = false,
}: {
  options: { label: string; source: CatalogSource }[];
  selected?: string;
  selectedValues?: readonly string[];
  accessibilityPrefix: string;
  onSelect: (value: string, source: CatalogSource) => void;
  sourceIcon?: boolean;
  footer?: React.ReactNode;
  multiple?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View accessibilityRole={multiple ? undefined : 'radiogroup'}>
      <ForgeCard variant="nested" size="compact" style={styles.formChoiceList}>
        {options.map((option, index) => (
          <FormChoiceRow
            key={option.label}
            label={option.label}
            icon={sourceIcon ? (option.source === 'forge' ? 'verified' : 'note') : undefined}
            selected={selectedValues ? selectedValues.includes(option.label) : selected === option.label}
            role={multiple ? 'checkbox' : 'radio'}
            showDivider={index < options.length - 1 || Boolean(footer)}
            accessibilityLabel={`${accessibilityPrefix} ${option.label}`}
            onPress={() => onSelect(option.label, option.source)}
          />
        ))}
        {footer}
      </ForgeCard>
    </View>
  );
}

const Movement = React.memo(function Movement({
  group,
  items,
  expanded,
  onToggle,
  onOpen,
  onAdd,
  isCustom,
  onRemove,
}: {
  group: string;
  items: ExerciseCatalogItem[];
  expanded: boolean;
  onToggle: (group: string) => void;
  onOpen: (item: ExerciseCatalogItem) => void;
  onAdd: (group: string) => void;
  isCustom: (item: ExerciseCatalogItem) => boolean;
  onRemove: (item: ExerciseCatalogItem) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  const equipment = Object.entries(
    items.reduce<Record<string, ExerciseCatalogItem[]>>((result, item) => {
      (result[item.equipment] ??= []).push(item);
      return result;
    }, {}),
  );
  if (items.length === 1) {
    const item = items[0];
    return (
      <SettingsSection>
        {isCustom(item) ? (
          <SwipeCustomExerciseRow item={item} onOpen={() => onOpen(item)} onRemove={() => onRemove(item)}>
            {(onPress) => (
              <SettingsRow
                title={group}
                subtitle={`${item.equipment} · ${item.category}`}
                accessibilityLabel={`Open ${group}`}
                onPress={onPress}
                trailing={<Icon name="note" size={17} color={theme.textSecondary} />}
                disclosure
              />
            )}
          </SwipeCustomExerciseRow>
        ) : (
          <SettingsRow
            title={group}
            subtitle={`${item.equipment} · ${item.category}`}
            accessibilityLabel={`Open ${group}`}
            onPress={() => onOpen(item)}
            disclosure
          />
        )}
        <Button
          accessibilityLabel={`Add variation to ${group}`}
          label="Add variation"
          icon="add"
          iconSize={16}
          variant="outline"
          hitSlop={4}
          onPress={() => onAdd(group)}
          style={styles.singleAddVariation}
        />
      </SettingsSection>
    );
  }
  return (
    <SettingsSection>
      <SettingsRow
        title={group}
        subtitle={`${items.length} ${items.length === 1 ? 'variation' : 'variations'}`}
        accessibilityLabel={`${group} & ${items.length} variations`}
        accessibilityState={{ expanded }}
        onPress={() => onToggle(group)}
        haptic="none"
        trailing={
          <Icon
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={18}
            color={theme.textSecondary}
          />
        }
      />
      {expanded && (
        <View testID={`exercise-variations-${group}`} style={styles.variations}>
          {equipment.map(([label, variants]) => (
            <View key={label} style={styles.equipmentGroup}>
              <Text style={styles.equipmentTitle}>{label}</Text>
              {variants.map((item) => {
                const label = formatCatalogVariation(item.name, item.variation) || item.name;
                const variation = (onPress: () => void) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${label}`}
                    onPress={onPress}
                    style={({ pressed }) => [
                      styles.variation,
                      pressed && { backgroundColor: theme.pressed },
                    ]}
                  >
                    <Text style={styles.variationName}>{label}</Text>
                    <View style={styles.variationIcons}>
                      {isCustom(item) && <Icon name="note" size={16} color={theme.textSecondary} />}
                      <Icon name="chevron-forward" size={17} color={theme.slate} />
                    </View>
                  </Pressable>
                );
                return isCustom(item) ? (
                  <SwipeCustomExerciseRow
                    key={item.id}
                    item={item}
                    onOpen={() => onOpen(item)}
                    onRemove={() => onRemove(item)}
                  >
                    {variation}
                  </SwipeCustomExerciseRow>
                ) : (
                  <React.Fragment key={item.id}>
                    {variation(() => {
                      lightHaptic();
                      onOpen(item);
                    })}
                  </React.Fragment>
                );
              })}
            </View>
          ))}
          <Button
            onPress={() => onAdd(group)}
            accessibilityLabel={`Add variation to ${group}`}
            label="Add variation"
            icon="add"
            iconSize={16}
            variant="outline"
            hitSlop={4}
            style={styles.addVariation}
          />
        </View>
      )}
    </SettingsSection>
  );
});

function SwipeCustomExerciseRow({
  item,
  onOpen,
  onRemove,
  children,
}: {
  item: ExerciseCatalogItem;
  onOpen: () => void;
  onRemove: () => void;
  children: (onPress: () => void) => React.ReactNode;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useForgeReducedMotion();
  const actionWidth = 72;
  const [revealed, setRevealed] = useState(false);
  const offset = useSharedValue(0);
  const open = useSharedValue(false);
  const suppressNextPress = useRef(false);

  useEffect(() => {
    open.value = revealed;
    offset.value = reducedMotion ? (revealed ? -actionWidth : 0) : withSpring(revealed ? -actionWidth : 0, swipeSpring);
  }, [offset, open, reducedMotion, revealed]);

  const settle = (next: boolean, dragged: boolean): void => {
    if (dragged) suppressNextPress.current = true;
    if (next !== revealed) {
      mediumHaptic();
      setRevealed(next);
      return;
    }
    offset.value = reducedMotion ? (next ? -actionWidth : 0) : withSpring(next ? -actionWidth : 0, swipeSpring);
  };
  const pan = Gesture.Pan()
    // Do not let a diagonal list scroll activate this horizontal delete gesture.
    .activeOffsetX([-16, 16])
    .failOffsetY([-16, 16])
    .onUpdate((event) => {
      if (!open.value && event.translationX >= 0) return;
      const initial = open.value ? -actionWidth : 0;
      offset.value = Math.max(-actionWidth, Math.min(0, initial + event.translationX));
    })
    .onEnd((event) => {
      const initial = open.value ? -actionWidth : 0;
      const next = initial + event.translationX < -actionWidth * 0.55;
      runOnJS(settle)(next, Math.abs(event.translationX) > 6);
    });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const handleOpen = (): void => {
    if (suppressNextPress.current) {
      suppressNextPress.current = false;
      return;
    }
    lightHaptic();
    onOpen();
  };
  const label = formatCatalogVariation(item.name, item.variation) || item.name;

  return (
    <GestureDetector gesture={pan}>
      <View testID={`custom-exercise-swipe-${item.id}`} style={styles.customSwipe}>
        <View
          style={[
            styles.customDeleteLayer,
            { backgroundColor: theme.destructiveSurface, pointerEvents: revealed ? 'auto' : 'none' },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${label}`}
            onPress={() => {
              lightHaptic();
              onRemove();
            }}
            style={({ pressed }) => [styles.customDeleteAction, pressed && styles.customDeletePressed]}
          >
            <Icon name="trash" size={18} color={theme.textDestructive} />
            <Text style={styles.customDeleteText}>Delete</Text>
          </Pressable>
        </View>
        <Animated.View style={[styles.customSwipeSurface, animatedStyle]}>
          {children(handleOpen)}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
const createStyles = (theme: import('../../types').ForgeTheme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    scroll: { flex: 1 },
    content: {
      padding: settingsLayout.screenPadding,
      paddingTop: settingsLayout.contentTop,
      // Keep the bottom safe area inside the scroll extent so cards can
      // pass behind the home indicator without an opaque clipping band.
      paddingBottom: settingsLayout.contentBottom,
      gap: settingsLayout.listGap,
    },
    searchRow: { flexDirection: 'row', gap: 8 },
    search: {
      flex: 1,
      minHeight: 48,
      paddingHorizontal: 13,
      borderRadius: 14,
      gap: 8,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.input,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    searchInput: { flex: 1, color: theme.ink, ...typeScale.body, paddingVertical: 0 },
    filters: {
      minHeight: 48,
      paddingHorizontal: 13,
      borderRadius: 14,
      gap: 6,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    filtersActive: { borderColor: theme.selectionIndicator, backgroundColor: theme.surfaceMuted },
    chips: { gap: 8, alignItems: 'center' },
    chip: {
      minHeight: 34,
      paddingHorizontal: 11,
      borderRadius: 17,
      gap: 5,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
    },
    copy: { flex: 1 },
    movementName: { ...typeScale.cardTitle, color: theme.ink },
    movementIcons: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    meta: { ...typeScale.supporting, color: theme.slate, marginTop: 2 },
    variations: {
      padding: 14,
      // Keep the expanded hierarchy inside the same opaque card. Using the
      // page-coloured inset here visually broke the card at its first row.
      backgroundColor: theme.surfaceElevated,
      borderTopWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    equipmentGroup: {
      overflow: 'hidden',
      borderRadius: 12,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    equipmentTitle: {
      ...typeScale.label,
      color: theme.slate,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 5,
    },
    variation: {
      minHeight: 56,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
    variationName: { ...typeScale.cardTitle, color: theme.ink },
    variationIcons: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    customSwipe: {
      position: 'relative',
      overflow: 'hidden',
    },
    customDeleteLayer: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: 72,
    },
    customDeleteAction: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
    customDeletePressed: { backgroundColor: theme.destructiveSurfacePressed },
    customDeleteText: { color: theme.textDestructive, ...typeScale.caption },
    customSwipeSurface: { zIndex: 1, flex: 1, alignSelf: 'stretch', backgroundColor: theme.surfaceElevated },
    addVariation: {
      alignSelf: 'stretch',
      height: 38,
      minHeight: 38,
      width: '100%',
      marginTop: 0,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: 12,
    },
    empty: { paddingTop: 60, alignItems: 'center' },
    sheet: { alignSelf: 'stretch', flexShrink: 1 },
    formSheet: { alignSelf: 'stretch', flexShrink: 1 },
    detailSheet: {},
    restTimeSheet: { minHeight: 400 },
    restTimeHeader: {
      minHeight: forgeSheetHeader.height,
      paddingHorizontal: forgeSheetHeader.horizontalPadding,
      flexDirection: 'row',
      alignItems: 'center',
    },
    restTimeBack: {
      width: forgeSheetHeader.closeSize,
      height: forgeSheetHeader.closeSize,
      minWidth: forgeSheetHeader.closeSize,
      minHeight: forgeSheetHeader.closeSize,
    },
    restTimeTitle: { flex: 1, textAlign: 'center', ...typeScale.headerTitle, color: theme.ink },
    restTimeHeaderSpacer: { width: forgeSheetHeader.closeSize },
    restTimeDefaultAction: {
      minWidth: 112,
      paddingHorizontal: 12,
    },
    restTimeDefaultActionSelected: { borderColor: theme.success, backgroundColor: theme.successSurface },
    restTimePickerContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
    restTimeChoiceCard: { overflow: 'hidden', borderRadius: 18 },
    detailRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
    detailLabel: { ...typeScale.label, color: theme.slate },
    detailValue: {
      ...typeScale.body,
      color: theme.ink,
      textAlign: 'right',
      flexShrink: 1,
      marginLeft: 16,
    },
    detailAction: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    detailSelectableValue: {
      ...typeScale.body,
      color: theme.textSecondary,
      textAlign: 'right',
      flexShrink: 1,
      marginLeft: 16,
    },
    sectionTypes: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: 8,
      flexShrink: 1,
      marginLeft: 16,
    },
    sectionType: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    sectionTypeName: { ...typeScale.body, color: theme.ink },
    sheetHeader: {
      minHeight: forgeSheetHeader.height,
      paddingHorizontal: forgeSheetHeader.horizontalPadding,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sheetTitle: { ...typeScale.headerTitle, color: theme.ink },
    detailSheetTitle: { flex: 1, minWidth: 0, marginRight: 12 },
    filterScroll: { flexGrow: 0, flexShrink: 1 },
    filterContent: { padding: 20, paddingTop: 4, gap: 16, paddingBottom: 20 },
    footer: {
      padding: 16,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
    formScroll: { flex: 1, minHeight: 0 },
    form: { padding: 20, gap: 18 },
    formPickerContent: { padding: 20, gap: 12, paddingBottom: 36 },
    formNameCard: { padding: 14, gap: 8, borderRadius: 18 },
    formNameInput: {
      minHeight: 52,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.divider,
      backgroundColor: theme.input,
      color: theme.ink,
      ...typeScale.body,
    },
    formEssentialsGrid: { flexDirection: 'row', gap: 12 },
    formLinkCard: { flex: 1, minWidth: 0, overflow: 'hidden', borderRadius: 18 },
    formLinkCardPressable: { minHeight: 112, padding: 14, justifyContent: 'space-between', gap: 4 },
    formLinkTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    formLinkLabel: { ...typeScale.cardTitle, color: theme.textPrimary, marginTop: 2 },
    formLinkValue: { ...typeScale.supporting, color: theme.textSecondary, paddingRight: 16 },
    formOptionalCard: { overflow: 'hidden', borderRadius: 18 },
    optionalTrigger: { minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
    optionalCopy: { flex: 1, minWidth: 0 },
    optionalTitle: { ...typeScale.cardTitle, color: theme.textPrimary },
    optionalSubtitle: { ...typeScale.supporting, color: theme.textSecondary, marginTop: 1 },
    optionalRows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
    formValue: { ...typeScale.supporting, color: theme.textSecondary, textAlign: 'right', maxWidth: 130 },
    formChoiceList: { overflow: 'hidden' },
    formChoice: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    formChoiceDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider },
    formChoiceText: { flex: 1, ...typeScale.cardTitle, color: theme.textPrimary },
    detailContent: { paddingHorizontal: 20, paddingBottom: 30, paddingTop: 2, gap: 8 },
    detailSectionLabel: { marginTop: 6, paddingHorizontal: 4, color: theme.textSecondary, ...typeScale.caption },
    restTimeCard: { overflow: 'hidden', borderRadius: 18 },
    restTimeCardPressable: { minHeight: 64, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
    restTimeCardIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted },
    restTimeCardCopy: { flex: 1, minWidth: 0 },
    restTimeCardTitle: { ...typeScale.cardTitle, color: theme.textPrimary },
    detailFactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 8 },
    detailFact: { flexBasis: '48%', flexGrow: 1, minWidth: 124, minHeight: 56, padding: 8, gap: 1, justifyContent: 'flex-start' },
    detailFactLabel: { ...typeScale.caption, color: theme.textSecondary },
    detailFactValue: { ...typeScale.label, color: theme.textPrimary },
    detailProfileCard: { overflow: 'hidden', borderRadius: 18 },
    detailProfileRow: { minHeight: 54, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
    detailProfileLabel: { flex: 1, ...typeScale.label, color: theme.textSecondary },
    detailProfileValue: { flexShrink: 1, maxWidth: '62%', textAlign: 'right', ...typeScale.label, color: theme.textPrimary },
    customBadgeRow: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 4, alignItems: 'flex-start' },
    customBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted },
    optionsList: { marginHorizontal: 20, marginTop: 4 },
    optionRow: { minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
    optionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
    optionLabel: { ...typeScale.controlLabel },
    input: {
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: theme.input,
      borderWidth: 1,
      borderColor: theme.divider,
      color: theme.ink,
      ...typeScale.body,
    },
    customEquipmentCard: { padding: 14, gap: 8, borderRadius: 18 },
    customEquipmentLabel: { ...typeScale.label, color: theme.textSecondary },
    categorySearch: {
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 14,
      gap: 8,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.input,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    categorySearchInput: { flex: 1, paddingVertical: 0, color: theme.ink, ...typeScale.body },
    fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
    fieldLabel: { ...typeScale.label, color: theme.slate },
    fieldRequired: { ...typeScale.supporting, color: theme.textSecondary },
    singleAddVariation: {
      alignSelf: 'stretch',
      height: 38,
      minHeight: 38,
      margin: 12,
      width: 'auto',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: 12,
    },
  });
