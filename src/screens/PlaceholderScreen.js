import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreen, Button } from '../components/ui';
import { NavigationFooter } from '../components/NavigationFooter';
import { dashboardTheme } from '../theme/dashboardTheme';
import { typography } from '../theme/tokens';

export function PlaceholderScreen({ title, description, actionLabel, onAction }) {
  return <AppScreen backgroundColor={dashboardTheme.background}><View style={styles.screen}><View style={styles.container}><View style={styles.empty}><Text style={styles.title}>{title}</Text><Text style={styles.description}>{description}</Text>{actionLabel && <Button label={actionLabel} onPress={onAction} theme={dashboardTheme} style={styles.action} />}</View></View><NavigationFooter /></View></AppScreen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, padding: 20 },
  title: { color: dashboardTheme.ink, fontFamily: typography.bold, fontSize: 30, fontWeight: '700' },
  description: { color: dashboardTheme.slate, fontFamily: typography.regular, fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 300 },
  empty: { alignItems: 'flex-start', paddingTop: 32 },
  action: { marginTop: 20 },
});
