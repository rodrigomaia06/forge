import { useForgeDetailHeading } from '../../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { usePreventRemove, type NavigationAction } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  AppScreen,
  Button,
  ForgeCard,
  ForgeConfirmationDialog,
  ForgeSwitch,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  HeaderAction,
  HeaderEdge,
  Icon,
  lightHaptic,
  selectionHaptic,
  successHaptic,
} from '../../components/ui';
import { usePlans } from '../../state/PlansContext';
import { useSettings } from '../../state/SettingsContext';
import { useActiveWorkout, useWorkouts } from '../../state/WorkoutContext';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { RootStackParamList, WorkoutTypePreference } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { SettingsRow, SettingsSection, settingsLayout } from './SettingsRow';
import {
  workoutTypeColorChoices,
  builtInWorkoutTypeColors,
} from '../../domain/workouts/workoutTypeDefaults';
import { WorkoutTypeColorSheet } from './WorkoutTypeColorSheet';
import { WorkoutTypeIconSheet } from './WorkoutTypeIconSheet';
import {
  workoutTypeIcon,
  workoutTypeIconChoices,
  workoutTypeUsage,
} from '../../domain/workouts/workoutTypeMetadata';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutTypeEditor'>;

export function WorkoutTypeEditorScreen({ navigation, route }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const dashboardTheme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { preferences, updatePreferences } = useSettings();
  const activeWorkout = useActiveWorkout();
  const { completedWorkouts } = useWorkouts();
  const { plans, standaloneRoutines } = usePlans();
  const creating = 'mode' in route.params && route.params.mode === 'create';
  const initialDraft: WorkoutTypePreference | null = creating
    ? {
        id: route.params.draftId,
        name: 'New type',
        color: route.params.initialColor,
        source: 'custom' as const,
      }
    : null;
  const [draft, setDraft] = useState<WorkoutTypePreference | null>(initialDraft);
  const [canLeave, setCanLeave] = useState(false);
  const storedParams = 'workoutTypeId' in route.params ? route.params : null;
  const storedType = storedParams
    ? preferences.workoutTypes.find((item) => item.id === storedParams.workoutTypeId)
    : undefined;
  const type = creating ? draft : storedType;
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [headerElevated, setHeaderElevated] = useState(false);
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);
  const [removalConfirmationOpen, setRemovalConfirmationOpen] = useState(false);
  const pendingDiscardActionRef = useRef<NavigationAction | null>(null);
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
  const usage = useMemo(
    () => (type ? workoutTypeUsage(type, completedWorkouts, plans, standaloneRoutines) : null),
    [type, completedWorkouts, plans, standaloneRoutines],
  );

  const { headerTitle: recordHeaderTitle, contentTitle } = useForgeDetailHeading(type?.name.trim() || 'Workout type');

  if (!type)
    return (
      <AppScreen backgroundColor={dashboardTheme.background}>
        <SettingsDetailHeader
          title="Workout type"
          navigation={navigation}
          backAccessibilityLabel="Back to Workout types"
        />
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
      ? draft.name !== initialDraft.name ||
        draft.color !== initialDraft.color ||
        draft.icon !== initialDraft.icon
      : false;
  // Defer the actual navigation until after the guard is lifted, matching the
  // routine and history editors' discard flow.
  const leave = (action: () => void): void => {
    setCanLeave(true);
    setTimeout(action, 0);
  };
  const discardDraft = (): void => {
    if (draftChanged) {
      setDiscardConfirmationOpen(true);
      return;
    }
    lightHaptic();
    navigation.goBack();
  };

  usePreventRemove(creating && draftChanged && !canLeave, ({ data }) => {
    pendingDiscardActionRef.current = data.action;
    setDiscardConfirmationOpen(true);
  });
  const saveDraft = (): void => {
    const name = draft?.name.trim() ?? '';
    if (!draft || !name) return;
    updatePreferences({ workoutTypes: [...preferences.workoutTypes, { ...draft, name }] });
    successHaptic();
    leave(() => navigation.goBack());
  };
  const mustHide = type.source === 'builtIn' || type.hasReferencedData || referenced;
  const destructiveLabel = type.hidden ? 'Unhide type' : mustHide ? 'Hide type' : 'Delete type';
  const removeOrHide = (): void => {
    setRemovalConfirmationOpen(true);
  };

  return (
    <AppScreen edges={['top']} backgroundColor={dashboardTheme.background}>
      <View style={styles.screen}>
        {creating ? (
          <View style={styles.createHeader}>
            <HeaderAction
              accessibilityLabel="Cancel new workout type"
              icon="close"
              iconOnly
              onPress={discardDraft}
              haptic="none"
            />
            <View
              testID="new-workout-type-title-wrap"
              style={[styles.createTitleWrap, styles.pointerEventsNone]}
            >
              <Text numberOfLines={1} style={styles.createTitle}>
                New workout type
              </Text>
            </View>
            <HeaderAction
              accessibilityLabel="Save workout type"
              icon="check"
              iconOnly
              variant="outline"
              tone="success"
              onPress={saveDraft}
              disabled={!draft?.name.trim()}
              haptic="none"
            />
            {headerElevated ? <HeaderEdge /> : null}
          </View>
        ) : (
          <SettingsDetailHeader
            titleContent={recordHeaderTitle}
            title={type.name.trim() || 'Workout type'}
            navigation={navigation}
            backAccessibilityLabel="Back to Workout types"
            elevated={headerElevated}
          />
        )}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: styles.content.paddingBottom + bottomInset },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          directionalLockEnabled
          onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
        >
          {contentTitle}
          <ForgeCard variant="base" style={styles.identityCard}>
            <View testID="workout-type-name-row" style={styles.nameRow}>
              <Icon
                testID="workout-type-preview-icon"
                name={workoutTypeIcon(type)}
                size={26}
                color={type.color}
              />
              {builtIn ? (
                <Text testID="workout-type-readonly-name" style={styles.name}>
                  {type.name}
                </Text>
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
            </View>
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
          <SettingsSection>
            <SettingsRow
              title="Icon"
              accessibilityLabel="Workout type icon"
              leading={<Icon name={workoutTypeIcon(type)} color={dashboardTheme.textPrimary} />}
              trailing={
                <Text style={styles.source}>
                  {type.icon
                    ? workoutTypeIconChoices.find((choice) => choice.value === type.icon)?.label
                    : 'Default'}
                </Text>
              }
              onPress={() => setIconPickerOpen(true)}
              disclosure
              showDivider
            />
            <SettingsRow
              title="Color"
              accessibilityLabel="Workout type color"
              onPress={() => setColorPickerOpen(true)}
              disclosure
              leading={
                <View
                  testID="workout-type-editor-swatch"
                  style={[styles.swatch, { backgroundColor: type.color }]}
                />
              }
              trailing={
                <Text style={styles.source}>
                  {builtIn &&
                  !type.colorCustomized &&
                  type.color.toUpperCase() === builtInWorkoutTypeColors[type.id]
                    ? 'Default'
                    : (workoutTypeColorChoices.find(
                        (choice) => choice.value === type.color.toUpperCase(),
                      )?.name ?? 'Custom')}
                </Text>
              }
              showDivider={!creating}
            />
            {!creating && (
              <SettingsRow
                title="Available in workout pickers"
                accessibilityRole="switch"
                accessibilityLabel={`Show ${type.name} in workout pickers`}
                accessibilityState={{ checked: !type.hidden }}
                onPress={() => {
                  selectionHaptic();
                  change({ hidden: !type.hidden });
                }}
                haptic="none"
                trailing={
                  <ForgeSwitch value={!type.hidden} testID="workout-type-visibility-switch" />
                }
              />
            )}
          </SettingsSection>
          {!creating && usage ? (
            <SettingsSection title="Used in">
              <SettingsRow
                title="Saved workouts"
                icon="history"
                trailing={<Text style={styles.source}>{usage.workouts.length}</Text>}
                onPress={() =>
                  navigation.navigate('WorkoutTypeUsage', {
                    workoutTypeId: type.id,
                    kind: 'workouts',
                  })
                }
                disabled={!usage.workouts.length}
                disclosure={usage.workouts.length > 0}
                showDivider
                accessibilityLabel={`Saved workouts using ${type.name}, ${usage.workouts.length}`}
              />
              <SettingsRow
                title="Routines"
                icon="book"
                trailing={<Text style={styles.source}>{usage.routines.length}</Text>}
                onPress={() =>
                  navigation.navigate('WorkoutTypeUsage', {
                    workoutTypeId: type.id,
                    kind: 'routines',
                  })
                }
                disabled={!usage.routines.length}
                disclosure={usage.routines.length > 0}
                accessibilityLabel={`Routines using ${type.name}, ${usage.routines.length}`}
              />
            </SettingsSection>
          ) : null}
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
        {colorPickerOpen ? (
          <WorkoutTypeColorSheet
            type={type}
            onChange={change}
            onClose={() => setColorPickerOpen(false)}
          />
        ) : null}
        {iconPickerOpen ? (
          <WorkoutTypeIconSheet
            type={type}
            onChange={change}
            onClose={() => setIconPickerOpen(false)}
          />
        ) : null}
        <ForgeConfirmationDialog
          visible={discardConfirmationOpen}
          title="Discard new workout type?"
          message="Your unsaved changes will be lost."
          cancelLabel="Keep editing"
          confirmLabel="Discard type"
          onCancel={() => {
            pendingDiscardActionRef.current = null;
            setDiscardConfirmationOpen(false);
          }}
          onConfirm={() => {
            const pendingAction = pendingDiscardActionRef.current;
            pendingDiscardActionRef.current = null;
            setDiscardConfirmationOpen(false);
            lightHaptic();
            leave(() => {
              if (pendingAction) navigation.dispatch(pendingAction);
              else navigation.goBack();
            });
          }}
          testID="discard-workout-type-confirmation"
        />
        <ForgeConfirmationDialog
          visible={removalConfirmationOpen}
          title={mustHide ? 'Hide workout type?' : 'Delete workout type?'}
          message={
            mustHide
              ? 'Past workouts, routines, and plans keep their saved type.'
              : 'This cannot be undone.'
          }
          cancelLabel="Cancel"
          confirmLabel={mustHide ? 'Hide type' : 'Delete type'}
          onCancel={() => setRemovalConfirmationOpen(false)}
          onConfirm={() => {
            setRemovalConfirmationOpen(false);
            lightHaptic();
            if (mustHide) change({ hidden: true });
            else {
              updatePreferences({
                workoutTypes: preferences.workoutTypes.filter((item) => item.id !== type.id),
              });
            }
            navigation.goBack();
          }}
          testID="workout-type-editor-removal-confirmation"
        />
      </View>
    </AppScreen>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) => {
  const dashboardTheme = theme;
  return StyleSheet.create({
    pointerEventsNone: { pointerEvents: 'none' },
    screen: { flex: 1 },
    scroll: { flex: 1 },
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
      right: 76,
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
    nameRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 12 },
    name: { flex: 1, color: dashboardTheme.ink, ...typeScale.cardTitle },
    input: {
      flex: 1,
      minHeight: 38,
      paddingVertical: 0,
      color: dashboardTheme.ink,
      ...typeScale.cardTitle,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      marginVertical: 4,
      backgroundColor: dashboardTheme.divider,
    },
    sourceRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 7 },
    sourceIcon: { width: 20, alignItems: 'center' },
    source: { color: dashboardTheme.slate, ...typeScale.supporting },
    swatch: { width: 12, height: 12, borderRadius: 6 },
    destructive: { minHeight: 48 },
  });
};
