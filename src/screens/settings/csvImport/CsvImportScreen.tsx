import React, { useDeferredValue, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View, BackHandler, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  ForgeCard,
  ForgeConfirmationDialog,
  ForgeFloatingCta,
  ForgeSearchField,
  ForgeSelectionSheet,
  ForgeText as Text,
  HeaderAction,
} from '../../../components/ui';
import { useForgeFloatingCtaClearance } from '../../../components/ui/ForgeFloatingCta';
import { useForgeTheme } from '../../../theme/ThemeProvider';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { typeScale } from '../../../theme/tokens';
import { scaleUI } from '../../../theme/scale';
import type { RootStackParamList } from '../../../types';
import { useExerciseCatalog } from '../../../state/ExerciseCatalogContext';
import { useWorkouts } from '../../../state/WorkoutContext';
import { SettingsDetailHeader } from '../SettingsScreenChrome';
import { pickWorkoutCsv } from '../../../data/pickWorkoutCsv';
import { parseWorkoutCsvAsync } from '../../../data/csvImport/parse';
import { filterCatalog } from '../../../domain/exercises/catalogSelectors';
import { csvSessionChanges } from '../../../data/csvImport/changes';
import {
  applyCsvResolutions,
  customCsvExercise,
  matchCsvSessions,
  resolveCsvExercises,
  reviewStamp,
} from '../../../data/csvImport/review';
import { commitCsvImport, loadCsvMappings } from '../../../data/csvImportRepository';
import {
  sourceLabels,
  type CsvDraft,
  type CsvOptions,
  type ExerciseResolution,
  type CsvImportResult,
  type CsvMappings,
  type SessionChoice,
} from '../../../data/csvImport/types';
import { CsvImportRow, type CsvReviewRow as Row } from './CsvImportRow';
import { CsvSourceHeading } from './CsvSourceHeading';

type Props = NativeStackScreenProps<RootStackParamList, 'CsvImport'>;
type Stage = 'file' | 'detected' | 'matches' | 'catalog' | 'sessions' | 'result';
type Choice = {
  title: string;
  value: string;
  options: { value: string; label: string; description?: string }[];
  select: (value: string) => void;
};

