import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/tokens';

export function SectionHeader({ title, meta }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {meta && <Text style={styles.meta}>{meta}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 12 },
});
