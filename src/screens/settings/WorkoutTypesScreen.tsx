import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen, ForgeText as Text, HeaderCircleAction, Icon, lightHaptic, pressedFeedback, selectionHaptic } from '../../components/ui';
import { useSettings } from '../../state/SettingsContext';
import { dashboardTheme } from '../../theme/dashboardTheme';
import { typeScale } from '../../theme/tokens';
import type { RootStackParamList, WorkoutTypePreference } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutTypes'>;
const colors = ['#7C8CF8', '#6BD48F', '#F27D7D', '#F4A261', '#B78AF0', '#9CA3AF'];

export function WorkoutTypesScreen({ navigation }: Props) {
  const { preferences, updatePreferences } = useSettings();
  const [editing, setEditing] = useState(false);
  const visible = useMemo(() => preferences.workoutTypes.filter((type) => !type.hidden), [preferences.workoutTypes]);
  const hidden = useMemo(() => preferences.workoutTypes.filter((type) => type.hidden), [preferences.workoutTypes]);
  const update = (next: WorkoutTypePreference[]): void => updatePreferences({ workoutTypes: next });
  const add = (): void => {
    lightHaptic();
    const type = { id: `type-${Date.now()}`, name: 'New type', color: colors[preferences.workoutTypes.length % colors.length], source: 'custom' as const };
    update([...preferences.workoutTypes, type]);
    navigation.navigate('WorkoutTypeEditor', { workoutTypeId: type.id });
  };
  const move = (id: string, direction: -1 | 1): void => {
    const next = [...preferences.workoutTypes];
    const index = next.findIndex((type) => type.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= next.length || next[target].hidden) return;
    [next[index], next[target]] = [next[target], next[index]];
    selectionHaptic();
    update(next);
  };
  return <AppScreen backgroundColor={dashboardTheme.background}><View style={styles.screen}><SettingsDetailHeader title="Workout types" navigation={navigation} rightAction={<View style={styles.headerActions}><Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Finish editing workout types' : 'Edit workout types'} onPress={() => { selectionHaptic(); setEditing((current) => !current); }} style={({ pressed }) => [styles.edit, pressed && styles.pressed]}><Text style={styles.editText}>{editing ? 'Done' : 'Edit'}</Text></Pressable><HeaderCircleAction accessibilityLabel="Add workout type" icon="add" iconSize={20} onPress={add} /></View>} /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><TypeSection types={visible} editing={editing} onOpen={(type) => navigation.navigate('WorkoutTypeEditor', { workoutTypeId: type.id })} onMove={move} />{hidden.length > 0 && <TypeSection title="Hidden" types={hidden} editing={false} onOpen={(type) => navigation.navigate('WorkoutTypeEditor', { workoutTypeId: type.id })} onMove={move} hidden />}</ScrollView></View></AppScreen>;
}

function TypeSection({ title, types, editing, onOpen, onMove, hidden = false }: { title?: string; types: WorkoutTypePreference[]; editing: boolean; hidden?: boolean; onOpen: (type: WorkoutTypePreference) => void; onMove: (id: string, direction: -1 | 1) => void }) {
  return <View style={styles.section}>{title && <Text style={styles.sectionTitle}>{title}</Text>}<View style={styles.card}>{types.map((type, index) => <React.Fragment key={type.id}><Pressable accessibilityRole="button" accessibilityLabel={`${type.name} workout type`} onPress={() => !editing && onOpen(type)} style={({ pressed }) => [styles.row, pressed && pressedFeedback]}><View style={[styles.swatch, { backgroundColor: type.color }]} /><Text style={styles.name} numberOfLines={1}>{type.name}</Text><Icon name={type.source === 'builtIn' ? 'verified' : 'note'} size={17} color={dashboardTheme.slate} accessibilityLabel={type.source === 'builtIn' ? 'Provided by Forge' : 'Created by you'} />{editing ? <View style={styles.reorder}><Icon name="drag" size={17} color={dashboardTheme.muted} /><Pressable accessibilityRole="button" accessibilityLabel={`Move ${type.name} up`} disabled={index === 0} onPress={() => onMove(type.id, -1)} style={({ pressed }) => [styles.move, index === 0 && styles.disabled, pressed && styles.pressed]}><Icon name="arrow-up" size={15} color={dashboardTheme.slate} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Move ${type.name} down`} disabled={index === types.length - 1} onPress={() => onMove(type.id, 1)} style={({ pressed }) => [styles.move, index === types.length - 1 && styles.disabled, pressed && styles.pressed]}><Icon name="arrow-down" size={15} color={dashboardTheme.slate} /></Pressable></View> : <>{hidden && <Text style={styles.hidden}>Hidden</Text>}<Icon name="chevron-forward" size={18} color={dashboardTheme.slate} /></>}</Pressable>{index < types.length - 1 && <View style={styles.divider} />}</React.Fragment>)}</View></View>;
}

const card = { overflow: 'hidden', borderRadius: dashboardTheme.cardRadius, backgroundColor: dashboardTheme.surface, shadowColor: '#17191C', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 } as const;
const styles = StyleSheet.create({ screen: { flex: 1 }, headerActions: { width: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }, edit: { minWidth: 48, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, editText: { ...typeScale.controlLabel, color: dashboardTheme.ink }, content: { padding: 20, paddingTop: 20, paddingBottom: 40, gap: 22 }, section: { gap: 8 }, sectionTitle: { ...typeScale.sectionTitle, color: dashboardTheme.slate }, card, row: { minHeight: 54, paddingHorizontal: 16, gap: 10, flexDirection: 'row', alignItems: 'center' }, swatch: { width: 14, height: 14, borderRadius: 7 }, name: { flex: 1, minWidth: 0, color: dashboardTheme.ink, ...typeScale.cardTitle }, hidden: { color: dashboardTheme.slate, ...typeScale.caption }, divider: { height: StyleSheet.hairlineWidth, marginLeft: 40, backgroundColor: dashboardTheme.divider }, reorder: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 1, marginRight: -10 }, move: { width: 27, height: 44, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.22 }, pressed: { opacity: 0.56 } });
