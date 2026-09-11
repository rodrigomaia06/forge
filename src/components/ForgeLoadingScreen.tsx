import React from 'react';
import { ActivityIndicator, Image, StyleSheet, View, useColorScheme } from 'react-native';

export function ForgeLoadingScreen() {
  const dark = useColorScheme() === 'dark';
  const backgroundColor = dark ? '#17191C' : '#E8E8E8';
  const spinnerColor = dark ? '#F7F8F6' : '#1D252D';
  return (
    <View accessibilityLabel="Loading Forge" style={[styles.screen, { backgroundColor }]}>
      <Image source={require('../../assets/forge-app-icon.png')} style={styles.icon} />
      <ActivityIndicator size="small" color={spinnerColor} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 84, height: 84, borderRadius: 20 },
  spinner: { marginTop: 20 },
});
