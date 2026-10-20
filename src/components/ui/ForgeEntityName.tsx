import React, { useState } from 'react';
import { Platform, StyleSheet, View, type TextProps, type TextStyle } from 'react-native';
import { ForgeText } from './ForgeText';
import { ForgeBottomSheet, ForgeBottomSheetHandle } from './ForgeBottomSheet';
import { ForgeSheetHeader } from './ForgeSheetHeader';
import { ForgeSheetScrollView } from './ForgeSheetScrollView';
import { Button } from './Button';
import { scaleUI } from '../../theme/scale';
import { typeScale } from '../../theme/tokens';
import { useForgeTheme } from '../../theme/ThemeProvider';

export type EntityNamePresentation = 'preview' | 'full' | 'compact';
export type ForgeEntityNameProps = Omit<TextProps, 'numberOfLines' | 'adjustsFontSizeToFit' | 'minimumFontScale'> & {
  presentation?: EntityNamePresentation;
  /** Use only for a bounded preview without a full-name navigation destination. */
  disclose?: boolean;
};

export function ForgeEntityName({ presentation = 'full', disclose = false, children, style, ...props }: ForgeEntityNameProps) {
  const theme = useForgeTheme();
  const [open, setOpen] = useState(false);
  const text = (
    <ForgeText
      {...props}
      accessibilityLabel={props.accessibilityLabel ?? (typeof children === 'string' ? children : undefined)}
      numberOfLines={presentation === 'full' ? undefined : presentation === 'preview' ? 2 : 1}
      ellipsizeMode="tail"
      style={[styles.name, style]}
    >{children}</ForgeText>
  );
  if (!disclose || presentation === 'full') return text;
  return <View style={styles.disclosure}>
    {text}
    <Button label="Show full name" variant="ghost" onPress={() => setOpen(true)} />
    <ForgeBottomSheet visible={open} onClose={() => setOpen(false)} accessibilityLabel="Dismiss full name">
      <ForgeBottomSheetHandle />
      <ForgeSheetHeader title="Full name" onClose={() => setOpen(false)} />
      <ForgeSheetScrollView><ForgeText selectable style={[typeScale.body, styles.sheetName, { color: theme.textPrimary }]}>{children}</ForgeText></ForgeSheetScrollView>
    </ForgeBottomSheet>
  </View>;
}

const styles = StyleSheet.create({
  name: { minWidth: 0, flexShrink: 1, ...(Platform.OS === 'web' ? { overflowWrap: 'anywhere' } as TextStyle : {}) },
  disclosure: { minWidth: 0, flexShrink: 1, alignItems: 'flex-start' },
  sheetName: { padding: scaleUI(20) },
});
