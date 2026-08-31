import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';

/** A restrained elevated edge for persistent Forge headers. */
export function HeaderEdge() {
  const theme = useForgeTheme();
  return (
    <View pointerEvents="none" style={styles.edge}>
      <View style={[styles.line, { backgroundColor: theme.divider }]} />
      <View style={[styles.shadow, { shadowColor: theme.shadow }]} />
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
  line: { height: 1 },
  shadow: {
    height: 7,
    backgroundColor: 'transparent',
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});
