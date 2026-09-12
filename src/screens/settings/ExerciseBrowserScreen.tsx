import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutAnimation,
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
  ForgeCard,
  ForgeCatalogFilterSheet,
  ForgeFloatingCta,
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
import {
  catalogFilterCount,
  emptyCatalogFilters,
  type CatalogFilterFacet,
  type CatalogFilterState,
} from '../../components/ui';
import { forgeSheetHeader } from '../../components/ui/ForgeBottomSheet';
import type { ForgeSingleSelectOption } from '../../components/ui';
import { catalogTaxonomies, type ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { useExerciseCatalog } from '../../state/ExerciseCatalogContext';
import { useSettings } from '../../state/SettingsContext';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { IconName, RootStackParamList } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { workoutTypeIcon } from './workoutTypeIcon';
import {
  catalogFacets,
  filterCatalog,
  groupCatalogByMovement,
} from '../../domain/exercises/catalogSelectors';
import { REST_DURATION_OPTIONS } from '../../domain/rest/restDurationOptions';
import { SettingsRow, SettingsSection, settingsLayout } from './SettingsRow';

type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseBrowser'>;
type DetailSheetView = 'details' | 'restTime';
type ExerciseFormView =
  | 'details'
  | 'category'
  | 'family'
  | 'equipment'
  | 'workoutTypes'
  | 'primaryMuscle'
  | 'secondaryMuscles';
type CatalogSource = 'forge' | 'custom';

function formatPickerDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function formatTrackingType(type: ExerciseCatalogItem['trackingType']): string {
  return (type ?? 'weight-reps').split('-').map((part) => part === 'reps' ? 'reps' : part[0].toUpperCase() + part.slice(1)).join(' + ');
}

const restTimeOptions: readonly ForgeSingleSelectOption<number>[] = REST_DURATION_OPTIONS.map(
  (seconds) => ({
    value: seconds,
    label: formatPickerDuration(seconds),
    accessibilityLabel: `Rest duration ${formatPickerDuration(seconds)}`,
  }),
);
const swipeSpring = { damping: 22, stiffness: 280, mass: 0.65, overshootClamping: true };

export function ExerciseBrowserScreen({ navigation, route }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { height: viewportHeight } = useWindowDimensions();
  const { preferences, updatePreferences } = useSettings();
  const catalog = useExerciseCatalog();
  const fixedTypeId = route.params?.workoutTypeId;
  const customOnly = route.params?.custom === true;
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<CatalogFilterState>(emptyCatalogFilters());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [headerElevated, setHeaderElevated] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formParent, setFormParent] = useState<string | null | undefined>(undefined);
  const [formView, setFormView] = useState<ExerciseFormView>('details');
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [categorySource, setCategorySource] = useState<CatalogSource | null>(null);
  const [equipmentValue, setEquipmentValue] = useState('Bodyweight');
  const [primaryMuscle, setPrimaryMuscle] = useState('Accessories');
  const [exerciseCategory, setExerciseCategory] = useState('Full Body');
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);
  const [workoutTypeIds, setWorkoutTypeIds] = useState<string[]>(['strength']);
  const [editing, setEditing] = useState<ExerciseCatalogItem | null>(null);
  const [detail, setDetail] = useState<ExerciseCatalogItem | null>(null);
  const [detailSheetView, setDetailSheetView] = useState<DetailSheetView>('details');
  const savingVariation = useRef(false);
  const source = customOnly ? catalog.customExercises : catalog.exercises;
  const title = customOnly
    ? 'Custom exercises'
    : (preferences.workoutTypes.find((item) => item.id === fixedTypeId)?.name ?? 'All exercises');
  const visibleTypes = preferences.workoutTypes.filter((item) => !item.hidden);
  const active = catalogFilterCount(filters);
  const filtered = useMemo(
    () =>
      filterCatalog(source, {
        query,
        types: filters.types,
        equipment: filters.equipment,
        exerciseCategories: filters.exerciseCategories,
        includeGroupInSearch: true,
      }).filter((item) => !fixedTypeId || item.workoutTypeIds.includes(fixedTypeId)),
    [source, fixedTypeId, filters, query],
  );
  const groups = useMemo(() => groupCatalogByMovement(filtered), [filtered]);
  const { equipment } = catalogFacets(source);
  const { equipment: forgeEquipment } = catalogFacets(catalog.exercises);
  const { categories: muscles } = catalogFacets(catalog.exercises);
  const filterFacets = useMemo<CatalogFilterFacet[]>(() => {
    const scoped = (draft: CatalogFilterState, includeEquipment: boolean) =>
      filterCatalog(source, {
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
        options: [...new Set(source.map((item) => item.category))].sort().map((value) => ({ value, label: value })),
        optionsFor: (draft) => [...new Set(scoped(draft, true).map((item) => item.category))].sort().map((value) => ({ value, label: value })),
      },
    ];
    return [typeFacet, ...common];
  }, [equipment, fixedTypeId, source, visibleTypes]);
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
    () => Array.from(new Set([...forgeEquipmentOptions, ...customEquipmentOptions])),
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
  const usesCustomEquipment = !selectableEquipment.includes(equipmentValue);
  const sourceForCategory = (value: string): CatalogSource =>
    forgeCategoryOptions.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())
      ? 'forge'
      : 'custom';
  const sourceForEquipment = (value: string): CatalogSource =>
    forgeEquipmentOptions.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())
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
  const isCustom = (item: ExerciseCatalogItem) =>
    catalog.customExercises.some((custom) => custom.id === item.id);
  const restOverride = (item: ExerciseCatalogItem) =>
    isCustom(item) ? item.restSeconds : preferences.exerciseRestSeconds[item.id];
  const restLabel = (item: ExerciseCatalogItem) => {
    const value = restOverride(item);
    return value === undefined
      ? 'Default'
      : `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  };
  const openCreate = (parent: string | null) => {
    lightHaptic();
    savingVariation.current = false;
    const inherited = parent
      ? [...catalog.exercises, ...catalog.customExercises].find((item) => item.group === parent)
      : undefined;
    setEditing(null);
    setFormView('details');
    setName('');
    setGroup(parent ?? '');
    setCategorySource(parent ? sourceForCategory(parent) : null);
    setEquipmentValue(inherited?.equipment ?? 'Bodyweight');
    setPrimaryMuscle(inherited?.primaryMuscle ?? 'Accessories');
    setExerciseCategory(inherited?.category ?? 'Full Body');
    setSecondaryMuscles(inherited?.secondaryMuscles ?? []);
    setWorkoutTypeIds(inherited?.workoutTypeIds ?? (fixedTypeId ? [fixedTypeId] : ['strength']));
    setFormParent(parent);
  };
  const openEdit = (item: ExerciseCatalogItem) => {
    lightHaptic();
    savingVariation.current = false;
    setDetail(null);
    setFormView('details');
    setEditing(item);
    setName(item.variation || item.name);
    setGroup(item.group);
    setCategorySource(sourceForCategory(item.group));
    setEquipmentValue(item.equipment);
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
      equipment: equipmentValue.trim() || parent?.equipment || 'Bodyweight',
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
    if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDetailSheetView(nextView);
  };
  return (
    <AppScreen backgroundColor={theme.background}>
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
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          directionalLockEnabled
          onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
        >
          <View style={styles.searchRow}>
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
          </View>
          {groups.map(([group, items]) => (
            <Movement
              key={group}
              group={group}
              items={items}
              expanded={expanded === group}
              onToggle={() => {
                selectionHaptic();
                setExpanded(expanded === group ? null : group);
              }}
              onOpen={(item) => {
                setDetailSheetView('details');
                setDetail(item);
              }}
              onAdd={() => openCreate(group)}
              isCustom={isCustom}
              onRemove={(item) => catalog.removeCustomExercise(item.id)}
            />
          ))}
          {!groups.length && (
            <View style={styles.empty}>
              <Text style={styles.movementName}>No exercises found</Text>
              <Text style={styles.meta}>{query && active ? 'Try clearing the search or filters.' : query ? 'Try clearing the search.' : 'Try clearing filters or creating a custom exercise.'}</Text>
              {(query || active > 0) && <Button label={active ? 'Clear filters' : 'Clear search'} variant="ghost" onPress={() => active ? setFilters(emptyCatalogFilters()) : setQuery('')} />}
            </View>
          )}
        </ScrollView>
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
          }}
          onBackRequest={() => {
            if (formView === 'details') return false;
            setFormView('details');
            return true;
          }}
          accessibilityLabel="Close custom exercise form"
          surfaceTestID="custom-exercise-form-surface"
          keyboardAvoiding
        >
          {(close) => (
            <View style={[styles.formSheet, { height: Math.min(viewportHeight * 0.82, 640) }]}>
              <ForgeBottomSheetHandle />
              <ForgeSheetHeader
                title={formView === 'details'
                  ? editing
                    ? 'Edit variation'
                    : formParent
                      ? 'Add variation'
                      : 'New custom exercise'
                  : formView === 'category'
                    ? 'Exercise category'
                    : formView === 'family'
                      ? 'Movement family'
                      : formView === 'equipment'
                        ? 'Equipment'
                        : formView === 'workoutTypes'
                          ? 'Workout types'
                          : formView === 'primaryMuscle'
                            ? 'Primary muscle'
                            : 'Secondary muscles'}
                onClose={close}
                closeAccessibilityLabel="Close custom exercise form"
                leading={formView !== 'details' ? (
                  <Button
                    accessibilityLabel="Back to exercise form"
                    label="Back"
                    icon="chevron-back"
                    iconSize={18}
                    variant="outline"
                    onPress={() => setFormView('details')}
                    style={styles.formBackAction}
                  />
                ) : undefined}
              />
              {formView === 'details' ? (
                <>
                  <ScrollView
                    style={styles.formScroll}
                    contentContainerStyle={styles.form}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    directionalLockEnabled
                  >
                    <Text style={styles.fieldLabel}>NAME</Text>
                    <ForgeCard variant="inset" style={styles.formInputCard}>
                      <TextInput
                        accessibilityLabel="Exercise name"
                        value={name}
                        onChangeText={setName}
                        placeholder={formParent ? 'Variation name' : 'Exercise name'}
                        placeholderTextColor={theme.muted}
                        style={styles.formNameInput}
                      />
                    </ForgeCard>
                    {!formParent ? (
                      <SettingsSection title="Movement" cardStyle={styles.formSectionCard}>
                        <SettingsRow
                          title="Exercise category"
                          trailing={<Text style={styles.formValue}>{exerciseCategory}</Text>}
                          disclosure
                          onPress={() => setFormView('category')}
                        />
                        <SettingsRow
                          title="Movement family"
                          subtitle={group ? undefined : 'Choose or create a family'}
                          trailing={group ? <Text style={styles.formValue}>{group}</Text> : undefined}
                          disclosure
                          onPress={() => setFormView('family')}
                        />
                      </SettingsSection>
                    ) : null}
                    <SettingsSection title="Setup" cardStyle={styles.formSectionCard}>
                      <SettingsRow
                        title="Equipment"
                        trailing={<Text style={styles.formValue}>{equipmentValue || 'Custom'}</Text>}
                        disclosure
                        onPress={() => setFormView('equipment')}
                      />
                    </SettingsSection>
                    <SettingsSection title="Training" cardStyle={styles.formSectionCard}>
                      <SettingsRow
                        title="Workout types"
                        trailing={<Text style={styles.formValue}>{workoutTypeIds.length ? `${workoutTypeIds.length} selected` : 'None'}</Text>}
                        disclosure
                        onPress={() => setFormView('workoutTypes')}
                      />
                      <SettingsRow
                        title="Primary muscle"
                        trailing={<Text style={styles.formValue}>{primaryMuscle}</Text>}
                        disclosure
                        onPress={() => setFormView('primaryMuscle')}
                      />
                      <SettingsRow
                        title="Secondary muscles"
                        trailing={<Text style={styles.formValue}>{secondaryMuscles.length ? `${secondaryMuscles.length} selected` : 'None'}</Text>}
                        disclosure
                        onPress={() => setFormView('secondaryMuscles')}
                      />
                    </SettingsSection>
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
                <ScrollView
                  style={styles.formScroll}
                  contentContainerStyle={styles.formPickerContent}
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
                          accessibilityLabel="Exercise movement family"
                          value={group}
                          onChangeText={(value) => { setGroup(value); setCategorySource(null); }}
                          placeholder="Search or add a movement family"
                          placeholderTextColor={theme.muted}
                          style={styles.categorySearchInput}
                        />
                      </View>
                      <ExerciseFormOptionList
                        options={categoryMatches.length ? categoryMatches : categoryOptions.map((label) => ({ label, source: sourceForCategory(label) }))}
                        selected={group}
                        accessibilityPrefix="Use movement family"
                        onSelect={(value, source) => { setGroup(value); setCategorySource(source); setFormView('details'); }}
                        sourceIcon
                      />
                      {group.trim() && !isExistingCategory ? (
                        <FormChoiceRow
                          label={`Add “${group.trim()}” as a custom family`}
                          icon="add"
                          accessibilityLabel={`Add ${group.trim()} as a custom movement family`}
                          onPress={() => { setCategorySource('custom'); setFormView('details'); }}
                        />
                      ) : null}
                    </>
                  ) : null}
                  {formView === 'category' ? (
                    <ExerciseFormOptionList
                      options={taxonomyCategoryOptions.map((label) => ({ label, source: 'forge' as const }))}
                      selected={exerciseCategory}
                      accessibilityPrefix="Exercise category"
                      onSelect={(value) => { setExerciseCategory(value); setFormView('details'); }}
                    />
                  ) : null}
                  {formView === 'equipment' ? (
                    <>
                      {usesCustomEquipment ? (
                        <TextInput
                          autoFocus
                          accessibilityLabel="Custom equipment"
                          value={equipmentValue}
                          onChangeText={setEquipmentValue}
                          placeholder="Custom equipment"
                          placeholderTextColor={theme.muted}
                          style={styles.input}
                        />
                      ) : null}
                      <ExerciseFormOptionList
                        options={selectableEquipment.map((label) => ({ label, source: sourceForEquipment(label) }))}
                        selected={usesCustomEquipment ? undefined : equipmentValue}
                        accessibilityPrefix="Equipment"
                        onSelect={(value) => { setEquipmentValue(value); setFormView('details'); }}
                        sourceIcon
                      />
                      <FormChoiceRow
                        label="Custom equipment"
                        icon="add"
                        selected={usesCustomEquipment}
                        accessibilityLabel="Add custom equipment"
                        onPress={() => setEquipmentValue('')}
                      />
                    </>
                  ) : null}
                  {formView === 'workoutTypes' ? visibleTypes.map((type) => (
                    <FormChoiceRow
                      key={type.id}
                      label={type.name}
                      icon={workoutTypeIcon(type)}
                      selected={workoutTypeIds.includes(type.id)}
                      role="checkbox"
                      accessibilityLabel={`Workout type ${type.name}`}
                      onPress={() => toggleSection(type.id)}
                    />
                  )) : null}
                  {formView === 'primaryMuscle' ? (
                    <ExerciseFormOptionList
                      options={muscles.map((label) => ({ label, source: 'forge' as const }))}
                      selected={primaryMuscle}
                      accessibilityPrefix="Primary"
                      onSelect={(value) => { setPrimaryMuscle(value); setSecondaryMuscles((current) => current.filter((item) => item !== value)); setFormView('details'); }}
                    />
                  ) : null}
                  {formView === 'secondaryMuscles' ? muscles.filter((muscle) => muscle !== primaryMuscle).map((muscle) => (
                    <FormChoiceRow
                      key={muscle}
                      label={muscle}
                      selected={secondaryMuscles.includes(muscle)}
                      role="checkbox"
                      accessibilityLabel={`Secondary ${muscle}`}
                      onPress={() => toggleSecondary(muscle)}
                    />
                  )) : null}
                </ScrollView>
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
            if (detailSheetView !== 'restTime') return false;
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
                  title="Rest Time"
                  onClose={close}
                  closeAccessibilityLabel="Close exercise details"
                  leading={
                    <HeaderAction
                      accessibilityLabel="Back to exercise details"
                      icon="chevron-back"
                      iconOnly
                      onPress={() => transitionDetailSheet('details')}
                    />
                  }
                  trailing={
                    <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Use default rest time"
                    accessibilityState={{ selected: restOverride(detail) === undefined }}
                    onPress={() => {
                      selectionHaptic();
                      chooseRestOverride(detail, undefined);
                      transitionDetailSheet('details');
                    }}
                    style={({ pressed }) => [
                      styles.restTimeDefaultAction,
                      restOverride(detail) === undefined && styles.restTimeDefaultActionSelected,
                      pressed && pressedFeedback,
                    ]}
                  >
                    <Text style={styles.restTimeDefaultLabel}>Default</Text>
                  </Pressable>
                  }
                />
                <ForgeSingleSelectList<number>
                  testID="exercise-rest-selection-list"
                  options={restTimeOptions}
                  selectedValue={restOverride(detail) ?? -1}
                  maxVisibleRows={6}
                  onSelect={(value) => {
                    chooseRestOverride(detail, value);
                    transitionDetailSheet('details');
                  }}
                  onSelectedPress={() => transitionDetailSheet('details')}
                />
              </View>
            ) : (
              <View style={styles.detailSheet}>
                <ForgeBottomSheetHandle />
                <ForgeSheetHeader
                  title={detail.variation || detail.name}
                  onClose={close}
                  closeAccessibilityLabel="Close exercise details"
                  closePosition={isCustom(detail) ? 'left' : 'right'}
                  trailing={
                    isCustom(detail) ? (
                      <HeaderAction
                        accessibilityLabel="Delete variation"
                        icon="trash"
                        iconOnly
                        tone="destructive"
                        onPress={() => {
                          catalog.removeCustomExercise(detail.id);
                          close();
                        }}
                      />
                    ) : undefined
                  }
                />
                <View style={styles.detailContent}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Change rest time, currently ${restLabel(detail)}`}
                    accessibilityHint="Opens the rest duration picker"
                    onPress={() => {
                      lightHaptic();
                      transitionDetailSheet('restTime');
                    }}
                    style={({ pressed }) => [styles.detailRow, pressed && pressedFeedback]}
                  >
                    <Text style={styles.detailLabel}>Rest Time</Text>
                    <View style={styles.detailAction}>
                      <Text style={styles.detailSelectableValue}>{restLabel(detail)}</Text>
                      <Icon name="chevron-forward" size={21} color={theme.textSecondary} />
                    </View>
                  </Pressable>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Workout types</Text>
                    <View style={styles.sectionTypes}>
                      {detail.workoutTypeIds.map((id) => {
                        const type = preferences.workoutTypes.find((item) => item.id === id);
                        return (
                          <View
                            key={id}
                            testID={`exercise-section-type-${id}`}
                            style={styles.sectionType}
                          >
                            <Icon
                              name={type ? workoutTypeIcon(type) : 'layers'}
                              size={18}
                              color={theme.ink}
                            />
                            <Text style={styles.sectionTypeName}>{type?.name ?? id}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <Text style={styles.detailValue}>{detail.category}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Equipment</Text>
                    <Text style={styles.detailValue}>{detail.equipment}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Movement family</Text>
                    <Text style={styles.detailValue}>{detail.group}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tracking</Text>
                    <Text style={styles.detailValue}>{formatTrackingType(detail.trackingType)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Primary muscle</Text>
                    <Text style={styles.detailValue}>{detail.primaryMuscle}</Text>
                  </View>
                  {detail.secondaryMuscles.length > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Secondary muscles</Text>
                      <Text style={styles.detailValue}>{detail.secondaryMuscles.join(', ')}</Text>
                    </View>
                  )}
                  {isCustom(detail) ? (
                    <>
                      <Button
                        label="Edit variation"
                        variant="secondary"
                        haptic="none"
                        style={styles.editVariationAction}
                        onPress={() => {
                          close();
                          openEdit(detail);
                        }}
                      />
                    </>
                  ) : null}
                </View>
              </View>
            ))
          }
        </ForgeBottomSheet>
      </View>
    </AppScreen>
  );
}

