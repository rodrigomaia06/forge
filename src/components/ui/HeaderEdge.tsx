import React from 'react';
import { StyleSheet, View } from 'react-native';

import { dashboardTheme } from '../../theme/dashboardTheme';

/** A restrained elevated edge for persistent Forge headers. */
export function HeaderEdge() {
  return (
    <View pointerEvents="none" style={styles.edge}>
      <View style={styles.line} />
      <View style={styles.shadow} />
    </View>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    right: 0,
    bottom: -8,
    left: 0,
    height: 9,
    zIndex: 2,
  },
  line: { height: 1, backgroundColor: 'rgba(23,25,28,0.07)' },
  shadow: {
    height: 7,
    backgroundColor: 'rgba(23,25,28,0.008)',
    shadowColor: dashboardTheme.ink,
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});
