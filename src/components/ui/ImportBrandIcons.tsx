import React from 'react';
import Svg, { G, Path, Rect, type SvgProps } from 'react-native-svg';

function BrandOutline({ children, ...props }: SvgProps) {
  return (
    <Svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={props.color ?? 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </Svg>
  );
}

export function BrandHevy(props: SvgProps) {
  return (
    <BrandOutline {...props}>
      <Path d="M9 8V5a2 2 0 0 0-2.3-2L4 3.6a2 2 0 0 0-1.5 1.9v13a2 2 0 0 0 1.5 1.9l2.7.6A2 2 0 0 0 9 19v-2c0-3 1.5-4 3-5s3-2 3-5V5a2 2 0 0 1 2.3-2l2.7.6a2 2 0 0 1 1.5 1.9v13a2 2 0 0 1-1.5 1.9l-2.7.6a2 2 0 0 1-2.3-2v-3" />
    </BrandOutline>
  );
}

export function BrandStrong(props: SvgProps) {
  return (
    <BrandOutline {...props}>
      <Rect x={4} y={5} width={4} height={14} rx={1} />
      <Rect x={16} y={5} width={4} height={14} rx={1} />
      <Path d="M1 12h3m4 0h8m4 0h3" />
    </BrandOutline>
  );
}

export function BrandStrive(props: SvgProps) {
  return (
    <BrandOutline {...props}>
      <Rect x={3} y={8} width={3} height={8} rx={1} />
      <Rect x={8} y={4} width={4} height={16} rx={1} />
      <Rect x={14} y={4} width={4} height={16} rx={1} />
      <Path d="M1 12h2m15 0h5" />
    </BrandOutline>
  );
}

export function BrandFitNotes(props: SvgProps) {
  return (
    <BrandOutline {...props}>
      <Path d="M10 21H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5M6 2v3m10-3v3M2 8h18M6 12h1m4 0h1m-6 4h1" />
      <G transform="rotate(-40 16.5 17)">
        <Rect x={11} y={14} width={3} height={6} rx={0.7} />
        <Rect x={19} y={14} width={3} height={6} rx={0.7} />
        <Path d="M10 17h1m3 0h5m3 0h1" />
      </G>
    </BrandOutline>
  );
}

export function BrandFitNotesIos(props: SvgProps) {
  return (
    <BrandOutline {...props}>
      <Path d="M7 3h14l-3 10H4L7 3Zm-4 14h14l1-4M2 21h14l1-4M9 6h8m-8 2h6m-6 2h4" />
    </BrandOutline>
  );
}
