import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';

/**
 * A joined pill of header actions — the shared treatment used by the live-workout
 * header's leading controls. Children are flush segments separated by a hairline;
 * pass `HeaderAction`s with `variant="ghost"` and `style={joinedHeaderAction}`.
 */
export const joinedHeaderAction = { borderRadius: 0 } as const;

export function HeaderActionGroup({
  children,
  testID,
}: {
  children: React.ReactNode;
  testID?: string;
}) {
  const theme = useForgeTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View
      testID={testID}
      style={[
        styles.group,
        {
          borderWidth: 0,
          borderColor: theme.border,
          backgroundColor: theme.colorScheme === 'dark' ? theme.surfaceMuted : theme.surfaceElevated,
        },
      ]}
    >
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {index > 0 ? (
            <View testID="header-action-separator" pointerEvents="none" style={[styles.divider, { backgroundColor: theme.slate }]} />
          ) : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    overflow: 'hidden',
  },
  divider: { width: 1.5, alignSelf: 'stretch', marginVertical: 8 },
});
