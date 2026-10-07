import React from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

export function ForgeLoadingScreen() {
  // Match the opaque white logo and native splash so its corners never
  // expose a contrasting grey tile while fonts and data are loading.
  const backgroundColor = '#FFFFFF';
  const spinnerColor = '#1D252D';
  return (
    <View accessibilityLabel="Loading Forge" style={[styles.screen, { backgroundColor }]}>
      <Image source={require('../../assets/forge-app-icon.png')} style={styles.icon} />
      <ActivityIndicator size="small" color={spinnerColor} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 84, height: 84 },
  spinner: { marginTop: 20 },
});
