import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppScreen, Button, ForgeText as Text, lightHaptic, ScreenTitle } from '../components/ui';
import { dashboardTheme } from '../theme/dashboardTheme';
import { typeScale } from '../theme/tokens';

export function PlaceholderScreen({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction: () => void;
}) {
  return (
    <AppScreen backgroundColor={dashboardTheme.background}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <ScreenTitle color={dashboardTheme.ink}>{title}</ScreenTitle>
        </View>
        <View style={styles.container}>
          <View style={styles.empty}>
            <Text style={styles.description}>{description}</Text>
            {actionLabel && (
              <Button
                label={actionLabel}
                onPress={() => {
                  lightHaptic();
                  onAction();
                }}
                theme={dashboardTheme}
                style={styles.action}
              />
            )}
          </View>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    height: 70,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  container: { flex: 1, paddingHorizontal: 20 },
  description: { color: dashboardTheme.slate, ...typeScale.body, marginTop: 8, maxWidth: 300 },
  empty: { alignItems: 'flex-start', paddingTop: 24 },
  action: { marginTop: 20 },
});
