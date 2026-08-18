import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../theme/tokens';

export function AppScreen({ children, style, backgroundColor = colors.background }) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor }]}>
      <View style={[styles.content, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
});
