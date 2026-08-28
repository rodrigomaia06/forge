import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, typeScale } from '../../theme/tokens';
import { ForgeText as Text } from './ForgeText';
import type { ForgeTheme } from '../../types';

export function SectionHeader({
  title,
  meta,
  theme = colors,
}: {
  title: string;
  meta?: string;
  theme?: ForgeTheme;
}) {
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
      {meta && <Text style={[styles.meta, { color: theme.slate || theme.muted }]}>{meta}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  title: { color: colors.ink, ...typeScale.sectionTitle },
  meta: { color: colors.muted, ...typeScale.label },
});