export function CsvImportScreen({ navigation }: Props) {
  const theme = useForgeTheme(),
    styles = useThemedStyles(createStyles);
  const { bottom } = useSafeAreaInsets(),
    clearance = useForgeFloatingCtaClearance();
  const { exercises, reload: reloadExercises } = useExerciseCatalog();
  const { completedWorkouts, reload: reloadWorkouts } = useWorkouts();
  const [stage, setStage] = useState<Stage>('file');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [draft, setDraft] = useState<CsvDraft | null>(null);
  const [options, setOptions] = useState<CsvOptions>({});
  const [resolutions, setResolutions] = useState<ExerciseResolution[]>([]);
  const [savedMappings, setSavedMappings] = useState<CsvMappings>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [choices, setChoices] = useState<Record<string, SessionChoice>>({});
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());
  const [choice, setChoice] = useState<Choice | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const catalogueResults = useMemo(
    () => (stage === 'catalog' ? filterCatalog(exercises, { query: deferredQuery }) : []),
    [exercises, deferredQuery, stage],
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [confirm, setConfirm] = useState(false);
  const reviewed = useRef<Record<string, string>>({});
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [elevated, setElevated] = useState(false);
  const incoming = useMemo(
    () =>
      draft && resolutions.every((item) => item.exercise)
        ? applyCsvResolutions(draft, resolutions)
        : [],
    [draft, resolutions],
  );
  const sessions = useMemo(
    () => matchCsvSessions(incoming, completedWorkouts),
    [incoming, completedWorkouts],
  );
  const actionable = sessions.filter(
    (match) =>
      selected.has(match.workout.id) &&
      match.status !== 'duplicate' &&
      (match.status === 'new' ||
        choices[match.workout.id] === 'replace' ||
        choices[match.workout.id] === 'both'),
  );
  const changedMappings = resolutions.filter((item) => item.confirmed && item.exercise && savedMappings[item.key] !== item.exercise.id);
  const mappingsOnly = actionable.length === 0 && changedMappings.length > 0;
  const reviewLabel = mappingsOnly
    ? `Review ${changedMappings.length} exercise match${changedMappings.length === 1 ? '' : 'es'}`
    : `Review ${actionable.length} workout${actionable.length === 1 ? '' : 's'}`;
  const requiredCustom = new Set(
    [...actionable.flatMap((match) => match.workout.exercises.map((exercise) => exercise.exerciseId)), ...changedMappings.map((item) => item.exercise!.id)],
  );
  const customCount = resolutions.filter(
    (resolution) => resolution.custom && requiredCustom.has(resolution.exercise?.id),
  ).length;
  const back = () => {
    if (lock.current) return;
    setError('');
    if (stage === 'catalog') setStage('matches');
    else if (stage === 'sessions') setStage('matches');
    else if (stage === 'matches') setStage('detected');
    else if (stage === 'detected') setStage('file');
    else navigation.goBack();
  };
  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => subscription.remove();
  });
  React.useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (lock.current) event.preventDefault();
      }),
    [navigation],
  );
  React.useEffect(() => setElevated(false), [stage]);
  React.useEffect(() => {
    if (Platform.OS !== 'web' || (!confirm && !choice)) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || lock.current) return;
      event.preventDefault();
      event.stopPropagation();
      setConfirm(false);
      setChoice(null);
    };
    document.addEventListener('keydown', dismiss, true);
    return () => {
      document.removeEventListener('keydown', dismiss, true);
      previousFocus?.focus();
    };
  }, [confirm, choice]);
  async function analyze(picked: { name: string; text: string }, nextOptions: CsvOptions) {
    const parsed = await parseWorkoutCsvAsync(picked.text, nextOptions);
    const mappings = await loadCsvMappings();
    setSavedMappings(mappings);
    setDraft(parsed);
    setResolutions(resolveCsvExercises(parsed, exercises, mappings));
    setSelected(new Set(parsed.workouts.map((workout) => workout.id)));
    setAcknowledged(false);
    setChoices({});
    setOptions(nextOptions);
    setStage('detected');
  }
  async function chooseFile() {
    if (lock.current) return;
    lock.current = true;
    setError('');
    try {
      const picked = await pickWorkoutCsv();
      if (!picked) return;
      setBusy(true);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      await analyze(picked, {});
      setFile(picked);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not read the CSV. Choose the file again.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function setOption(key: keyof CsvOptions, value: string) {
    if (!file || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await analyze(file, { ...options, [key]: value });
    } catch (failure) {
      setError(String(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function updateResolution(key: string, exercise: ExerciseResolution['exercise'], custom = false) {
    setResolutions((previous) =>
      previous.map((item) =>
        item.key === key ? { ...item, exercise, custom, remembered: false, confirmed: true } : item,
      ),
    );
  }
  function editMatch(item: ExerciseResolution) {
    setEditing(item.key);
    setQuery(item.name);
    setStage('catalog');
    setError('');
  }
  function sessionChoice(id: string, ambiguous: boolean) {
    setChoice({
      title: 'Session',
      value: choices[id] ?? 'keep',
      options: [
        {
          value: 'keep',
          label: 'Keep existing',
          description: 'Preserve the workout on this device.',
        },
        ...(!ambiguous
          ? [
              {
                value: 'replace',
                label: 'Replace',
                description: 'Replace this session with the exported version.',
              },
            ]
          : []),
        { value: 'both', label: 'Keep both', description: 'Import a separate copy.' },
      ],
      select: (value) => setChoices((previous) => ({ ...previous, [id]: value as SessionChoice })),
    });
  }
  async function save() {
    if (!draft || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setConfirm(false);
    try {
      const saved = await commitCsvImport({
        draft,
        selected: [...selected],
        resolutions,
        choices,
        reviewed: reviewed.current,
        acknowledged,
        confirmedMappingKeys: changedMappings.map((item) => item.key),
      });
      setResult(saved);
      setStage('result');
      try {
        await Promise.all([reloadWorkouts(), reloadExercises()]);
      } catch {
        setError(
          'The import was saved, but the displayed data could not refresh. Reopen Forge to reload it.',
        );
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not save. Your review is kept. Try again.',
      );
      try {
        await Promise.all([reloadWorkouts(), reloadExercises()]);
      } catch {
        /* Keep the draft while storage remains unavailable. */
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const rows: Row[] = [];
  if (stage === 'detected' && draft) {
    for (const requirement of draft.requirements) {
      const choicesFor =
        requirement === 'dateOrder'
          ? [
              { value: 'day-first', label: 'Day / month / year' },
              { value: 'month-first', label: 'Month / day / year' },
            ]
          : requirement === 'weightUnit'
            ? [
                { value: 'kg', label: 'Kilograms (kg)' },
                { value: 'lb', label: 'Pounds (lb)' },
              ]
            : [
                { value: 'km', label: 'Kilometres (km)' },
                { value: 'mi', label: 'Miles (mi)' },
              ];
      rows.push({
        key: requirement,
        title:
          requirement === 'dateOrder'
            ? 'Choose date order'
            : requirement === 'weightUnit'
              ? 'Choose source weight unit'
              : 'Choose source distance unit',
        detail: 'The CSV does not specify this unambiguously.',
        onPress: () =>
          setChoice({
            title: requirement === 'dateOrder' ? 'Date order' : 'Source unit',
            value: '',
            options: choicesFor,
            select: (value) => {
              void setOption(requirement, value);
            },
          }),
      });
    }
    if (!draft.requirements.length && draft.excluded)
      rows.push({
        key: 'ack',
        title: `Exclude ${draft.excluded} incomplete workout${draft.excluded === 1 ? '' : 's'}`,
        detail: 'I understand only the remaining valid workouts will be imported.',
        checked: acknowledged,
        onPress: () => setAcknowledged(!acknowledged),
      });
    for (const issue of draft.issues)
      rows.push({
        key: `issue-${issue.row}-${issue.field}`,
        title: `Row ${issue.row} · ${issue.field}`,
        detail: issue.message,
      });
  }
  if (stage === 'matches')
    for (const item of resolutions)
      rows.push({
        key: item.key,
        title: item.name,
        detail: item.exercise
          ? `${item.custom ? 'Custom exercise' : item.remembered ? 'Remembered match' : 'Matched'}: ${item.exercise.name}`
          : 'Choose a Forge exercise or keep as custom.',
        onPress: () => editMatch(item),
      });
  if (stage === 'catalog') {
    const item = resolutions.find((entry) => entry.key === editing);
    if (item)
      rows.push({
        key: 'custom',
        title: `Keep “${item.name}” as custom`,
        detail:
          'Keep the source name and measured fields. Equipment and muscles remain unspecified.',
        onPress: () => {
          updateResolution(item.key, customCsvExercise(item), true);
          setStage('matches');
        },
      });
    for (const exercise of catalogueResults)
      rows.push({
        key: exercise.id,
        title: exercise.name,
        detail: exercise.equipment,
        onPress: () => {
          if (editing) updateResolution(editing, exercise);
          setStage('matches');
        },
      });
  }
  if (stage === 'sessions')
    for (const match of sessions) {
      const { workout, status } = match;
      rows.push({
        key: workout.id,
        title: workout.name,
        detail: `${new Date(workout.startedAt).toLocaleDateString()} · ${workout.exercises.length} exercise${workout.exercises.length === 1 ? '' : 's'} · ${status === 'duplicate' ? 'Already imported' : status === 'new' ? 'New session' : status === 'ambiguous' ? 'Ambiguous match' : 'Changed session'}`,
        checked: status === 'duplicate' ? undefined : selected.has(workout.id),
        onPress:
          status === 'duplicate'
            ? undefined
            : () =>
                setSelected((previous) => {
                  const next = new Set(previous);
                  if (next.has(workout.id)) next.delete(workout.id);
                  else next.add(workout.id);
                  return next;
                }),
      });
      if (status === 'changed' || status === 'ambiguous')
        rows.push({
          key: `choice-${workout.id}`,
          title:
            choices[workout.id] === 'replace'
              ? 'Replace existing session'
              : choices[workout.id] === 'both'
                ? 'Import a separate copy'
                : 'Keep existing session',
          onPress: () => sessionChoice(workout.id, status === 'ambiguous'),
        });
      if (status === 'changed' && match.existing) {
        const expanded = expandedChanges.has(workout.id);
        rows.push({
          key: `changes-${workout.id}`,
          title: `${expanded ? 'Hide' : 'View'} changes for ${workout.name}`,
          onPress: () =>
            setExpandedChanges((previous) => {
              const next = new Set(previous);
              if (next.has(workout.id)) next.delete(workout.id);
              else next.add(workout.id);
              return next;
            }),
        });
        if (expanded)
          for (const [index, change] of csvSessionChanges(match.existing, workout).entries())
            rows.push({
              key: `${workout.id}-change-${index}`,
              title: change.label,
              detail: `On device: ${change.before}\nCSV: ${change.after}`,
            });
      }
    }
  const dateRange = draft?.workouts.length
    ? (() => {
        const dates = draft.workouts.map((workout) => workout.startedAt);
        return `${new Date(dates.reduce((a, b) => Math.min(a, b))).toLocaleDateString()} – ${new Date(dates.reduce((a, b) => Math.max(a, b))).toLocaleDateString()}`;
      })()
    : '';
  const canContinue =
    stage === 'detected'
      ? Boolean(
          draft?.workouts.length && !draft.requirements.length && (!draft.excluded || acknowledged),
        )
      : stage === 'matches'
        ? resolutions.every((item) => item.exercise)
        : stage === 'sessions'
          ? actionable.length > 0 || changedMappings.length > 0
          : false;
  return (
    <AppScreen edges={['top']} backgroundColor={theme.background}>
      <View style={styles.screen} testID="csv-import-screen">
        <SettingsDetailHeader
          title="Import workouts"
          navigation={{ goBack: back }}
          backAccessibilityLabel="Back in CSV import"
          elevated={elevated}
          rightAction={
            <HeaderAction
              accessibilityLabel="Cancel CSV import"
              icon="close"
              iconOnly
              onPress={() => {
                if (!lock.current) navigation.goBack();
              }}
              disabled={busy}
            />
          }
        />
        <FlatList
          key={stage}
          data={rows}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={[styles.content, { paddingBottom: clearance + bottom }]}
          initialNumToRender={12}
          windowSize={7}
          onScroll={(event) => setElevated(event.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <View style={styles.stack}>
              {stage === 'file' ? (
                <>
                  <Text style={styles.heading}>Bring your workout history</Text>
                  <Text style={styles.copy}>
                    Choose a CSV export. Review its exercises and sessions before adding anything to
                    Forge.
                  </Text>
                  <ForgeCard style={styles.card}>
                    <CsvSourceHeading source="hevy" title="Hevy" />
                    <Text style={styles.copy}>
                      In Hevy Settings, open Export & Import Data and export your workouts.
                    </Text>
                    <CsvSourceHeading source="strong" title="Strong" />
                    <Text style={styles.copy}>
                      In Strong Settings, choose Export Strong Data to create a CSV.
                    </Text>
                    <CsvSourceHeading source="fitnotes" title="FitNotes Android" />
                    <Text style={styles.copy}>
                      Use Settings → Spreadsheet Export to export your workout history.
                    </Text>
                    <CsvSourceHeading source="fitnotes-ios" title="FitNotes iOS" />
                    <Text style={styles.copy}>
                      Use the app’s CSV export with Date, Exercise, and Weight columns.
                    </Text>
                  </ForgeCard>
                  <Button
                    label={file ? 'Choose another CSV' : 'Choose CSV file'}
                    icon="database-import"
                    variant="outline"
                    onPress={() => {
                      void chooseFile();
                    }}
                    disabled={busy}
                  />
                  {file ? (
                    <Button
                      label="Resume review"
                      variant="secondary"
                      onPress={() => setStage('detected')}
                    />
                  ) : null}
                </>
              ) : null}
              {draft && stage === 'detected' ? (
                <>
                  <CsvSourceHeading
                    source={draft.source}
                    title={`${sourceLabels[draft.source]} CSV detected`}
                    detected
                  />
                  <Text style={styles.copy}>{file?.name}</Text>
                  <ForgeCard style={styles.card}>
                    <Text style={styles.title}>
                      {draft.workouts.length} valid workout{draft.workouts.length === 1 ? '' : 's'}
                    </Text>
                    {dateRange ? <Text style={styles.copy}>{dateRange}</Text> : null}
                    <Text style={styles.copy}>
                      {draft.excluded} workout{draft.excluded === 1 ? '' : 's'} excluded ·{' '}
                      {draft.issues.length} validation problem{draft.issues.length === 1 ? '' : 's'}
                    </Text>
                  </ForgeCard>
                  {draft.limitations.map((limitation) => (
                    <Text key={limitation} style={styles.copy}>
                      {limitation}
                    </Text>
                  ))}
                  {!draft.workouts.length && !draft.requirements.length ? (
                    <Text style={styles.copy}>
                      No complete workouts can be imported. Correct the reported problems or choose
                      another export.
                    </Text>
                  ) : null}
                </>
              ) : null}
              {stage === 'matches' ? (
                <>
                  <Text style={styles.heading}>Match your exercises</Text>
                  <Text style={styles.copy}>
                    Confirmed matches are remembered on this device. Change any match, or keep an
                    unknown exercise as custom.
                  </Text>
                </>
              ) : null}
              {stage === 'catalog' ? (
                <>
                  <Text style={styles.heading}>Choose an exercise</Text>
                  <ForgeSearchField
                    value={query}
                    onChangeText={setQuery}
                    accessibilityLabel="Search Forge exercises"
                  />
                  {rows.length === 1 ? (
                    <Text style={styles.copy}>
                      No library matches. Try a shorter search or keep the source exercise as
                      custom.
                    </Text>
                  ) : null}
                </>
              ) : null}
              {stage === 'sessions' ? (
                <>
                  <Text style={styles.heading}>Review sessions</Text>
                  <Text style={styles.copy}>
                    Select workouts to import. Existing sessions stay unless you explicitly choose
                    Replace. Multiple sessions on the same day are kept.
                  </Text>
                  {sessions.some((match) => match.status !== 'duplicate') ? (
                    <Button
                      label={
                        sessions
                          .filter((match) => match.status !== 'duplicate')
                          .every((match) => selected.has(match.workout.id))
                          ? 'Deselect all workouts'
                          : 'Select all workouts'
                      }
                      variant="secondary"
                      onPress={() => {
                        const available = sessions.filter((match) => match.status !== 'duplicate');
                        setSelected(
                          available.every((match) => selected.has(match.workout.id))
                            ? new Set()
                            : new Set(available.map((match) => match.workout.id)),
                        );
                      }}
                    />
                  ) : null}
                </>
              ) : null}
              {stage === 'result' && result ? (
                <>
                  <Text style={styles.heading}>{result.added + result.replaced === 0 ? 'Exercise matches saved' : 'Import complete'}</Text>
                  <ForgeCard style={styles.card}>
                    <Text style={styles.title}>
                      {result.added} added · {result.replaced} replaced
                    </Text>
                    <Text style={styles.copy}>
                      {result.duplicates} duplicate{result.duplicates === 1 ? '' : 's'} skipped
                    </Text>
                    <Text style={styles.copy}>
                      {result.excluded} incomplete workout{result.excluded === 1 ? '' : 's'}{' '}
                      excluded
                    </Text>
                    <Text style={styles.copy}>
                      {result.customExercises} custom exercise
                      {result.customExercises === 1 ? '' : 's'} created
                    </Text>
                    <Text style={styles.copy}>{result.mappingsSaved} exercise match{result.mappingsSaved === 1 ? '' : 'es'} saved</Text>
                  </ForgeCard>
                  <Button label="Done" variant="outline" onPress={() => navigation.goBack()} />
                </>
              ) : null}
              {busy ? (
                <View style={styles.loading} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={theme.textPrimary} />
                  <Text style={styles.copy}>Working with your local data…</Text>
                </View>
              ) : null}
              {error ? (
                <ForgeCard style={styles.card}>
                  <Text style={styles.title}>
                    {stage === 'result' ? 'Could not refresh' : 'Could not import'}
                  </Text>
                  <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                  </Text>
                  {stage === 'sessions' ? (
                    <Text style={styles.copy}>
                      Your selections and exercise matches are kept. Review and retry when ready.
                    </Text>
                  ) : null}
                </ForgeCard>
              ) : null}
            </View>
          }
          renderItem={({ item }) => <CsvImportRow item={item} busy={busy} />}
        />
        {['detected', 'matches', 'sessions'].includes(stage) ? (
          <ForgeFloatingCta
            labelStyle={busy || !canContinue ? undefined : { color: theme.textPrimary }}
            accessibilityLabel={
              stage === 'sessions'
                ? reviewLabel
                : 'Continue CSV import'
            }
            label={
              stage === 'sessions'
                ? reviewLabel
                : 'Continue'
            }
            icon={stage === 'sessions' ? 'check' : 'chevron-forward'}
            tone={stage === 'sessions' ? 'success' : 'neutral'}
            disabled={busy || !canContinue}
            onPress={() => {
              setError('');
              if (stage === 'detected') setStage('matches');
              else if (stage === 'matches') setStage('sessions');
              else {
                reviewed.current = Object.fromEntries(
                  sessions.map((match) => [match.workout.id, reviewStamp(match)]),
                );
                setConfirm(true);
              }
            }}
          />
        ) : null}
        <ForgeSelectionSheet
          visible={Boolean(choice)}
          title={choice?.title ?? ''}
          accessibilityLabel={choice?.title ?? ''}
          options={choice?.options ?? []}
          selectedValue={choice?.value ?? ''}
          onClose={() => setChoice(null)}
          onSelect={(value) => {
            choice?.select(value);
            setChoice(null);
          }}
        />
        <ForgeConfirmationDialog
          visible={confirm}
          title={mappingsOnly ? 'Save exercise matches?' : 'Import selected workouts?'}
          message={`${actionable.filter((match) => match.status === 'new' || choices[match.workout.id] === 'both').length} added, ${actionable.filter((match) => choices[match.workout.id] === 'replace').length} replaced. Duplicates skipped: ${sessions.filter((match) => match.status === 'duplicate').length}. Incomplete workouts excluded: ${draft?.excluded ?? 0}. Custom exercises required: ${customCount}.${changedMappings.length ? ` Exercise matches to save: ${changedMappings.length}.` : ''}${mappingsOnly ? ' Existing workouts stay unchanged.' : ''}`}
          cancelLabel="Back to review"
          confirmLabel={mappingsOnly ? 'Save matches' : 'Import workouts'}
          confirmTone="success"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            void save();
          }}
          testID="csv-import-confirmation"
        />
      </View>
    </AppScreen>
  );
}

const createStyles = (theme: import('../../../types').ForgeTheme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    list: { flex: 1 },
    content: { paddingHorizontal: scaleUI(20), paddingTop: scaleUI(8), gap: scaleUI(12) },
    stack: { gap: scaleUI(14), marginBottom: scaleUI(14) },
    heading: { ...typeScale.sectionTitle, color: theme.textPrimary },
    title: { ...typeScale.cardTitle, color: theme.textPrimary },
    copy: { ...typeScale.supporting, color: theme.textSecondary },
    card: { padding: scaleUI(18), gap: scaleUI(12) },
    error: { ...typeScale.supporting, color: theme.textPrimary },
    loading: { flexDirection: 'row', alignItems: 'center', gap: scaleUI(12) },
  });
