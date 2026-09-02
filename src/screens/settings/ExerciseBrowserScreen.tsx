import React, { useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, UIManager, useWindowDimensions, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeSingleSelectList,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  HeaderAction,
  Icon,
  lightHaptic,
  pressedFeedback,
  selectionHaptic,
} from '../../components/ui';
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

type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseBrowser'>;
type Filters = { types: string[]; equipment: string[]; categories: string[] };
type DetailSheetView = 'details' | 'restTime';

function formatPickerDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

const restTimeOptions: readonly ForgeSingleSelectOption<number>[] = REST_DURATION_OPTIONS.map((seconds) => ({
  value: seconds,
  label: formatPickerDuration(seconds),
  accessibilityLabel: `Rest duration ${formatPickerDuration(seconds)}`,
}));

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
  const formEquipment = useMemo(() => {
    if (!formParent) return [];
    return Array.from(new Set(
      [...catalog.exercises, ...catalog.customExercises]
        .filter((item) => item.group === formParent)
        .map((item) => item.equipment),
    ));
  }, [catalog.customExercises, catalog.exercises, formParent]);
  const usesCustomEquipment = formParent !== null
    && formParent !== undefined
    && !formEquipment.includes(equipmentValue);
  const isCustom = (item: ExerciseCatalogItem) => catalog.customExercises.some((custom) => custom.id === item.id);
  const restOverride = (item: ExerciseCatalogItem) =>
    isCustom(item) ? item.restSeconds : preferences.exerciseRestSeconds[item.id];
  const restLabel = (item: ExerciseCatalogItem) => {
    const value = restOverride(item);
    return value === undefined ? 'Default' : `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
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
    setSecondaryMuscles((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };
  const toggleSection = (value: string) => {
    selectionHaptic();
    setWorkoutTypeIds((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
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
    setDetail((current) => current && current.id === item.id ? { ...current, restSeconds: seconds } : current);
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
              tone="accent"
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
            <View style={styles.sheet}>
              <ForgeBottomSheetHandle />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Filters</Text>
                {active > 0 && (
                  <HeaderAction
                    accessibilityLabel="Clear filters in sheet"
                    label="Clear"
                    icon="close"
                    onPress={() => {
                      setFilters({ types: [], equipment: [], categories: [] });
                    }}
                  />
                )}
              </View>
              <ScrollView style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
                {!fixedTypeId && (
                  <FilterSection
                    title="Workout type"
                    values={visibleTypes.map((item) => [item.id, item.name])}
                    selected={filters.types}
                    onToggle={(value) => toggle('types', value)}
                  />
                )}
                <FilterSection
                  title="Equipment"
                  values={equipment.map((value) => [value, value])}
                  selected={filters.equipment}
                  onToggle={(value) => toggle('equipment', value)}
                />
                <FilterSection
                  title="Muscle group"
                  values={categories.map((value) => [value, value])}
                  selected={filters.categories}
                  onToggle={(value) => toggle('categories', value)}
                />
              </ScrollView>
              <View style={styles.footer}>
                <Button label="Done" tone="success" onPress={close} />
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
        >
          {(close) => (
            <View style={[styles.formSheet, { height: Math.min(viewportHeight * 0.82, 640) }]}>
              <ForgeBottomSheetHandle />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {editing
                    ? 'Edit variation'
                    : formParent
                      ? 'Add variation'
                      : 'New custom exercise'}
                </Text>
                <HeaderAction
                  accessibilityLabel="Save variation"
                  icon="check"
                  iconOnly
                  tone="success"
                  disabled={!name.trim()}
                  onPress={() => {
                    if (save()) close();
                  }}
                />
              </View>
              <ScrollView style={styles.formScroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                <TextInput
                  accessibilityLabel="Exercise name"
                  value={name}
                  onChangeText={setName}
                  placeholder={formParent ? 'Variation name' : 'Exercise name'}
                  placeholderTextColor={theme.muted}
                  style={styles.input}
                />
                {!formParent && <TextInput accessibilityLabel="Exercise category" value={group} onChangeText={setGroup} placeholder="Category" placeholderTextColor={theme.muted} style={styles.input} />}
                {formParent ? (
                  <>
                    <Text style={styles.fieldLabel}>Equipment</Text>
                    <View accessibilityRole="radiogroup" accessibilityLabel="Exercise equipment" style={styles.choiceWrap}>
                      {formEquipment.map((item) => (
                        <Choice
                          key={item}
                          label={item}
                          accessibilityLabel={`Equipment ${item}`}
                          role="radio"
                          selected={equipmentValue === item}
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
                ) : (
                  <TextInput accessibilityLabel="Exercise equipment" value={equipmentValue} onChangeText={setEquipmentValue} placeholder="Equipment" placeholderTextColor={theme.muted} style={styles.input} />
                )}
                <Text style={styles.fieldLabel}>Sections</Text>
                <View style={styles.choiceWrap}>
                  {visibleTypes.map((type) => <Choice key={type.id} icon={workoutTypeIcon(type)} label={type.name} accessibilityLabel={`Section ${type.name}`} selected={workoutTypeIds.includes(type.id)} onPress={() => toggleSection(type.id)} />)}
                </View>
                <Text style={styles.fieldLabel}>Primary muscle</Text>
                <View style={styles.choiceWrap}>
                  {categories.map((muscle) => <Choice key={muscle} label={muscle} accessibilityLabel={`Primary ${muscle}`} selected={primaryMuscle === muscle} onPress={() => { selectionHaptic(); setPrimaryMuscle(muscle); }} />)}
                </View>
                <Text style={styles.fieldLabel}>Secondary muscles</Text>
                <View style={styles.choiceWrap}>
                  {categories.filter((muscle) => muscle !== primaryMuscle).map((muscle) => <Choice key={muscle} label={muscle} accessibilityLabel={`Secondary ${muscle}`} selected={secondaryMuscles.includes(muscle)} onPress={() => toggleSecondary(muscle)} />)}
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
          {(close) => detail && (detailSheetView === 'restTime' ? (
            <View testID="exercise-rest-selection-view" style={styles.restTimeSheet}>
              <ForgeBottomSheetHandle />
              <View style={styles.restTimeHeader}>
                <HeaderAction
                  accessibilityLabel="Back to exercise details"
                  icon="chevron-back"
                  iconOnly
                  onPress={() => transitionDetailSheet('details')}
                  style={styles.restTimeBack}
                />
                <Text style={styles.restTimeTitle}>Rest Time</Text>
                <View style={styles.restTimeHeaderSpacer} />
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
              </View>
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
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, styles.detailSheetTitle]}>{detail.variation || detail.name}</Text>
                  {isCustom(detail) && (
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
                  )}
                </View>
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
                          <View key={id} testID={`exercise-section-type-${id}`} style={styles.sectionType}>
                            <Icon name={type ? workoutTypeIcon(type) : 'layers'} size={18} color={theme.ink} />
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
                  {detail.secondaryMuscles.length > 0 && <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Secondary muscles</Text>
                    <Text style={styles.detailValue}>{detail.secondaryMuscles.join(', ')}</Text>
                  </View>
                  }
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
            ))}
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
  role = 'checkbox',
}: {
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  role?: 'checkbox' | 'radio';
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  return <Pressable accessibilityRole={role} accessibilityLabel={accessibilityLabel} accessibilityState={{ checked: selected }} aria-checked={selected} onPress={onPress} style={({ pressed }) => [styles.choice, selected && { borderColor: theme.ink }, pressed && pressedFeedback]}>
    {icon && <Icon name={icon} size={16} color={theme.ink} />}
    <Text style={styles.choiceText}>{label}</Text>{selected && <Icon name="check" size={15} color={theme.ink} />}
  </Pressable>;
}

function FilterSection({
  title,
  values,
  selected,
  onToggle,
}: {
  title: string;
  values: string[][];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterTitle}>{title}</Text>
      {values.map(([value, label]) => (
        <Pressable
          key={value}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected.includes(value) }}
          onPress={() => onToggle(value)}
          style={({ pressed }) => [styles.option, pressed && pressedFeedback]}
        >
          <Text style={styles.optionText}>{label}</Text>
          <View style={[styles.check, selected.includes(value) && styles.checkSelected]}>
            {selected.includes(value) && <Icon name="check" size={14} color={theme.background} />}
          </View>
        </Pressable>
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
}: {
  group: string;
  items: ExerciseCatalogItem[];
  expanded: boolean;
  onToggle: () => void;
  onOpen: (item: ExerciseCatalogItem) => void;
  onAdd: () => void;
  isCustom: (item: ExerciseCatalogItem) => boolean;
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
      <View style={styles.movement}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${group}`}
          onPress={() => {
            lightHaptic();
            onOpen(item);
          }}
          style={styles.movementRow}
        >
          <View style={styles.copy}>
            <Text style={styles.movementName}>{group}</Text>
            <Text style={styles.meta}>
              {item.equipment} · {item.category}
            </Text>
          </View>
          <View style={styles.movementIcons}>
            {isCustom(item) && <Icon name="note" size={17} color={theme.textSecondary} />}
            <Icon name="chevron-forward" size={21} color={theme.textPrimary} />
          </View>
        </Pressable>
        <Button
          accessibilityLabel={`Add variation to ${group}`}
          label="Add variation"
          icon="add"
          iconSize={18}
          variant="ghost"
          tone="accent"
          onPress={onAdd}
          style={styles.singleAddVariation}
        />
      </View>
    );
  }
  return (
    <View style={styles.movement}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${group}, ${items.length} variations`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.movementRow}
      >
        <View style={styles.copy}>
          <Text style={styles.movementName}>{group}</Text>
          <Text style={styles.meta}>
            {items.length} {items.length === 1 ? 'variation' : 'variations'}
          </Text>
        </View>
        <Icon
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={21}
          color={theme.textPrimary}
        />
      </Pressable>
      {expanded && (
        <View style={styles.variations}>
          {equipment.map(([label, variants]) => (
            <View key={label} style={styles.equipmentGroup}>
              <Text style={styles.equipmentTitle}>{label}</Text>
              {variants.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => {
                    lightHaptic();
                    onOpen(item);
                  }}
                  style={({ pressed }) => [
                    styles.variation,
                    pressed && { backgroundColor: theme.pressed },
                  ]}
                >
                  <Text style={styles.variationName}>{item.variation || item.name}</Text>
                  <View style={styles.variationIcons}>
                    {isCustom(item) && <Icon name="note" size={16} color={theme.textSecondary} />}
                    <Icon name="chevron-forward" size={17} color={theme.slate} />
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
          <Button
            onPress={() => {
              onAdd();
            }}
            accessibilityLabel={`Add variation to ${group}`}
            label="Add variation"
            icon="add"
            iconSize={18}
            variant="ghost"
            tone="accent"
            style={styles.addVariation}
          />
        </View>
      )}
    </View>
  );
}
const createStyles = (theme: import('../../types').ForgeTheme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: { padding: 20, paddingTop: 22, paddingBottom: 40, gap: 14 },
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
    movement: {
      overflow: 'hidden',
      borderRadius: theme.cardRadius,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    movementRow: {
      minHeight: 76,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    copy: { flex: 1 },
    movementName: { ...typeScale.cardTitle, color: theme.ink },
    movementIcons: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    meta: { ...typeScale.supporting, color: theme.slate, marginTop: 2 },
    variations: {
      padding: 14,
      backgroundColor: theme.surfaceMuted,
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
      minHeight: 46,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
    variationName: { ...typeScale.body, color: theme.ink },
    variationIcons: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    addVariation: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 0 },
    empty: { paddingTop: 60, alignItems: 'center' },
    sheet: { height: '78%' },
    formSheet: {},
    detailSheet: {},
    restTimeSheet: { minHeight: 400 },
    restTimeHeader: {
      minHeight: 56,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
    },
    restTimeBack: { width: 44, height: 44, minWidth: 44, minHeight: 44 },
    restTimeTitle: { flex: 1, textAlign: 'center', ...typeScale.headerTitle, color: theme.ink },
    restTimeHeaderSpacer: { width: 44 },
    restTimeDefaultAction: {
      position: 'absolute',
      right: 20,
      minWidth: 80,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceMuted,
      paddingHorizontal: 12,
    },
    restTimeDefaultActionSelected: { borderColor: theme.inkInteractive },
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
    detailValue: { ...typeScale.body, color: theme.ink, textAlign: 'right', flexShrink: 1, marginLeft: 16 },
    detailAction: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    detailSelectableValue: { ...typeScale.body, color: theme.textSecondary, textAlign: 'right', flexShrink: 1, marginLeft: 16 },
    sectionTypes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, flexShrink: 1, marginLeft: 16 },
    sectionType: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    sectionTypeName: { ...typeScale.body, color: theme.ink },
    sheetHeader: {
      minHeight: 56,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sheetTitle: { ...typeScale.headerTitle, color: theme.ink },
    detailSheetTitle: { flex: 1, minWidth: 0, marginRight: 12 },
    filterScroll: { flex: 1 },
    filterContent: { padding: 20, paddingTop: 4, gap: 22, paddingBottom: 24 },
    filterSection: { gap: 8 },
    filterTitle: { ...typeScale.sectionTitle, color: theme.slate },
    option: {
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    optionText: { ...typeScale.body, color: theme.ink },
    check: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.slate,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkSelected: { borderColor: theme.inkInteractive, backgroundColor: theme.inkInteractive },
    footer: {
      padding: 16,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
    formScroll: { flex: 1 },
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
    fieldLabel: { ...typeScale.label, color: theme.slate, marginTop: 5 },
    choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    choice: { minHeight: 38, paddingHorizontal: 11, borderRadius: 19, borderWidth: 1, borderColor: theme.divider, backgroundColor: theme.surfaceElevated, flexDirection: 'row', alignItems: 'center', gap: 5 },
    choiceText: { ...typeScale.label, color: theme.ink },
    singleAddVariation: {
      alignSelf: 'flex-start',
      minHeight: 44,
      paddingHorizontal: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
  });
