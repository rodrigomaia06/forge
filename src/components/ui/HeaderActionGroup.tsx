import React, { createContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { useForgeTheme } from '../../theme/ThemeProvider';
import {
  ForgeControlSurface,
  resolveForgeControlFill,
  useForgeControlSurface,
} from './ForgeControlSurface';

/**
 * A joined pill of header actions — the shared treatment used by the live-workout
 * header's leading controls. Children are flush segments separated by a hairline;
 * pass `HeaderAction`s with `variant="ghost"` and `style={joinedHeaderAction}`.
 */
export const joinedHeaderAction = { borderRadius: 0 } as const;
export const JoinedHeaderActionContext = createContext(false);

export function HeaderActionGroup({
  children,
  testID,
}: {
  children: React.ReactNode;
  testID?: string;
}) {
  const theme = useForgeTheme();
  const parentSurface = useForgeControlSurface();
  const surface =
    theme.colorScheme === 'dark'
      ? parentSurface === theme.surfaceMuted
        ? theme.surfaceElevated
        : theme.surfaceMuted
      : resolveForgeControlFill(theme, parentSurface);
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View
      testID={testID}
      style={[
        styles.group,
        {
          borderWidth: 0,
          borderColor: theme.border,
          backgroundColor: surface,
        },
      ]}
    >
      <BlurView
        pointerEvents="none"
        intensity={theme.colorScheme === 'dark' ? 36 : 60}
        tint={theme.colorScheme === 'dark' ? 'dark' : 'light'}
        blurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: surface, opacity: theme.colorScheme === 'dark' ? 0.6 : 0.55 }]} />
      <ForgeControlSurface.Provider value={surface}>
        <JoinedHeaderActionContext.Provider value={true}>
        {items.map((child, index) => (
          <React.Fragment key={index}>
            {index > 0 ? (
              <View
                testID="header-action-separator"
                pointerEvents="none"
                style={[styles.divider, { backgroundColor: theme.slate }]}
              />
            ) : null}
            {child}
          </React.Fragment>
        ))}
        </JoinedHeaderActionContext.Provider>
      </ForgeControlSurface.Provider>
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
