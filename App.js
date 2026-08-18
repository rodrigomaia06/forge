import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DashboardScreen } from './src/screens/DashboardScreen';
import { ComponentGalleryScreen } from './src/screens/ComponentGalleryScreen';

function shouldShowComponentGallery() {
  return typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('screen') === 'components';
}

export default function App() {
  return (
    <SafeAreaProvider>
      {shouldShowComponentGallery() ? <ComponentGalleryScreen /> : <DashboardScreen />}
    </SafeAreaProvider>
  );
}
