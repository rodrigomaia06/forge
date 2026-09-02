import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  AppScreen,
  Button,
  ForgeCard,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeSwitch,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  HeaderAction,
  HeaderEdge,
  Icon,
  lightHaptic,
  pressedFeedback,
  selectionHaptic,
  successHaptic,
} from '../../components/ui';
import { usePlans } from '../../state/PlansContext';
import { useSettings } from '../../state/SettingsContext';
import { useWorkouts } from '../../state/WorkoutContext';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { RootStackParamList, WorkoutTypePreference } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { SettingsRow, SettingsSection, settingsLayout } from './SettingsRow';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutTypeEditor'>;
const colors = [
  { name: 'Blue', value: '#7C8CF8' },
  { name: 'Green', value: '#6BD48F' },
  { name: 'Red', value: '#F27D7D' },
  { name: 'Orange', value: '#F4A261' },
  { name: 'Purple', value: '#B78AF0' },
  { name: 'Gray', value: '#9CA3AF' },
];
const customColors = Array.from({ length: 48 }, (_, index) => {
  const hue = (index % 12) * 30;
  const lightness = 34 + Math.floor(index / 12) * 11;
  return hslToHex(hue, 76, lightness);
});

export function WorkoutTypeEditorScreen({ navigation, route }: Props) {
  const dashboardTheme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { preferences, updatePreferences } = useSettings();
  const { activeWorkout, completedWorkouts } = useWorkouts();
  const { plans, standaloneRoutines } = usePlans();
  const creating = 'mode' in route.params && route.params.mode === 'create';
  const initialDraft = creating
    ? {
        id: route.params.draftId,
        name: 'New type',
        color: route.params.initialColor,
        source: 'custom' as const,
      }
    : null;
  const [draft, setDraft] = useState<WorkoutTypePreference | null>(initialDraft);
  const confirmedDraftDiscard = useRef(false);
  const storedParams = 'workoutTypeId' in route.params ? route.params : null;
  const storedType = storedParams
    ? preferences.workoutTypes.find((item) => item.id === storedParams.workoutTypeId)
    : undefined;
  const type = creating ? draft : storedType;
  const [customColorPickerOpen, setCustomColorPickerOpen] = useState(false);
  const referenced = useMemo(() => {
    if (!type) return false;
    const workouts = [activeWorkout, ...completedWorkouts]
      .filter(Boolean)
      .some((workout) => workout?.type === type.name);
    return (
      workouts ||
      [...standaloneRoutines, ...plans.flatMap((plan) => plan.routines)].some(
        (routine) => routine.type === type.name,
      )
    );
  }, [activeWorkout, completedWorkouts, plans, standaloneRoutines, type]);

  if (!type)
    return (
      <AppScreen backgroundColor={dashboardTheme.background}>
        <SettingsDetailHeader title="Workout type" navigation={navigation} />
      </AppScreen>
    );
  const builtIn = type.source === 'builtIn';
  const change = (changes: Partial<WorkoutTypePreference>): void => {
    if (creating) {
      setDraft((current) => (current ? { ...current, ...changes } : current));
      return;
    }
    updatePreferences({
      workoutTypes: preferences.workoutTypes.map((item) =>
        item.id === type.id
          ? { ...item, ...changes, hasReferencedData: item.hasReferencedData || referenced }
          : item,
      ),
    });
  };
  const draftChanged =
    creating && draft !== null && initialDraft !== null
      ? draft.name !== initialDraft.name || draft.color !== initialDraft.color
      : false;
  const discardDraft = (): void => {
    if (!draftChanged) lightHaptic();
    navigation.goBack();
  };

  useEffect(() => {
    if (!creating || !draftChanged) return undefined;
    return navigation.addListener('beforeRemove', (event) => {
      if (confirmedDraftDiscard.current) return;
      event.preventDefault();
      Alert.alert('Discard new workout type?', 'Your unsaved changes will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            confirmedDraftDiscard.current = true;
            lightHaptic();
            navigation.dispatch(event.data.action);
          },
        },
      ]);
    });
  }, [creating, draftChanged, navigation]);
  const saveDraft = (): void => {
    const name = draft?.name.trim() ?? '';
    if (!draft || !name) return;
    updatePreferences({ workoutTypes: [...preferences.workoutTypes, { ...draft, name }] });
    successHaptic();
    confirmedDraftDiscard.current = true;
    navigation.goBack();
  };
  const mustHide = type.source === 'builtIn' || type.hasReferencedData || referenced;
  const destructiveLabel = type.hidden ? 'Unhide type' : mustHide ? 'Hide type' : 'Delete type';
  const removeOrHide = (): void => {
    const hide = mustHide;
    Alert.alert(
      hide ? 'Hide workout type?' : 'Delete workout type?',
      hide ? 'Past workouts, routines, and plans keep their saved type.' : 'This cannot be undone.',
      [
        {
          text: hide ? 'Hide' : 'Delete',
          style: 'destructive',
          onPress: () => {
            lightHaptic();
            if (hide) change({ hidden: true });
            else
              updatePreferences({
                workoutTypes: preferences.workoutTypes.filter((item) => item.id !== type.id),
              });
            navigation.goBack();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  return (
    <AppScreen backgroundColor={dashboardTheme.background}>
      <View style={styles.screen}>
        {creating ? (
          <View style={styles.createHeader}>
            <HeaderAction
              accessibilityLabel="Cancel new workout type"
              icon="close"
              label="Cancel"
              iconOnly
              onPress={discardDraft}
              haptic="none"
            />
            <View
              testID="new-workout-type-title-wrap"
              pointerEvents="none"
              style={styles.createTitleWrap}
            >
              <Text numberOfLines={1} style={styles.createTitle}>
                New workout type
              </Text>
            </View>
            <HeaderAction
              accessibilityLabel="Save workout type"
              icon="check"
              label="Save"
              onPress={saveDraft}
              disabled={!draft?.name.trim()}
              haptic="none"
            />
            <HeaderEdge />
          </View>
        ) : (
          <SettingsDetailHeader
            title={type.name.trim() || 'Workout type'}
            navigation={navigation}
          />
        )}
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ForgeCard variant="elevated" style={styles.identityCard}>
            {builtIn ? (
              <Text style={styles.input}>{type.name}</Text>
            ) : (
              <TextInput
                accessibilityLabel="Workout type name"
                value={type.name}
                onChangeText={(name) => change({ name })}
                placeholder="Workout type"
                placeholderTextColor={dashboardTheme.muted}
                style={styles.input}
              />
            )}
            <View style={styles.divider} />
            <View style={styles.sourceRow}>
              <View style={styles.sourceIcon}>
                <Icon
                  name={type.source === 'builtIn' ? 'verified' : 'note'}
                  size={17}
                  color={dashboardTheme.slate}
                  accessibilityLabel={
                    type.source === 'builtIn' ? 'Included with Forge' : 'Created by you'
                  }
                />
              </View>
              <Text style={styles.source}>
                {type.source === 'builtIn' ? 'Included with Forge' : 'Created by you'}
              </Text>
            </View>
          </ForgeCard>
          {!builtIn && (
            <SettingsSection title="Color" cardStyle={styles.colorCard}>
              {colors.map((choice, index) => (
                <React.Fragment key={choice.value}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${choice.name} color`}
                    accessibilityState={{ selected: type.color.toUpperCase() === choice.value }}
                    onPress={() => {
                      selectionHaptic();
                      change({ color: choice.value });
                    }}
                    style={({ pressed }) => [styles.colorRow, pressed && pressedFeedback]}
                  >
                    <View style={[styles.swatch, { backgroundColor: choice.value }]} />
                    <Text style={styles.colorName}>{choice.name}</Text>
                    {type.color.toUpperCase() === choice.value && (
                      <Icon name="check" size={18} color={dashboardTheme.selectionIndicator} weight="bold" />
                    )}
                  </Pressable>
                  {index < colors.length - 1 && <View style={styles.rowDivider} />}
                </React.Fragment>
              ))}
              <View style={styles.rowDivider} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose custom workout type color"
                onPress={() => {
                  lightHaptic();
                  setCustomColorPickerOpen(true);
                }}
                style={({ pressed }) => [styles.customRow, pressed && pressedFeedback]}
              >
                <View style={[styles.swatch, { backgroundColor: type.color }]} />
                <View style={styles.customCopy}>
                  <Text style={styles.colorName}>Custom color</Text>
                  <Text style={styles.customValue}>{type.color.toUpperCase()}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={dashboardTheme.slate} />
              </Pressable>
            </SettingsSection>
          )}
          {!creating && (
            <SettingsSection>
              <SettingsRow
                title="Hide from workout pickers"
                subtitle={
                  type.hidden
                    ? 'This type is hidden from new-workout pickers. Turn this off to show it again.'
                    : 'Only new-workout pickers change. Existing workouts, routines, and plans keep this type.'
                }
                accessibilityRole="switch"
                accessibilityLabel={`Hide ${type.name} from workout pickers`}
                accessibilityState={{ checked: type.hidden === true }}
                onPress={() => {
                  selectionHaptic();
                  change({ hidden: !type.hidden });
                }}
                haptic="none"
                trailing={
                  <ForgeSwitch
                    value={type.hidden === true}
                    testID="workout-type-visibility-switch"
                  />
                }
              />
            </SettingsSection>
          )}
          {!creating && !builtIn && (
            <Button
              label={destructiveLabel}
              accessibilityLabel={destructiveLabel}
              icon={type.hidden ? 'check' : mustHide ? 'close' : 'trash'}
              variant="outline"
              tone={type.hidden ? 'neutral' : 'destructive'}
              onPress={() => {
                if (type.hidden) {
                  lightHaptic();
                  change({ hidden: false });
                } else removeOrHide();
              }}
              theme={dashboardTheme}
              style={styles.destructive}
            />
          )}
        </ScrollView>
        <ForgeBottomSheet
          visible={customColorPickerOpen}
          onClose={() => setCustomColorPickerOpen(false)}
          accessibilityLabel="Close custom workout type color picker"
          testID="custom-workout-type-color-picker"
        >
          {(close) => (
            <View style={styles.colorPickerSheet}>
              <ForgeBottomSheetHandle />
              <View style={styles.colorPickerHeader}>
                <Text style={styles.colorPickerTitle}>Custom color</Text>
                <Text style={styles.colorPickerCopy}>Choose a color for this workout type.</Text>
              </View>
              <View style={styles.colorGrid}>
                {customColors.map((color) => {
                  const selected = type.color.toUpperCase() === color;
                  return (
                    <Pressable
                      key={color}
                      accessibilityRole="button"
                      accessibilityLabel={`Use custom color ${color}`}
                      accessibilityState={{ selected }}
                      hitSlop={3}
                      onPress={() => {
                        selectionHaptic();
                        change({ color });
                        close();
                      }}
                      style={({ pressed }) => [
                        styles.colorChoice,
                        { backgroundColor: color },
                        selected && styles.colorChoiceSelected,
                        pressed && styles.colorChoicePressed,
                      ]}
                    >
                      {selected && (
                        <Icon name="check" size={17} color={dashboardTheme.surface} weight="bold" />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </ForgeBottomSheet>
      </View>
    </AppScreen>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) => {
  const dashboardTheme = theme;
  return StyleSheet.create({
    screen: { flex: 1 },
    createHeader: {
      height: 70,
      paddingHorizontal: 20,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: dashboardTheme.background,
    },
    createTitleWrap: {
      position: 'absolute',
      top: 0,
      right: 124,
      bottom: 0,
      left: 76,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createTitle: { textAlign: 'center', color: dashboardTheme.ink, ...typeScale.headerTitle },
    content: {
      padding: settingsLayout.screenPadding,
      paddingTop: settingsLayout.contentTop,
      paddingBottom: settingsLayout.contentBottom,
      gap: settingsLayout.sectionGap,
    },
    identityCard: { paddingHorizontal: 16, paddingVertical: 10, gap: 3 },
    colorCard: { padding: 16, gap: 9 },
    label: { ...typeScale.label, color: dashboardTheme.slate },
    input: { minHeight: 38, paddingVertical: 0, color: dashboardTheme.ink, ...typeScale.cardTitle },
    divider: {
      height: StyleSheet.hairlineWidth,
      marginVertical: 4,
      backgroundColor: dashboardTheme.divider,
    },
    sourceRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 7 },
    sourceIcon: { width: 20, alignItems: 'center' },
    source: { color: dashboardTheme.slate, ...typeScale.supporting },
    colorRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowDivider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 24,
      backgroundColor: dashboardTheme.divider,
    },
    swatch: { width: 12, height: 12, borderRadius: 6 },
    colorName: { flex: 1, color: dashboardTheme.ink, ...typeScale.body },
    customRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10 },
    customCopy: { flex: 1, minWidth: 0 },
    customValue: { marginTop: 1, color: dashboardTheme.slate, ...typeScale.supporting },
    colorPickerSheet: { paddingBottom: 32 },
    colorPickerHeader: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18, gap: 3 },
    colorPickerTitle: { color: dashboardTheme.ink, ...typeScale.sectionTitle },
    colorPickerCopy: { color: dashboardTheme.slate, ...typeScale.supporting },
    colorGrid: { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    colorChoice: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorChoiceSelected: { borderWidth: 3, borderColor: dashboardTheme.ink },
    colorChoicePressed: { opacity: 0.68 },
    destructive: { minHeight: 48 },
  });
};

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const chroma = (1 - Math.abs(2 * (lightness / 100) - 1)) * (saturation / 100);
  const match = lightness / 100 - chroma / 2;
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const [red, green, blue] =
    hue < 60
      ? [chroma, secondary, 0]
      : hue < 120
        ? [secondary, chroma, 0]
        : hue < 180
          ? [0, chroma, secondary]
          : hue < 240
            ? [0, secondary, chroma]
            : hue < 300
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  return `#${[red, green, blue]
    .map((value) =>
      Math.round((value + match) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
}
