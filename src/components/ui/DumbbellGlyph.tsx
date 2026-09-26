import React from 'react';
import Svg, { Rect, type SvgProps } from 'react-native-svg';

/**
 * Custom filled dumbbell glyph for the `weight` icon. Unlike the Tabler line
 * icons it is fill-based, so it takes its colour from the `color` prop via
 * react-native-svg's currentColor propagation. `strokeWidth` (passed by the
 * shared <Icon> wrapper) is ignored.
 */
export function DumbbellGlyph({ strokeWidth: _strokeWidth, ...props }: SvgProps) {
  return (
    <Svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <Rect x="7" y="10.5" width="10" height="3" rx="0.5" />
      <Rect x="2" y="10.5" width="2" height="3" rx="0.4" />
      <Rect x="3.5" y="7" width="2.5" height="10" rx="0.6" />
      <Rect x="5.5" y="5" width="2.5" height="14" rx="0.7" />
      <Rect x="16" y="5" width="2.5" height="14" rx="0.7" />
      <Rect x="18" y="7" width="2.5" height="10" rx="0.6" />
      <Rect x="20" y="10.5" width="2" height="3" rx="0.4" />
    </Svg>
  );
}
