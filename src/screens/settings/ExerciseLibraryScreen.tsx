import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen, ForgeText as Text } from '../../components/ui';
import { useExerciseCatalog } from '../../state/ExerciseCatalogContext';
import { useSettings } from '../../state/SettingsContext';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { IconName, RootStackParamList } from '../../types';
import { SettingsRow, SettingsSection, settingsLayout } from './SettingsRow';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { workoutTypeIcon } from './workoutTypeIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseLibrary'>;

export function ExerciseLibraryScreen({ navigation }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { preferences } = useSettings();
  const { exercises, customExercises } = useExerciseCatalog();
  const [headerElevated, setHeaderElevated] = React.useState(false);
  const visibleTypes = useMemo(
    () => preferences.workoutTypes.filter((type) => !type.hidden),
    [preferences.workoutTypes],
  );

  return (
    <AppScreen edges={['top']} testID="exercise-library-screen" backgroundColor={theme.background}>
      <View style={styles.screen}>
        <SettingsDetailHeader title="Exercises" navigation={navigation} elevated={headerElevated} />
        <ScrollView
          testID="exercise-library-scroll"
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: styles.content.paddingBottom + bottomInset }]}
          showsVerticalScrollIndicator={false}
          directionalLockEnabled
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => setHeaderElevated(event.nativeEvent.contentOffset.y > 1)}
          scrollEventThrottle={16}
        >
          <SettingsSection>
            {visibleTypes.map((type, index) => {
              const count = exercises.filter((exercise) =>
                exercise.workoutTypeIds.includes(type.id),
              ).length;
              return (
                <React.Fragment key={type.id}>
                  <LibraryRow
                    icon={workoutTypeIcon(type)}
                    color={type.color}
                    title={type.name}
                    count={count}
                    accessibilityLabel={`${type.name}, ${count} exercises`}
                    onPress={() =>
                      navigation.navigate('ExerciseBrowser', { workoutTypeId: type.id })
                    }
                    showDivider={index < visibleTypes.length - 1}
                  />
                </React.Fragment>
              );
            })}
          </SettingsSection>
          <SettingsSection>
            <LibraryRow
              icon="layers"
              color={theme.slate}
              title="All"
              count={exercises.length}
              accessibilityLabel={`All exercises, ${exercises.length} exercises`}
              onPress={() => navigation.navigate('ExerciseBrowser')}
              showDivider
            />
            <LibraryRow
              icon="add"
              color={theme.slate}
              title="Custom"
              count={customExercises.length}
              accessibilityLabel={`Custom exercises, ${customExercises.length} exercises`}
              onPress={() => navigation.navigate('ExerciseBrowser', { custom: true })}
            />
          </SettingsSection>
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
  showDivider = false,
}: {
  icon: IconName;
  color: string;
  title: string;
  count: number;
  accessibilityLabel: string;
  onPress: () => void;
  showDivider?: boolean;
}) {
  const theme = useForgeTheme();
  return (
    <SettingsRow
      title={title}
      icon={icon}
      iconColor={color}
      iconBackgroundColor={`${color}20`}
      accessibilityLabel={accessibilityLabel}
      testID={`exercise-library-type-${title.toLowerCase().replace(/\s+/g, '-')}`}
      onPress={onPress}
      haptic="selection"
      disclosure
      showDivider={showDivider}
      trailing={<Text style={[typeScale.supporting, { color: theme.textSecondary }]}>{count}</Text>}
    />
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    scroll: { flex: 1 },
    content: {
      padding: settingsLayout.screenPadding,
      paddingTop: settingsLayout.contentTop,
      // The screen adds its bottom safe area to this scrollable spacing,
      // leaving the viewport open through the home-indicator region.
      paddingBottom: settingsLayout.contentBottom,
      gap: settingsLayout.listGap,
    },
  });
