import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  AppScreen,
  ForgeCard,
  ForgeText as Text,
  Icon,
  pressedFeedback,
  selectionHaptic,
} from '../../components/ui';
import { useExerciseCatalog } from '../../state/ExerciseCatalogContext';
import { useSettings } from '../../state/SettingsContext';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { IconName, RootStackParamList } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { workoutTypeIcon } from './workoutTypeIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseLibrary'>;

export function ExerciseLibraryScreen({ navigation }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { preferences } = useSettings();
  const { exercises, customExercises } = useExerciseCatalog();
  const visibleTypes = useMemo(
    () => preferences.workoutTypes.filter((type) => !type.hidden),
    [preferences.workoutTypes],
  );

  return (
    <AppScreen backgroundColor={theme.background}>
      <View style={styles.screen}>
        <SettingsDetailHeader title="Exercises" navigation={navigation} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ForgeCard>
            {visibleTypes.map((type, index) => {
              const count = exercises.filter((exercise) =>
                exercise.workoutTypeIds.includes(type.id),
              ).length;
              return (
                <React.Fragment key={type.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <LibraryRow
                    icon={workoutTypeIcon(type)}
                    color={type.color}
                    title={type.name}
                    count={count}
                    accessibilityLabel={`${type.name}, ${count} exercises`}
                    onPress={() =>
                      navigation.navigate('ExerciseBrowser', { workoutTypeId: type.id })
                    }
                  />
                </React.Fragment>
              );
            })}
          </ForgeCard>
          <ForgeCard>
            <LibraryRow
              icon="layers"
              color={theme.slate}
              title="All"
              count={exercises.length}
              accessibilityLabel={`All exercises, ${exercises.length} exercises`}
              onPress={() => navigation.navigate('ExerciseBrowser')}
            />
            <View style={styles.divider} />
            <LibraryRow
              icon="add"
              color={theme.slate}
              title="Custom"
              count={customExercises.length}
              accessibilityLabel={`Custom exercises, ${customExercises.length} exercises`}
              onPress={() => navigation.navigate('ExerciseBrowser', { custom: true })}
            />
          </ForgeCard>
        </ScrollView>
      </View>
    </AppScreen>
  );
}

function LibraryRow({
  icon,
  color,
  title,
  count,
  accessibilityLabel,
  onPress,
}: {
  icon: IconName;
  color: string;
  title: string;
  count: number;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={`exercise-library-type-${title.toLowerCase().replace(/\s+/g, '-')}`}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && pressedFeedback]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${color}20` }]}>
        <Icon name={icon} size={22} color={color} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.name}>{title}</Text>
        <Text style={styles.count}>{`${count} ${count === 1 ? 'exercise' : 'exercises'}`}</Text>
      </View>
      <Icon name="chevron-forward" size={20} color={theme.textPrimary} />
    </Pressable>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: { padding: 20, paddingTop: 22, paddingBottom: 40, gap: 16 },
    row: {
      minHeight: 76,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1, minWidth: 0 },
    name: { ...typeScale.cardTitle, color: theme.ink },
    count: { ...typeScale.supporting, color: theme.slate, marginTop: 2 },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: 71, backgroundColor: theme.divider },
  });
