import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { ForgeBottomSheetDragArea } from './ForgeBottomSheet';
import { ForgeText as Text } from './ForgeText';
import { SheetCloseButton } from './SheetCloseButton';

interface ForgeSheetHeaderProps {
  title: string;
  onClose?: () => void;
  closeAccessibilityLabel?: string;
  closePosition?: 'left' | 'right';
  leading?: ReactNode;
  trailing?: ReactNode;
  testID?: string;
  horizontalInset?: number;
}

/** Shared title bar for Forge's bottom-attached sheets. */
export function ForgeSheetHeader({
  title,
  onClose,
  closeAccessibilityLabel,
  closePosition = 'right',
  leading,
  trailing,
  testID,
  horizontalInset = 20,
}: ForgeSheetHeaderProps) {
  const theme = useForgeTheme();
  return (
    <ForgeBottomSheetDragArea>
    <View testID={testID} style={[styles.header, { paddingHorizontal: horizontalInset }]}>
      <View style={[styles.leading, { left: horizontalInset }]}>
        {closePosition === 'left' && onClose ? (
          <SheetCloseButton
            accessibilityLabel={closeAccessibilityLabel ?? `Close ${title}`}
            onPress={onClose}
          />
        ) : null}
        {leading}
      </View>
      <Text numberOfLines={1} style={[styles.title, { color: theme.textPrimary }]}>
        {title}
      </Text>
      <View style={[styles.trailing, { right: horizontalInset }]}>
        {trailing}
        {closePosition === 'right' && onClose ? (
          <SheetCloseButton
            accessibilityLabel={closeAccessibilityLabel ?? `Close ${title}`}
            onPress={onClose}
          />
        ) : null}
      </View>
    </View>
    </ForgeBottomSheetDragArea>
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
