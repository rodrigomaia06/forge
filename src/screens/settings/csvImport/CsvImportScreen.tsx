import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View, BackHandler, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  ForgeCard,
  ForgeConfirmationDialog,
  ForgeFloatingCta,
  ForgeActionSheet,
  ForgeSelectionSheet,
  ForgeText as Text,
  HeaderAction,
  Icon,
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
import { pickStriveBackup } from '../../../data/pickStriveBackup';
import { parseStriveSnapshotAsync, type StriveSnapshot } from '../../../data/striveImport';
import { parseWorkoutCsvAsync } from '../../../data/csvImport/parse';
import { AddExerciseSheet } from '../../activeWorkout/WorkoutSheets';
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
import { CsvImportRow, CsvImportSummary, type CsvReviewRow as Row } from './CsvImportRow';
import { CsvSourceHeading } from './CsvSourceHeading';

type Props = NativeStackScreenProps<RootStackParamList, 'CsvImport'>;
type ImportFile = { name: string; text: string } | { name: string; snapshot: StriveSnapshot };
type Stage = 'file' | 'detected' | 'matches' | 'sessions' | 'result';
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
  const [file, setFile] = useState<ImportFile | null>(null);
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
  const [matchActions, setMatchActions] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRequested = useRef(false);
  const [showAllExercises, setShowAllExercises] = useState(false);
  const editingResolution = resolutions.find((item) => item.key === editing);
  const unresolved = resolutions.filter((item) => !item.exercise);
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
  const changedMappings = resolutions.filter(
    (item) => item.confirmed && item.exercise && savedMappings[item.key] !== item.exercise.id,
  );
  const mappingsOnly = actionable.length === 0 && changedMappings.length > 0;
  const reviewLabel = mappingsOnly
    ? `Review ${changedMappings.length} exercise match${changedMappings.length === 1 ? '' : 'es'}`
    : `Review ${actionable.length} workout${actionable.length === 1 ? '' : 's'}`;
  const requiredCustom = new Set([
    ...actionable.flatMap((match) =>
      match.workout.exercises.map((exercise) => exercise.exerciseId),
    ),
    ...changedMappings.map((item) => item.exercise!.id),
  ]);
  const customCount = resolutions.filter(
    (resolution) => resolution.custom && requiredCustom.has(resolution.exercise?.id),
  ).length;
  const addedCount = actionable.filter(
    (match) => match.status === 'new' || choices[match.workout.id] === 'both',
  ).length;
  const replacedCount = actionable.filter(
    (match) => choices[match.workout.id] === 'replace',
  ).length;
  const duplicateCount = sessions.filter((match) => match.status === 'duplicate').length;
  const summaryRows = (
    counts: {
      added: number;
      replaced: number;
      duplicates: number;
      excluded: number;
      custom: number;
      mappings: number;
    },
    saved = false,
  ): Row[] =>
    [
      {
        key: 'added',
        title: saved ? 'Workouts added' : 'Add workouts',
        icon: 'calendar',
        value: counts.added,
      },
      {
        key: 'replaced',
        title: saved ? 'Workouts replaced' : 'Replace workouts',
        icon: 'replace',
        value: counts.replaced,
      },
      {
        key: 'duplicates',
        title: 'Duplicates skipped',
        icon: 'duplicate',
        value: counts.duplicates,
      },
      {
        key: 'excluded',
        title: 'Incomplete workouts excluded',
        icon: 'alert-triangle',
        value: counts.excluded,
      },
      {
        key: 'custom',
        title: saved ? 'Custom exercises created' : 'Create custom exercises',
        icon: 'sparkles',
        value: counts.custom,
      },
      {
        key: 'mappings',
        title: saved ? 'Exercise matches saved' : 'Save exercise matches',
        icon: 'layers',
        value: counts.mappings,
      },
    ].filter((item) => Number(item.value) > 0) as Row[];
  const back = () => {
    if (lock.current) return;
    setError('');
    if (pickerOpen) setPickerOpen(false);
    else if (matchActions) setMatchActions(false);
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
  async function analyze(picked: ImportFile, nextOptions: CsvOptions) {
    const parsed =
      'snapshot' in picked
        ? await parseStriveSnapshotAsync(picked.snapshot, nextOptions)
        : await parseWorkoutCsvAsync(picked.text, nextOptions);
    const mappings = await loadCsvMappings();
    setSavedMappings(mappings);
    setDraft(parsed);
    setResolutions(resolveCsvExercises(parsed, exercises, mappings));
    setSelected(new Set(parsed.workouts.map((workout) => workout.id)));
    setAcknowledged(false);
    setChoices({});
    setShowAllExercises(false);
    setOptions(nextOptions);
    setStage('detected');
  }
  async function chooseFile(strive = false) {
    if (lock.current) return;
    lock.current = true;
    setError('');
    try {
      if (strive) setBusy(true);
      const picked = strive ? await pickStriveBackup() : await pickWorkoutCsv();
      if (!picked) return;
      setBusy(true);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      await analyze(picked, {});
      setFile(picked);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Could not read the file. Choose it again.',
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
    setMatchActions(true);
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
          : requirement === 'durationUnit'
            ? [
                { value: 'sec', label: 'Seconds' },
                { value: 'min', label: 'Minutes' },
              ]
            : requirement === 'weightUnit'
              ? [
                  { value: 'kg', label: 'Kilograms (kg)' },
                  { value: 'lb', label: 'Pounds (lb)' },
                ]
              : [
                  ...(draft.source === 'strive' ? [{ value: 'm', label: 'Metres (m)' }] : []),
                  { value: 'km', label: 'Kilometres (km)' },
                  { value: 'mi', label: 'Miles (mi)' },
                ];
      rows.push({
        key: requirement,
        icon: 'alert-triangle',
        status: 'Choice required',
        title:
          requirement === 'dateOrder'
            ? 'Choose date order'
            : requirement === 'durationUnit'
              ? 'Choose duration unit'
              : requirement === 'weightUnit'
                ? 'Choose source weight unit'
                : 'Choose source distance unit',
        detail: 'The source file does not specify this unambiguously.',
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
        icon: 'alert-triangle',
        title: `${draft.source === 'strive' ? 'Record' : 'Row'} ${issue.row} · ${issue.field}`,
        detail: issue.message,
      });
  }
  if (stage === 'matches')
    for (const item of unresolved.length && !showAllExercises
      ? unresolved
      : [...unresolved, ...resolutions.filter((entry) => entry.exercise)])
      rows.push({
        key: item.key,
        icon: !item.exercise ? 'alert-triangle' : item.custom ? 'sparkles' : 'layers',
        title: item.name,
        detail: item.exercise
          ? item.custom
            ? 'Custom exercise'
            : item.exercise.name !== item.name
              ? item.exercise.name
              : undefined
          : 'Choose an exercise',
        onPress: () => editMatch(item),
      });
  if (stage === 'sessions')
    for (const match of sessions) {
      const { workout, status } = match;
      rows.push({
        key: workout.id,
        icon:
          status === 'duplicate' ? 'duplicate' : status === 'new' ? 'calendar' : 'alert-triangle',
        status:
          status === 'duplicate'
            ? 'Already imported · skipped'
            : status === 'new'
              ? 'New session'
              : status === 'ambiguous'
                ? 'Ambiguous match'
                : 'Changed session',
        title: workout.name,
        detail: `${new Date(workout.startedAt).toLocaleDateString()} · ${workout.exercises.length} exercise${workout.exercises.length === 1 ? '' : 's'}`,
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
          inset: true,
          detail:
            choices[workout.id] === 'replace'
              ? `The ${draft?.source === 'strive' ? 'backup' : 'CSV'} version will replace this workout.`
              : choices[workout.id] === 'both'
                ? 'Both versions will be kept.'
                : `The ${draft?.source === 'strive' ? 'backup' : 'CSV'} version will be skipped.`,
          icon:
            choices[workout.id] === 'replace'
              ? 'replace'
              : choices[workout.id] === 'both'
                ? 'duplicate'
                : 'verified',
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
          inset: true,
          icon: 'info',
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
              inset: true,
              title: change.label,
              detail: `On device: ${change.before}\n${draft?.source === 'strive' ? 'Strive' : 'CSV'}: ${change.after}`,
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
              {['detected', 'matches', 'sessions'].includes(stage) ? (
                <View style={styles.loading} accessibilityLiveRegion="polite">
                  <Icon
                    name={
                      stage === 'detected'
                        ? 'database-import'
                        : stage === 'matches'
                          ? 'layers'
                          : 'calendar'
                    }
                    size={scaleUI(18)}
                    color={theme.textSecondary}
                  />
                  <Text style={styles.copy}>
                    {stage === 'detected'
                      ? '1 of 3 · Check file'
                      : stage === 'matches'
                        ? '2 of 3 · Exercises'
                        : '3 of 3 · Workouts'}
                  </Text>
                </View>
              ) : null}
              {error ? (
                <ForgeCard style={styles.card}>
                  <View style={styles.loading}>
                    <Icon name="alert-triangle" color={theme.textPrimary} size={scaleUI(22)} />
                    <Text style={styles.title}>
                      {stage === 'result' ? 'Could not refresh' : 'Could not import'}
                    </Text>
                  </View>
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
              {stage === 'file' ? (
                <>
                  <Text style={styles.heading}>Bring your workout history</Text>
                  <Text style={styles.copy}>
                    Choose a CSV export or Strive database backup. Review its exercises and sessions
                    before adding anything to Forge.
                  </Text>
                  <ForgeCard size="compact">
                    {(
                      [
                        ['hevy', 'Hevy', 'Settings → Export & Import Data → Export workouts.'],
                        ['strong', 'Strong', 'Settings → Export Strong Data.'],
                        ['fitnotes', 'FitNotes Android', 'Settings → Spreadsheet Export.'],
                        [
                          'fitnotes-ios',
                          'FitNotes iOS',
                          'Export a CSV with Date, Exercise and Weight columns.',
                        ],
                        [
                          'strive',
                          'Strive',
                          'Choose an exported .db or .sqlite backup (schema 85). Completed workouts only. Available in the iOS and Android app.',
                        ],
                      ] as const
                    ).map(([source, title, detail], index) => (
                      <View key={source} style={[styles.sourceRow, index < 4 && styles.divider]}>
                        <CsvSourceHeading source={source} title={title} />
                        <Text style={styles.copy}>{detail}</Text>
                      </View>
                    ))}
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
                  <Button
                    label="Choose Strive backup"
                    icon="database-import"
                    variant="outline"
                    disabled={busy || Platform.OS === 'web'}
                    onPress={() => {
                      void chooseFile(true);
                    }}
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
                    title={
                      draft.source === 'strive'
                        ? 'Strive backup detected'
                        : `${sourceLabels[draft.source]} CSV detected`
                    }
                    detected
                  />
                  <Text style={styles.copy}>{file?.name}</Text>
                  <CsvImportSummary
                    rows={[
                      ...(!draft.requirements.length
                        ? [
                            {
                              key: 'valid',
                              title: `${draft.workouts.length} valid workout${draft.workouts.length === 1 ? '' : 's'}`,
                              icon: 'calendar' as const,
                              detail: dateRange || undefined,
                            },
                          ]
                        : []),
                      ...(draft.excluded && !draft.requirements.length
                        ? [
                            {
                              key: 'excluded',
                              title: `${draft.excluded} workout${draft.excluded === 1 ? '' : 's'} excluded`,
                              icon: 'alert-triangle' as const,
                            },
                          ]
                        : []),
                      {
                        key: 'validation',
                        title: draft.requirements.length
                          ? 'Source details needed'
                          : draft.issues.length
                            ? `${draft.issues.length} validation problem${draft.issues.length === 1 ? '' : 's'}`
                            : 'No validation problems',
                        icon:
                          draft.requirements.length || draft.issues.length
                            ? 'alert-triangle'
                            : 'check',
                      },
                      ...(draft.source.startsWith('fitnotes')
                        ? [
                            {
                              key: 'grouping',
                              title: 'Date grouping in FitNotes',
                              detail:
                                'Exports without session IDs cannot distinguish separate workouts on the same date.',
                              icon: 'info' as const,
                            },
                          ]
                        : []),
                    ]}
                  />
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
                  <Text style={styles.heading}>
                    {unresolved.length
                      ? `${unresolved.length} exercise${unresolved.length === 1 ? '' : 's'} to choose`
                      : 'Review exercises'}
                  </Text>
                  <Text style={styles.copy}>
                    {unresolved.length
                      ? 'Choose a library exercise or keep the source name as custom to continue.'
                      : 'Continue to your workouts, or change an exercise below.'}
                  </Text>
                  {unresolved.length && resolutions.length > unresolved.length ? (
                    <Button
                      variant="ghost"
                      label={
                        showAllExercises ? 'Show only exercises to choose' : 'Show all exercises'
                      }
                      onPress={() => setShowAllExercises(!showAllExercises)}
                    />
                  ) : null}
                </>
              ) : null}
              {stage === 'sessions' ? (
                <>
                  <Text style={styles.heading}>Review workouts</Text>
                  <Text style={styles.copy}>
                    Choose which workouts to import. Changed workouts keep the existing version
                    until you choose otherwise.
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
                  <Text style={styles.heading}>
                    {result.added + result.replaced === 0 ? 'Matches saved' : 'Import complete'}
                  </Text>
                  <View style={styles.loading} accessibilityLiveRegion="polite">
                    <Icon name="check" color={theme.success} size={scaleUI(22)} />
                    <Text style={styles.copy}>Saved on this device</Text>
                  </View>
                  <CsvImportSummary
                    rows={summaryRows(
                      { ...result, custom: result.customExercises, mappings: result.mappingsSaved },
                      true,
                    )}
                  />
                  <Button label="Done" variant="outline" onPress={() => navigation.goBack()} />
                </>
              ) : null}
              {busy ? (
                <View style={styles.loading} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={theme.textPrimary} />
                  <Text style={styles.copy}>Working with your local data…</Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item, index }) => (
            <CsvImportRow
              item={item}
              busy={busy}
              first={index === 0}
              last={index === rows.length - 1}
            />
          )}
          ListFooterComponent={
            stage === 'detected' && draft ? (
              <ForgeCard style={[styles.card, styles.notes]}>
                <View style={styles.loading}>
                  <Icon name="info" size={scaleUI(20)} color={theme.textSecondary} />
                  <Text style={styles.title}>Import details</Text>
                </View>
                {draft.limitations.map((limitation) => (
                  <Text key={limitation} style={styles.copy}>
                    {limitation}
                  </Text>
                ))}
              </ForgeCard>
            ) : null
          }
        />
        {editingResolution ? (
          <ForgeActionSheet
            visible={matchActions}
            title="Exercise"
            description={editingResolution.name}
            accessibilityLabel="Exercise import choices"
            onClose={() => setMatchActions(false)}
            onClosed={() => {
              if (pickerRequested.current) {
                pickerRequested.current = false;
                setPickerOpen(true);
              }
            }}
            actions={[
              {
                label: 'Choose from library',
                icon: 'layers',
                onPress: () => {
                  pickerRequested.current = true;
                },
              },
              {
                label: `Keep “${editingResolution.name}” as custom`,
                icon: 'sparkles',
                onPress: () =>
                  updateResolution(
                    editingResolution.key,
                    customCsvExercise(editingResolution),
                    true,
                  ),
              },
            ]}
          />
        ) : null}
        {pickerOpen ? (
          <AddExerciseSheet
            visible
            title="Exercises"
            selectionLimit={1}
            persistDerivedExercises={false}
            onClose={() => setPickerOpen(false)}
            onSubmit={(chosen) => {
              const exercise = chosen[0];
              if (editing && exercise)
                updateResolution(
                  editing,
                  exercise,
                  !exercises.some((item) => item.id === exercise.id),
                );
              setPickerOpen(false);
            }}
          />
        ) : null}
        {['detected', 'matches', 'sessions'].includes(stage) ? (
          <ForgeFloatingCta
            labelStyle={busy || !canContinue ? undefined : { color: theme.textPrimary }}
            accessibilityLabel={stage === 'sessions' ? reviewLabel : 'Continue CSV import'}
            label={stage === 'sessions' ? reviewLabel : 'Continue'}
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
          title={mappingsOnly ? 'Save matches?' : 'Ready to import?'}
          actionTreatment="form"
          message={mappingsOnly ? 'Existing workouts stay unchanged.' : undefined}
          children={
            <CsvImportSummary
              rows={summaryRows({
                added: addedCount,
                replaced: replacedCount,
                duplicates: duplicateCount,
                excluded: draft?.excluded ?? 0,
                custom: customCount,
                mappings: changedMappings.length,
              })}
            />
          }
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
    content: { paddingHorizontal: scaleUI(20), paddingTop: scaleUI(8), gap: 0 },
    stack: { gap: scaleUI(14), marginBottom: scaleUI(14) },
    heading: { ...typeScale.sectionTitle, color: theme.textPrimary },
    title: { ...typeScale.cardTitle, color: theme.textPrimary },
    copy: { ...typeScale.supporting, color: theme.textSecondary },
    sourceRow: { padding: scaleUI(16), gap: scaleUI(8) },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider },
    card: { padding: scaleUI(18), gap: scaleUI(12) },
    notes: { marginTop: scaleUI(14) },
    error: { ...typeScale.supporting, color: theme.textPrimary },
    loading: { flexDirection: 'row', alignItems: 'center', gap: scaleUI(12) },
  });
