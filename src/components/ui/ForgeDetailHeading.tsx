import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ForgeEntityName } from './ForgeEntityName';
import { typeScale } from '../../theme/tokens';
import { scaleUI } from '../../theme/scale';
import { useForgeTheme } from '../../theme/ThemeProvider';

/** Keep controls reachable when a full title would dominate the viewport. */
export function useForgeDetailHeading(name: string, testID?: string, style?: StyleProp<TextStyle>) {
  const theme = useForgeTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [measured, setMeasured] = useState({ name: '', height: 0 });
  const tall = measured.name === name && measured.height > (height - insets.top - insets.bottom) * 0.4;
  const titleStyle = [typeScale.headerTitle, { color: theme.textPrimary }, style];
  const headerTitle = <View style={styles.headerTitle}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={styles.measurement}>
      <ForgeEntityName style={titleStyle} onLayout={event => {
        const next = event.nativeEvent.layout.height;
        setMeasured(current => current.name === name && current.height === next ? current : { name, height: next });
      }}>{name}</ForgeEntityName>
    </View>
    {!tall ? <ForgeEntityName testID={testID} accessibilityRole="header" style={titleStyle}>{name}</ForgeEntityName> : null}
  </View>;
  const contentTitle = tall ? <ForgeEntityName testID={testID} accessibilityRole="header" style={[titleStyle, styles.contentTitle]}>{name}</ForgeEntityName> : null;
  return { headerTitle, contentTitle };
}

const styles = StyleSheet.create({
  headerTitle: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  measurement: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  contentTitle: { paddingVertical: scaleUI(12) },
});
