import React from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

export function ForgeLoadingScreen() {
  // Use the opaque icon so the native splash and hydration screen have no tile edge.
  const backgroundColor = '#FFFFFF';
  const spinnerColor = '#1D252D';
  return (
    <View accessibilityLabel="Loading Forge" style={[styles.screen, { backgroundColor }]}>
      <Image source={require('../../assets/forge-app-icon-ios.png')} style={styles.icon} />
      <ActivityIndicator size="small" color={spinnerColor} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 84, height: 84 },
  spinner: { marginTop: 20 },
});
