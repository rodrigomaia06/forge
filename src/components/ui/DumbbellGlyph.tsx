import React from 'react';
import Svg, { Rect, type SvgProps } from 'react-native-svg';

/**
 * Custom filled dumbbell glyph for the `fitness` / strength icon. Unlike the
 * Tabler line icons it is fill-based, so it takes its colour from the `color`
 * prop via react-native-svg's currentColor propagation. `strokeWidth` (passed
 * by the shared <Icon> wrapper) is ignored.
 */
export function DumbbellGlyph({ strokeWidth: _strokeWidth, ...props }: SvgProps) {
  return (
    <Svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <Rect x="7" y="10.5" width="10" height="3" rx="1.5" />
      <Rect x="2" y="10.5" width="2" height="3" rx="1" />
      <Rect x="3.5" y="7" width="2.5" height="10" rx="1.25" />
      <Rect x="5.25" y="5" width="3" height="14" rx="1.5" />
      <Rect x="15.75" y="5" width="3" height="14" rx="1.5" />
      <Rect x="18" y="7" width="2.5" height="10" rx="1.25" />
      <Rect x="20" y="10.5" width="2" height="3" rx="1" />
    </Svg>
  );
}