function FormChoiceRow({
  label,
  accessibilityLabel,
  selected = false,
  onPress,
  icon,
  role = 'radio',
}: {
  label: string;
  accessibilityLabel: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  role?: 'checkbox' | 'radio';
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.formChoice,
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

function ExerciseFormOptionList({
  options,
  selected,
  accessibilityPrefix,
  onSelect,
  sourceIcon = false,
}: {
  options: { label: string; source: CatalogSource }[];
  selected?: string;
  accessibilityPrefix: string;
  onSelect: (value: string, source: CatalogSource) => void;
  sourceIcon?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.formChoiceList} accessibilityRole="radiogroup">
      {options.map((option) => (
        <FormChoiceRow
          key={option.label}
          label={option.label}
          icon={sourceIcon ? (option.source === 'forge' ? 'verified' : 'note') : undefined}
          selected={selected === option.label}
          accessibilityLabel={`${accessibilityPrefix} ${option.label}`}
          onPress={() => onSelect(option.label, option.source)}
        />
      ))}
    </View>
  );
}

function Movement({
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
  onToggle: () => void;
  onOpen: (item: ExerciseCatalogItem) => void;
  onAdd: () => void;
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
          onPress={onAdd}
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
        onPress={onToggle}
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
        <View style={styles.variations}>
          {equipment.map(([label, variants]) => (
            <View key={label} style={styles.equipmentGroup}>
              <Text style={styles.equipmentTitle}>{label}</Text>
              {variants.map((item) => {
                const label = item.variation || item.name;
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
            onPress={() => {
              onAdd();
            }}
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
}

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
  const actionWidth = 72;
  const [revealed, setRevealed] = useState(false);
  const offset = useSharedValue(0);
  const open = useSharedValue(false);
  const suppressNextPress = useRef(false);

  useEffect(() => {
    open.value = revealed;
    offset.value = withSpring(revealed ? -actionWidth : 0, swipeSpring);
  }, [offset, open, revealed]);

  const settle = (next: boolean, dragged: boolean): void => {
    if (dragged) suppressNextPress.current = true;
    if (next !== revealed) {
      mediumHaptic();
      setRevealed(next);
      return;
    }
    offset.value = withSpring(next ? -actionWidth : 0, swipeSpring);
  };
  const pan = Gesture.Pan()
    // Do not let a diagonal list scroll activate this horizontal delete gesture.
    .activeOffsetX([-16, 16])
    .failOffsetY([-6, 6])
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
  const label = item.variation || item.name;

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
    content: {
      padding: settingsLayout.screenPadding,
      paddingTop: settingsLayout.contentTop,
      paddingBottom: 112,
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
      backgroundColor: theme.surfaceInset,
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
      minWidth: 80,
      height: 38,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceMuted,
      paddingHorizontal: 12,
    },
    restTimeDefaultActionSelected: { borderColor: theme.selectionIndicator },
    restTimeDefaultLabel: { ...typeScale.controlLabel, color: theme.textPrimary },
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
    formScroll: { flexGrow: 0, flexShrink: 1 },
    form: { padding: 20, gap: 18, paddingBottom: 128 },
    formPickerContent: { padding: 20, gap: 12, paddingBottom: 36 },
    formBackAction: { minHeight: 36, paddingHorizontal: 10, borderRadius: 18 },
    formInputCard: { overflow: 'hidden', borderRadius: 16 },
    formNameInput: { minHeight: 52, paddingHorizontal: 14, color: theme.ink, ...typeScale.body },
    formSectionCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    formValue: { ...typeScale.supporting, color: theme.textSecondary, textAlign: 'right', maxWidth: 130 },
    formChoiceList: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
    formChoice: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    formChoiceText: { flex: 1, ...typeScale.cardTitle, color: theme.textPrimary },
    detailContent: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 0, gap: 0 },
    editVariationAction: { marginTop: 16, marginBottom: 8 },
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
    fieldLabel: { ...typeScale.label, color: theme.slate, marginTop: 5 },
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
