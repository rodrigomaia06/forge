import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';

/** A restrained elevated edge for persistent Forge headers. */
export function HeaderEdge() {
  const theme = useForgeTheme();
  return (
    <View testID="header-edge" style={[styles.edge, styles.pointerEventsNone]}>
      <View style={[styles.line, { backgroundColor: theme.divider }]} />
      <View style={[styles.shadow, { shadowColor: theme.shadow }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  pointerEventsNone: { pointerEvents: 'none' },
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
    shadowOpacity: 0.07,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});
