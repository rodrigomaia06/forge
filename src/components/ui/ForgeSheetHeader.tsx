import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { ForgeBottomSheetDragArea } from './ForgeBottomSheet';
import { ForgeText as Text } from './ForgeText';
import { SheetCloseButton } from './SheetCloseButton';

interface ForgeSheetHeaderProps {
  title: string;
  /** Use for a deliberately descriptive sheet title that cannot fit on one line. */
  titleNumberOfLines?: number;
  /** Compact semantic title for a dense, chooser-style sheet header. */
  compactTitle?: boolean;
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
  titleNumberOfLines = 1,
  compactTitle = false,
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
      <Text numberOfLines={titleNumberOfLines} style={[styles.title, compactTitle && styles.compactTitle, { color: theme.textPrimary }]}>
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
  compactTitle: { ...typeScale.sectionTitle },
  leading: {
    position: 'absolute',
    left: 20,
    // Span the header's full height so alignItems actually centres the control
    // vertically; without top/bottom an absolute box wraps its content and
    // top-aligns on web, leaving the action sitting above the title.
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trailing: {
    position: 'absolute',
    right: 20,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
