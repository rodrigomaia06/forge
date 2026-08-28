import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen, Button, ForgeText as Text, ForgeTextInput as TextInput, Icon, lightHaptic, pressedFeedback, selectionHaptic } from '../../components/ui';
import { usePlans } from '../../state/PlansContext';
import { useSettings } from '../../state/SettingsContext';
import { useWorkouts } from '../../state/WorkoutContext';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { typeScale } from '../../theme/tokens';
import type { RootStackParamList, WorkoutTypePreference } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutTypeEditor'>;
const colors = [
  { name: 'Blue', value: '#7C8CF8' }, { name: 'Green', value: '#6BD48F' },
  { name: 'Red', value: '#F27D7D' }, { name: 'Orange', value: '#F4A261' },
  { name: 'Purple', value: '#B78AF0' }, { name: 'Gray', value: '#9CA3AF' },
];
const hexPattern = /^#[0-9A-F]{6}$/i;

export function WorkoutTypeEditorScreen({ navigation, route }: Props) {
  const { preferences, updatePreferences } = useSettings();
  const { activeWorkout, completedWorkouts } = useWorkouts();
  const { plans, standaloneRoutines } = usePlans();
  const type = preferences.workoutTypes.find((item) => item.id === route.params.workoutTypeId);
  const [customColor, setCustomColor] = useState(type?.color ?? '');
  const [customColorError, setCustomColorError] = useState(false);
  const referenced = useMemo(() => {
    if (!type) return false;
    const workouts = [activeWorkout, ...completedWorkouts].filter(Boolean).some((workout) => workout?.type === type.name);
    return workouts || [...standaloneRoutines, ...plans.flatMap((plan) => plan.routines)].some((routine) => routine.type === type.name);
  }, [activeWorkout, completedWorkouts, plans, standaloneRoutines, type]);

  useEffect(() => { if (type) setCustomColor(type.color); }, [type?.color]);
  if (!type) return <AppScreen backgroundColor={dashboardTheme.background}><SettingsDetailHeader title="Workout type" navigation={navigation} /></AppScreen>;
  const change = (changes: Partial<WorkoutTypePreference>): void => updatePreferences({ workoutTypes: preferences.workoutTypes.map((item) => item.id === type.id ? { ...item, ...changes, hasReferencedData: item.hasReferencedData || referenced } : item) });
  const mustHide = type.source === 'builtIn' || type.hasReferencedData || referenced;
  const destructiveLabel = type.hidden ? 'Unhide type' : mustHide ? 'Hide type' : 'Delete type';
  const applyCustomColor = (): void => {
    const color = customColor.trim().toUpperCase();
    if (!hexPattern.test(color)) { setCustomColorError(true); return; }
    setCustomColorError(false); selectionHaptic(); change({ color });
  };
  const removeOrHide = (): void => {
    const hide = mustHide;
    Alert.alert(hide ? 'Hide workout type?' : 'Delete workout type?', hide ? 'Past workouts, routines, and plans keep their saved type.' : 'This cannot be undone.', [
      { text: hide ? 'Hide' : 'Delete', style: 'destructive', onPress: () => { lightHaptic(); if (hide) change({ hidden: true }); else updatePreferences({ workoutTypes: preferences.workoutTypes.filter((item) => item.id !== type.id) }); navigation.goBack(); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return <AppScreen backgroundColor={dashboardTheme.background}><View style={styles.screen}><SettingsDetailHeader title={type.name.trim() || 'Workout type'} navigation={navigation} /><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.card}><Text style={styles.label}>Name</Text><TextInput accessibilityLabel="Workout type name" value={type.name} onChangeText={(name) => change({ name })} placeholder="Workout type" placeholderTextColor={dashboardTheme.muted} style={styles.input} /><View style={styles.divider} /><View style={styles.sourceRow}><View style={styles.sourceIcon}><Icon name={type.source === 'builtIn' ? 'verified' : 'note'} size={18} color={dashboardTheme.slate} accessibilityLabel={type.source === 'builtIn' ? 'Provided by Forge' : 'Created by you'} /></View><View><Text style={styles.label}>Source</Text><Text style={styles.source}>{type.source === 'builtIn' ? 'Provided by Forge' : 'Created by you'}</Text></View></View></View>
    <View style={styles.colorSection}><Text style={styles.sectionTitle}>Color</Text><View style={styles.card}>{colors.map((choice, index) => <React.Fragment key={choice.value}><Pressable accessibilityRole="button" accessibilityLabel={`Use ${choice.name} color`} accessibilityState={{ selected: type.color.toUpperCase() === choice.value }} onPress={() => { selectionHaptic(); setCustomColorError(false); setCustomColor(choice.value); change({ color: choice.value }); }} style={({ pressed }) => [styles.colorRow, pressed && pressedFeedback]}><View style={[styles.swatch, { backgroundColor: choice.value }]} /><Text style={styles.colorName}>{choice.name}</Text>{type.color.toUpperCase() === choice.value && <Icon name="check" size={18} color={dashboardTheme.accent} weight="bold" />}</Pressable>{index < colors.length - 1 && <View style={styles.rowDivider} />}</React.Fragment>)}<View style={styles.rowDivider} /><View style={styles.customRow}><View style={[styles.swatch, { backgroundColor: hexPattern.test(customColor.trim()) ? customColor.trim() : dashboardTheme.divider }]} /><View style={styles.customCopy}><Text style={styles.colorName}>Custom color</Text><TextInput accessibilityLabel="Custom workout type color" value={customColor} onChangeText={(value) => { setCustomColor(value); setCustomColorError(false); }} onBlur={applyCustomColor} onSubmitEditing={applyCustomColor} autoCapitalize="characters" autoCorrect={false} placeholder="#RRGGBB" placeholderTextColor={dashboardTheme.muted} style={styles.hexInput} /></View></View>{customColorError && <Text accessibilityRole="alert" style={styles.error}>Use a valid color such as #7C8CF8.</Text>}</View></View>
    <View style={styles.card}><Pressable accessibilityRole="switch" accessibilityLabel={`Hide ${type.name} from workout pickers`} accessibilityState={{ checked: type.hidden === true }} onPress={() => { selectionHaptic(); change({ hidden: !type.hidden }); }} style={({ pressed }) => [styles.hideRow, pressed && pressedFeedback]}><View style={styles.copy}><Text style={styles.hideTitle}>Hide from workout pickers</Text><Text style={styles.hideCopy}>Existing workouts, routines, and plans keep this type.</Text></View><View style={[styles.switch, type.hidden && styles.switchOn]}><View style={[styles.switchThumb, type.hidden && styles.switchThumbOn]} /></View></Pressable></View>
    <Button label={destructiveLabel} accessibilityLabel={destructiveLabel} icon={type.hidden ? 'check' : mustHide ? 'close' : 'trash'} variant="outline" labelColor={type.hidden ? dashboardTheme.accent : '#D64848'} onPress={() => { if (type.hidden) { lightHaptic(); change({ hidden: false }); } else removeOrHide(); }} theme={dashboardTheme} style={[styles.destructive, !type.hidden && styles.destructiveBorder]} />
  </ScrollView></View></AppScreen>;
}

const card = { overflow: 'hidden', borderRadius: dashboardTheme.cardRadius, padding: 16, gap: 9, backgroundColor: dashboardTheme.surface, shadowColor: '#17191C', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 } as const;
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { padding: 20, paddingTop: 20, paddingBottom: 40, gap: 18 }, card, label: { ...typeScale.label, color: dashboardTheme.slate }, sectionTitle: { ...typeScale.sectionTitle, color: dashboardTheme.slate }, input: { minHeight: 42, paddingVertical: 0, color: dashboardTheme.ink, ...typeScale.cardTitle }, divider: { height: StyleSheet.hairlineWidth, marginVertical: 5, backgroundColor: dashboardTheme.divider }, sourceRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }, sourceIcon: { width: 26, alignItems: 'center' }, source: { marginTop: 1, color: dashboardTheme.ink, ...typeScale.body }, colorSection: { gap: 8 }, colorRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12 }, rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 26, backgroundColor: dashboardTheme.divider }, swatch: { width: 14, height: 14, borderRadius: 7 }, colorName: { flex: 1, color: dashboardTheme.ink, ...typeScale.body }, customRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 }, customCopy: { flex: 1, minWidth: 0 }, hexInput: { minHeight: 24, paddingVertical: 0, marginTop: 1, color: dashboardTheme.slate, ...typeScale.supporting }, error: { marginTop: -2, color: '#D64848', ...typeScale.caption }, hideRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 }, copy: { flex: 1, minWidth: 0 }, hideTitle: { color: dashboardTheme.ink, ...typeScale.body }, hideCopy: { marginTop: 2, color: dashboardTheme.slate, ...typeScale.supporting }, switch: { width: 42, height: 26, padding: 3, borderRadius: 13, backgroundColor: dashboardTheme.divider }, switchOn: { backgroundColor: dashboardTheme.accent }, switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: dashboardTheme.surface }, switchThumbOn: { alignSelf: 'flex-end' }, destructive: { minHeight: 48 }, destructiveBorder: { borderColor: '#D64848' } });
