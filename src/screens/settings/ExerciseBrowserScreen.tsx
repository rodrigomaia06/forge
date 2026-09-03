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
import { forgeSheetHeader } from '../../components/ui/ForgeBottomSheet';
import type { ForgeSingleSelectOption } from '../../components/ui';
import type { ExerciseCatalogItem } from '../../data/exerciseCatalog';
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
type Filters = { types: string[]; equipment: string[]; categories: string[] };
type DetailSheetView = 'details' | 'restTime';
type CatalogSource = 'forge' | 'custom';

function formatPickerDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
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
  const [filters, setFilters] = useState<Filters>({ types: [], equipment: [], categories: [] });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formParent, setFormParent] = useState<string | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [categorySource, setCategorySource] = useState<CatalogSource | null>(null);
  const [equipmentValue, setEquipmentValue] = useState('Bodyweight');
  const [primaryMuscle, setPrimaryMuscle] = useState('Accessories');
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
  const toggle = (key: keyof Filters, value: string) => {
    selectionHaptic();
    setFilters((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  };
  const active = filters.types.length + filters.equipment.length + filters.categories.length;
  const filtered = useMemo(
    () =>
      filterCatalog(source, {
        query,
        types: filters.types,
        equipment: filters.equipment,
        categories: filters.categories,
        includeGroupInSearch: true,
      }).filter((item) => !fixedTypeId || item.workoutTypeIds.includes(fixedTypeId)),
    [source, fixedTypeId, filters, query],
  );
  const groups = useMemo(() => groupCatalogByMovement(filtered), [filtered]);
  const { equipment, categories } = catalogFacets(catalog.exercises);
  const forgeEquipmentOptions = useMemo(
    () => Array.from(new Set(catalog.exercises.map((item) => item.equipment))),
    [catalog.exercises],
  );
  const customEquipmentOptions = useMemo(
    () => Array.from(new Set(catalog.customExercises.map((item) => item.equipment))),
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
    setName('');
    setGroup(parent ?? '');
    setCategorySource(parent ? sourceForCategory(parent) : null);
    setEquipmentValue(inherited?.equipment ?? 'Bodyweight');
    setPrimaryMuscle(inherited?.primaryMuscle ?? 'Accessories');
    setSecondaryMuscles(inherited?.secondaryMuscles ?? []);
    setWorkoutTypeIds(inherited?.workoutTypeIds ?? (fixedTypeId ? [fixedTypeId] : ['strength']));
    setFormParent(parent);
  };
  const openEdit = (item: ExerciseCatalogItem) => {
    lightHaptic();
    savingVariation.current = false;
    setDetail(null);
    setEditing(item);
    setName(item.variation || item.name);
    setGroup(item.group);
    setCategorySource(sourceForCategory(item.group));
    setEquipmentValue(item.equipment);
    setPrimaryMuscle(item.primaryMuscle);
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
      category: primaryMuscle,
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
          backAccessibilityLabel="Back to Exercises"
          rightAction={
            <HeaderAction
              accessibilityLabel="Create custom exercise"
              icon="add"
              iconOnly
              onPress={() => openCreate(null)}
            />
          }
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
                accessibilityLabel="Filters"
                label="Filters"
                icon="filter"
                variant="secondary"
                tone="neutral"
                onPress={() => {
                  setFiltersOpen(true);
                }}
                style={styles.filters}
              />
            )}
          </View>
          {!customOnly && active > 0 && (
            <ScrollView
              horizontal
              contentContainerStyle={styles.chips}
              showsHorizontalScrollIndicator={false}
            >
              {(
                [
                  ['types', filters.types],
                  ['equipment', filters.equipment],
                  ['categories', filters.categories],
                ] as const
              ).flatMap(([key, values]) =>
                values.map((value) => (
                  <Button
                    key={`${key}-${value}`}
                    accessibilityLabel={`Remove ${value} filter`}
                    label={visibleTypes.find((type) => type.id === value)?.name ?? value}
                    icon="close"
                    iconSize={14}
                    variant="ghost"
                    onPress={() => toggle(key, value)}
                    style={styles.chip}
                  />
                )),
              )}
              <Button
                accessibilityLabel="Clear all filters"
                label="Clear all"
                variant="ghost"
                onPress={() => {
                  setFilters({ types: [], equipment: [], categories: [] });
                }}
              />
            </ScrollView>
          )}
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
              <Text style={styles.meta}>Try removing a filter or create a custom exercise.</Text>
            </View>
          )}
        </ScrollView>
        <ForgeBottomSheet
          testID="exercise-filter-sheet"
          visible={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          accessibilityLabel="Close exercise filters"
        >
          {(close) => (
            <View style={[styles.sheet, { maxHeight: Math.min(viewportHeight * 0.82, 680) }]}>
              <ForgeBottomSheetHandle />
              <ForgeSheetHeader
                title="Filters"
                onClose={close}
                closeAccessibilityLabel="Close exercise filters"
                trailing={
                  active > 0 ? (
                    <HeaderAction
                      accessibilityLabel="Clear filters in sheet"
                      label="Clear"
                      icon="close"
                      onPress={() => {
                        setFilters({ types: [], equipment: [], categories: [] });
                      }}
                    />
                  ) : undefined
                }
              />
              <ScrollView style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
                {!fixedTypeId && (
                  <FilterSection
                    title="Workout type"
                    icon="layers"
                    values={visibleTypes.map((item) => [item.id, item.name])}
                    selected={filters.types}
                    onToggle={(value) => toggle('types', value)}
                  />
                )}
                <FilterSection
                  title="Equipment"
                  icon="fitness-outline"
                  values={equipment.map((value) => [value, value])}
                  selected={filters.equipment}
                  onToggle={(value) => toggle('equipment', value)}
                />
                <FilterSection
                  title="Muscle group"
                  icon="activity"
                  values={categories.map((value) => [value, value])}
                  selected={filters.categories}
                  onToggle={(value) => toggle('categories', value)}
                />
              </ScrollView>
              <View style={styles.footer}>
                <Button label="Done" onPress={close} />
              </View>
            </View>
          )}
        </ForgeBottomSheet>
        <ForgeBottomSheet
          visible={formParent !== undefined}
          onClose={() => {
            savingVariation.current = false;
            setFormParent(undefined);
            setEditing(null);
          }}
          accessibilityLabel="Close custom exercise form"
          surfaceTestID="custom-exercise-form-surface"
          keyboardAvoiding
        >
          {(close) => (
            <View style={[styles.formSheet, { maxHeight: Math.min(viewportHeight * 0.82, 640) }]}>
              <ForgeBottomSheetHandle />
              <ForgeSheetHeader
                title={
                  editing
                    ? 'Edit variation'
                    : formParent
                      ? 'Add variation'
                      : 'New custom exercise'
                }
                onClose={close}
                closeAccessibilityLabel="Close custom exercise form"
                trailing={
                  <HeaderAction
                    accessibilityLabel="Save variation"
                    icon="check"
                    iconOnly
                    variant="outline"
                    tone={name.trim() ? 'success' : 'neutral'}
                    disabled={!name.trim()}
                    onPress={() => {
                      if (save()) close();
                    }}
                  />
                }
              />
              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.form}
                keyboardShouldPersistTaps="handled"
              >
                <TextInput
                  accessibilityLabel="Exercise name"
                  value={name}
                  onChangeText={setName}
                  placeholder={formParent ? 'Variation name' : 'Exercise name'}
                  placeholderTextColor={theme.muted}
                  style={styles.input}
                />
                {!formParent && (
                  <>
                    <View style={styles.categorySearch}>
                      <Icon name="search" size={19} color={theme.slate} />
                      <TextInput
                        accessibilityLabel="Exercise category"
                        value={group}
                        onChangeText={(value) => {
                          setGroup(value);
                          setCategorySource(null);
                        }}
                        placeholder="Search or add a category"
                        placeholderTextColor={theme.muted}
                        style={styles.categorySearchInput}
                      />
                      {categorySource && (
                        <Icon
                          name={categorySource === 'forge' ? 'verified' : 'note'}
                          size={18}
                          color={theme.slate}
                          testID={`category-source-${categorySource}`}
                        />
                      )}
                    </View>
                    {group.trim() && !categorySource ? (
                      <View style={styles.categorySuggestions}>
                        {categoryMatches.map(({ label, source }) => (
                          <Pressable
                            key={label}
                            accessibilityRole="button"
                            accessibilityLabel={`Use category ${label}`}
                            onPress={() => {
                              selectionHaptic();
                              setGroup(label);
                              setCategorySource(source);
                            }}
                            style={({ pressed }) => [styles.categorySuggestion, pressed && pressedFeedback]}
                          >
                            <Icon name="layers-outline" size={16} color={theme.slate} />
                            <Text style={styles.categorySuggestionText}>{label}</Text>
                            <Icon
                              name={source === 'forge' ? 'verified' : 'note'}
                              size={16}
                              color={theme.slate}
                            />
                          </Pressable>
                        ))}
                        {!isExistingCategory && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Add ${group.trim()} as a custom category`}
                            onPress={() => {
                              selectionHaptic();
                              setCategorySource('custom');
                            }}
                            style={({ pressed }) => [styles.categorySuggestion, pressed && pressedFeedback]}
                          >
                            <Icon name="add" size={17} color={theme.ink} />
                            <Text style={styles.categorySuggestionText}>
                              Add “{group.trim()}” as custom
                            </Text>
                            <Icon name="note" size={16} color={theme.slate} />
                          </Pressable>
                        )}
                      </View>
                    ) : null}
                  </>
                )}
                <>
                  <Text style={styles.fieldLabel}>Equipment</Text>
                  <View
                    accessibilityRole="radiogroup"
                    accessibilityLabel="Exercise equipment"
                    style={styles.choiceWrap}
                  >
                    {selectableEquipment.map((item) => (
                      <Choice
                        key={item}
                        label={item}
                        accessibilityLabel={`Equipment ${item}`}
                        role="radio"
                        selected={equipmentValue === item}
                        selectionIcon={sourceForEquipment(item) === 'forge' ? 'verified' : 'note'}
                        onPress={() => {
                          selectionHaptic();
                          setEquipmentValue(item);
                        }}
                      />
                    ))}
                    <Choice
                      icon="add"
                      label="Custom equipment"
                      accessibilityLabel="Add custom equipment"
                      role="radio"
                      selected={usesCustomEquipment}
                      selectionIcon="note"
                      onPress={() => {
                        selectionHaptic();
                        setEquipmentValue('');
                      }}
                    />
                  </View>
                  {usesCustomEquipment && (
                  <TextInput
                    accessibilityLabel="Custom equipment"
                    value={equipmentValue}
                    onChangeText={setEquipmentValue}
                    placeholder="Custom equipment"
                    placeholderTextColor={theme.muted}
                    style={styles.input}
                  />
                  )}
                </>
                <Text style={styles.fieldLabel}>Sections</Text>
                <View style={styles.choiceWrap}>
                  {visibleTypes.map((type) => (
                    <Choice
                      key={type.id}
                      icon={workoutTypeIcon(type)}
                      label={type.name}
                      accessibilityLabel={`Section ${type.name}`}
                      selected={workoutTypeIds.includes(type.id)}
                      onPress={() => toggleSection(type.id)}
                    />
                  ))}
                </View>
                <Text style={styles.fieldLabel}>Primary muscle</Text>
                <View style={styles.choiceWrap}>
                  {categories.map((muscle) => (
                    <Choice
                      key={muscle}
                      label={muscle}
                      accessibilityLabel={`Primary ${muscle}`}
                      selected={primaryMuscle === muscle}
                      onPress={() => {
                        selectionHaptic();
                        setPrimaryMuscle(muscle);
                      }}
                    />
                  ))}
                </View>
                <Text style={styles.fieldLabel}>Secondary muscles</Text>
                <View style={styles.choiceWrap}>
                  {categories
                    .filter((muscle) => muscle !== primaryMuscle)
                    .map((muscle) => (
                      <Choice
                        key={muscle}
                        label={muscle}
                        accessibilityLabel={`Secondary ${muscle}`}
                        selected={secondaryMuscles.includes(muscle)}
                        onPress={() => toggleSecondary(muscle)}
                      />
                    ))}
                </View>
              </ScrollView>
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
                    <Text style={styles.detailLabel}>Sections</Text>
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
                    <Text style={styles.detailValue}>{detail.group}</Text>
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

function Choice({
  label,
  accessibilityLabel,
  selected,
  onPress,
  icon,
  selectionIcon = 'check',
  role = 'checkbox',
}: {
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  selectionIcon?: IconName;
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
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && { borderColor: theme.ink },
        pressed && pressedFeedback,
      ]}
    >
      {icon && <Icon name={icon} size={16} color={theme.ink} />}
      <Text style={styles.choiceText}>{label}</Text>
      {selected && (
        <Icon
          name={selectionIcon}
          size={15}
          color={theme.ink}
          testID={`choice-selection-${selectionIcon}`}
        />
      )}
    </Pressable>
  );
}

function FilterSection({
  title,
  icon,
  values,
  selected,
  onToggle,
}: {
  title: string;
  icon: IconName;
  values: string[][];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  return (
      <View style={styles.filterSection}>
      <View style={styles.filterHeading}>
        <Icon name={icon} size={18} color={theme.ink} />
        <Text style={styles.filterTitle}>{title}</Text>
      </View>
      <View style={styles.filterChoices}>
        {values.map(([value, label]) => {
          const isSelected = selected.includes(value);
          return (
            <Pressable
              key={value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              onPress={() => onToggle(value)}
              style={({ pressed }) => [
                styles.filterChoice,
                isSelected && { borderColor: theme.selectionIndicator },
                pressed && pressedFeedback,
              ]}
            >
              <Text style={styles.filterChoiceText}>{label}</Text>
              {isSelected && <Icon name="check" size={15} color={theme.ink} />}
            </Pressable>
          );
        })}
      </View>
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
        accessibilityLabel={`${group}, ${items.length} variations`}
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
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
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
      backgroundColor: theme.destructiveSurface,
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
    customSwipeSurface: { zIndex: 1, backgroundColor: theme.surfaceElevated },
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
    filterSection: { gap: 8 },
    filterHeading: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 8 },
    filterTitle: { ...typeScale.sectionTitle, color: theme.slate },
    filterChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterChoice: {
      minHeight: 38,
      paddingHorizontal: 11,
      borderRadius: 19,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    filterChoiceText: { ...typeScale.label, color: theme.ink },
    footer: {
      padding: 16,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
    formScroll: { flexGrow: 0, flexShrink: 1 },
    form: { padding: 20, gap: 12, paddingBottom: 28 },
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
    categorySuggestions: {
      overflow: 'hidden',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.divider,
      backgroundColor: theme.surfaceElevated,
    },
    categorySuggestion: {
      minHeight: 44,
      paddingHorizontal: 14,
      gap: 8,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
    categorySuggestionText: { ...typeScale.controlLabel, color: theme.ink, flex: 1 },
    fieldLabel: { ...typeScale.label, color: theme.slate, marginTop: 5 },
    choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    choice: {
      minHeight: 38,
      paddingHorizontal: 11,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: theme.divider,
      backgroundColor: theme.surfaceElevated,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    choiceText: { ...typeScale.label, color: theme.ink },
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
