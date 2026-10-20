import React from 'react';
import { Platform, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import { ForgeText } from './ForgeText';

export type EntityNamePresentation = 'preview' | 'full' | 'compact';
export type ForgeEntityNameProps = Omit<TextProps, 'numberOfLines' | 'adjustsFontSizeToFit' | 'minimumFontScale'> & {
  presentation?: EntityNamePresentation;
};

export function ForgeEntityName({ presentation = 'full', children, style, ...props }: ForgeEntityNameProps) {
  return (
    <ForgeText
      {...props}
      accessibilityLabel={props.accessibilityLabel ?? (typeof children === 'string' ? children : undefined)}
      numberOfLines={presentation === 'full' ? undefined : presentation === 'preview' ? 2 : 1}
      ellipsizeMode="tail"
      style={[styles.name, style]}
    >{children}</ForgeText>
  );
}

const styles = StyleSheet.create({
  name: { minWidth: 0, flexShrink: 1, ...(Platform.OS === 'web' ? { overflowWrap: 'anywhere' } as TextStyle : {}) },
});
