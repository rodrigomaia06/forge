import React from 'react';
import { DockChrome } from './DockChrome';
import { dashboardTheme } from '../theme/dashboardTheme';

export function NavigationFooter({ style }) {
  return <DockChrome theme={dashboardTheme} style={[styles.footer, style]} />;
}

const styles = { footer: { height: 88, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10, zIndex: 10 } };
