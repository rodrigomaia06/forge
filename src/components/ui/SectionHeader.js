import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../../theme/tokens';

export function SectionHeader({ title, meta, theme = colors }) {
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
      {meta && <Text style={[styles.meta, { color: theme.muted }]}>{meta}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  title: { color: colors.ink, fontFamily: typography.semibold, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.muted, fontFamily: typography.regular, fontSize: 12 },
});
