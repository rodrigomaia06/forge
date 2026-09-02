import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { ForgeText as Text } from './ForgeText';
import { SheetCloseButton } from './SheetCloseButton';

interface ForgeSheetHeaderProps {
  title: string;
  onClose?: () => void;
  closeAccessibilityLabel?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  testID?: string;
}

/** Shared title bar for Forge's bottom-attached sheets. */
export function ForgeSheetHeader({
  title,
  onClose,
  closeAccessibilityLabel,
  leading,
  trailing,
  testID,
}: ForgeSheetHeaderProps) {
  const theme = useForgeTheme();
  return (
    <View testID={testID} style={styles.header}>
      <View style={styles.leading}>{leading}</View>
      <Text numberOfLines={1} style={[styles.title, { color: theme.textPrimary }]}>
        {title}
      </Text>
      <View style={styles.trailing}>
        {trailing}
        {onClose ? (
          <SheetCloseButton
            accessibilityLabel={closeAccessibilityLabel ?? `Close ${title}`}
            onPress={onClose}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typeScale.headerTitle,
    textAlign: 'center',
    marginHorizontal: 74,
  },
  leading: {
    position: 'absolute',
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trailing: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
