import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppScreen,
  Button,
  ForgeActionSheet,
  ForgeBackButton,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeConfirmationDialog,
  ForgeDurationWheel,
  ForgeSheetHeader,
  ForgeText as Text,
  HeaderAction,
  useForgeDetailHeading,
  HeaderEdge,
  useAfterSheetClose,
} from '../components/ui';
import { ExerciseDetailBody, UnilateralDetailSection } from '../components/ExerciseDetailBody';
import {
  ExerciseInfoTabs,
  type ExerciseInfoReview,
  type ExerciseInfoTab,
} from '../components/exerciseInfo/ExerciseInfoTabs';
import { catalogueDetail } from './activeWorkout/ExerciseOptionSheets';
import { isUnilateralExercise } from '../domain/exercises/laterality';
import { useExerciseCatalog } from '../state/ExerciseCatalogContext';
import { useSettings } from '../state/SettingsContext';
import { useWorkouts } from '../state/WorkoutContext';
import { useForgeTheme } from '../theme/ThemeProvider';
import { scaleUI } from '../theme/scale';
import { typeScale } from '../theme/tokens';
import { shareItem } from '../utils/shareItem';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseInfo'>;
const restReadout = (seconds: number | undefined) =>
  seconds === undefined
    ? 'Default'
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export function ExerciseInfoScreen({ navigation, route }: Props) {
  const { exercise, excludeWorkoutId, fromLibrary = false } = route.params;
  const theme = useForgeTheme();
  const insets = useSafeAreaInsets();
  const { preferences, updatePreferences } = useSettings();
  const { completedWorkouts } = useWorkouts();
  const catalog = useExerciseCatalog();
  const id = exercise.exerciseId ?? exercise.exerciseSnapshot?.id ?? exercise.id;
  const custom = catalog.customExercises.find((item) => item.id === id);
  const detail = fromLibrary
    ? (custom ?? catalogueDetail(exercise))
    : (catalogueDetail(exercise) ?? custom);
  const unilateral = isUnilateralExercise(exercise) || detail?.laterality === 'unilateral';
  const { headerTitle, contentTitle } = useForgeDetailHeading(exercise.name, 'exercise-info-name', styles.name);
  const [tab, setTab] = useState<ExerciseInfoTab>(route.params.initialTab ?? 'info');
  const [review, setReview] = useState<ExerciseInfoReview>({});
  const [elevated, setElevated] = useState(false);
  const [restPicker, setRestPicker] = useState<'sets' | 'sides' | null>(null);
  const [restError, setRestError] = useState(false);
  const [options, setOptions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { runAfterClose, onClosed } = useAfterSheetClose();
  const rest = fromLibrary && custom ? custom.restSeconds : preferences.exerciseRestSeconds[id];
  const sidesRest = preferences.exerciseUnilateralRestSeconds[id];
  const leadSide = preferences.exerciseLeadSide[id] ?? 'left';
  const saveRest = async (seconds: number | undefined) => {
    if (!restPicker) return;
    if (restPicker === 'sets' && fromLibrary && custom) {
      catalog.updateCustomExercise({ ...custom, restSeconds: seconds });
      setRestError(false);
      return;
    }
    const key = restPicker === 'sets' ? 'exerciseRestSeconds' : 'exerciseUnilateralRestSeconds';
    const values = { ...preferences[key] };
    if (seconds === undefined) delete values[id];
    else values[id] = seconds;
    setRestError(!(await updatePreferences({ [key]: values })));
  };
  const info = (
    <ScrollView
      testID="exercise-info-content"
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: insets.bottom + scaleUI(32) }}
      onScroll={(event) => setElevated(event.nativeEvent.contentOffset.y > 0)}
      scrollEventThrottle={16}
    >
      {contentTitle ? <View style={{ paddingHorizontal: scaleUI(20) }}>{contentTitle}</View> : null}
      {detail ? (
        <ExerciseDetailBody
          presentation="screen"
          detail={detail}
          workoutTypes={preferences.workoutTypes}
          restLabel={restReadout(rest)}
          onPressRest={() => {
            setRestError(false);
            setRestPicker('sets');
          }}
          secondaryRest={
            unilateral
              ? {
                  title: 'Between sides',
                  value: restReadout(sidesRest),
                  onPress: () => {
                    setRestError(false);
                    setRestPicker('sides');
                  },
                }
              : undefined
          }
          settingsFooter={
            unilateral ? (
              <UnilateralDetailSection
                presentation="screen"
                leadSide={leadSide}
                onToggleLeadSide={() => {
                  void updatePreferences({
                    exerciseLeadSide: {
                      ...preferences.exerciseLeadSide,
                      [id]: leadSide === 'left' ? 'right' : 'left',
                    },
                  });
                }}
              />
            ) : undefined
          }
        />
      ) : (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          Catalogue details are not available for this exercise.
        </Text>
      )}
    </ScrollView>
  );
  return (
    <AppScreen edges={['top']} testID="exercise-info-screen">
      <View style={[styles.header, { backgroundColor: theme.header }]}>
        <View style={styles.topBar}>
          <ForgeBackButton
            accessibilityLabel="Back from exercise info"
            onPress={() => navigation.goBack()}
          />
          {headerTitle}
          {fromLibrary && custom ? (
            <HeaderAction
              icon="ellipsis-horizontal"
              iconOnly
              accessibilityLabel="Exercise options"
              onPress={() => setOptions(true)}
            />
          ) : (
            <View style={styles.actionSpace} />
          )}
        </View>
        {elevated ? <HeaderEdge /> : null}
      </View>
      <ExerciseInfoTabs
        presentation="screen"
        bottomInset={insets.bottom}
        onScrollOffsetChange={(offset) => setElevated(offset > 0)}
        exercise={exercise}
        workouts={completedWorkouts}
        excludeWorkoutId={excludeWorkoutId}
        info={info}
        contentTitle={contentTitle}
        tab={tab}
        onTabChange={(next) => {
          setTab(next);
          setElevated(false);
        }}
        review={review}
        onReviewChange={setReview}
        onOpenWorkout={(workoutId) =>
          navigation.push('WorkoutDetails', {
            workoutId,
            returnContext: 'previous-sessions',
            backAccessibilityLabel: 'Back to exercise info',
          })
        }
      />
      <ForgeBottomSheet
        testID="exercise-rest-selection-view"
        visible={restPicker !== null}
        onClose={() => setRestPicker(null)}
        accessibilityLabel="Dismiss rest duration picker"
      >
        <View style={styles.restSheet}>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader
            title={restPicker === 'sides' ? 'Between sides' : 'Rest time'}
            onClose={() => setRestPicker(null)}
          />
          <View testID="exercise-rest-selection-list">
            <ForgeDurationWheel
              selectedDuration={
                restPicker === 'sides'
                  ? (sidesRest ?? preferences.defaultUnilateralRestSeconds)
                  : (rest ?? preferences.defaultRestSeconds)
              }
              onSelect={(seconds) => void saveRest(seconds)}
            />
          </View>
          {restError ? (
            <Text
              accessibilityRole="alert"
              style={[styles.empty, { color: theme.textDestructive }]}
            >
              Could not save. Choose the duration again to retry.
            </Text>
          ) : null}
          <View
            style={[styles.pickerFooter, { paddingBottom: Math.max(insets.bottom, scaleUI(24)) }]}
          >
            <Button
              label="Use default"
              variant="secondary"
              onPress={() => void saveRest(undefined)}
            />
          </View>
        </View>
      </ForgeBottomSheet>
      <ForgeActionSheet
        visible={options}
        onClose={() => setOptions(false)}
        onClosed={onClosed}
        accessibilityLabel="Close exercise options"
        title="Exercise options"
        actions={[
          {
            label: 'Edit exercise',
            icon: 'note',
            onPress: () =>
              runAfterClose(() =>
                navigation.getState().routes.some((item) => item.name === 'ExerciseBrowser')
                  ? navigation.popTo('ExerciseBrowser', { editExerciseId: id }, { merge: true })
                  : navigation.navigate('ExerciseBrowser', { custom: true, editExerciseId: id }),
              ),
          },
          {
            label: 'Share exercise',
            icon: 'share',
            onPress: () => runAfterClose(() => shareItem({ kind: 'exercise', id })),
          },
          {
            label: 'Delete exercise',
            icon: 'trash',
            tone: 'destructive',
            onPress: () => runAfterClose(() => setConfirmDelete(true)),
          },
        ]}
      />
      <ForgeConfirmationDialog
        visible={confirmDelete}
        title="Delete exercise?"
        message="Existing workouts and routines keep their recorded exercise."
        cancelLabel="Cancel"
        confirmLabel="Delete exercise"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          catalog.removeCustomExercise(id);
          setConfirmDelete(false);
          navigation.goBack();
        }}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { zIndex: 2, paddingHorizontal: scaleUI(20), paddingTop: scaleUI(12), paddingBottom: scaleUI(12) },
  topBar: {
    minHeight: scaleUI(64),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scaleUI(12),
  },
  actionSpace: { width: 44 },
  name: { ...typeScale.headerTitle, minWidth: 0, paddingVertical: scaleUI(8) },
  restSheet: { minHeight: scaleUI(480), flexShrink: 1 },
  scroll: { flex: 1 },
  empty: { ...typeScale.body, padding: scaleUI(20) },
  pickerFooter: { paddingHorizontal: scaleUI(20) },
});
