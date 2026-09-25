import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { useForgeTheme } from '../../theme/ThemeProvider';
import type { MuscleGroup } from '../../domain/dashboard/widgetMetrics';

/** #rrggbb → rgba() so a heat step blends over the figure. */
function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const int = parseInt(h, 16);
  if (Number.isNaN(int) || h.length !== 6) return hex;
  const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type Shape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rot?: number; group: MuscleGroup }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number; group: MuscleGroup }
  | { kind: 'path'; d: string; group: MuscleGroup };

// Figures are drawn on a 200 × 460 canvas, centred on x = 100. Side muscles are
// authored once on the left and mirrored to the right; central muscles are drawn
// on the midline. Shapes are stylised but anatomically placed and separated.
const FRONT_SIDE: Shape[] = [
  { kind: 'ellipse', cx: 82, cy: 74, rx: 13, ry: 7, group: 'Back' }, // upper trap
  { kind: 'ellipse', cx: 54, cy: 94, rx: 15, ry: 14, group: 'Shoulders' }, // front delt
  { kind: 'ellipse', cx: 82, cy: 113, rx: 18, ry: 15, group: 'Chest' }, // pec
  { kind: 'ellipse', cx: 49, cy: 142, rx: 11, ry: 26, group: 'Arms' }, // biceps
  { kind: 'ellipse', cx: 43, cy: 214, rx: 9, ry: 34, group: 'Arms' }, // forearm
  { kind: 'ellipse', cx: 82, cy: 180, rx: 7, ry: 22, group: 'Core' }, // oblique
  { kind: 'ellipse', cx: 83, cy: 292, rx: 17, ry: 58, group: 'Legs' }, // quad
  { kind: 'ellipse', cx: 84, cy: 410, rx: 10, ry: 42, group: 'Legs' }, // shin
];
const FRONT_CENTER: Shape[] = [
  { kind: 'rect', x: 88, y: 146, w: 24, h: 60, r: 7, group: 'Core' }, // abs column
];
const BACK_SIDE: Shape[] = [
  { kind: 'ellipse', cx: 54, cy: 94, rx: 15, ry: 14, group: 'Shoulders' }, // rear delt
  { kind: 'ellipse', cx: 78, cy: 142, rx: 16, ry: 30, group: 'Back' }, // lat
  { kind: 'ellipse', cx: 49, cy: 142, rx: 11, ry: 26, group: 'Arms' }, // triceps
  { kind: 'ellipse', cx: 43, cy: 214, rx: 9, ry: 34, group: 'Arms' }, // forearm
  { kind: 'ellipse', cx: 84, cy: 252, rx: 18, ry: 20, group: 'Legs' }, // glute
  { kind: 'ellipse', cx: 83, cy: 320, rx: 16, ry: 48, group: 'Legs' }, // hamstring
  { kind: 'ellipse', cx: 84, cy: 412, rx: 11, ry: 40, group: 'Legs' }, // calf
];
const BACK_CENTER: Shape[] = [
  { kind: 'path', d: 'M100 66 C86 68 74 74 74 86 C74 100 88 108 100 108 Z', group: 'Back' }, // trap (left half)
  { kind: 'rect', x: 86, y: 180, w: 28, h: 26, r: 6, group: 'Back' }, // lower back
];

// A neutral body silhouette assembled from primitives (drawn under the muscles).
function BodyBase({ fill, side }: { fill: string; side: 'front' | 'back' }) {
  return (
    <G fill={fill}>
      <Circle cx={100} cy={34} r={20} />
      <Rect x={90} y={50} width={20} height={16} rx={6} />
      {/* torso */}
      <Path d="M62 74 C54 74 52 78 54 96 L62 150 C64 176 70 196 74 200 L126 200 C130 196 136 176 138 150 L146 96 C148 78 146 74 138 74 Z" />
      {/* pelvis */}
      <Path d="M72 198 L128 198 L124 236 C124 244 112 248 100 248 C88 248 76 244 76 236 Z" />
      {/* arms */}
      <Rect x={38} y={82} width={20} height={92} rx={10} />
      <Rect x={142} y={82} width={20} height={92} rx={10} />
      <Rect x={34} y={176} width={18} height={88} rx={9} />
      <Rect x={148} y={176} width={18} height={88} rx={9} />
      {/* thighs + shins */}
      <Rect x={68} y={240} width={30} height={122} rx={14} />
      <Rect x={102} y={240} width={30} height={122} rx={14} />
      <Rect x={72} y={362} width={24} height={96} rx={11} />
      <Rect x={104} y={362} width={24} height={96} rx={11} />
      {side === 'back' ? null : null}
    </G>
  );
}

function Muscle({ shape, fill }: { shape: Shape; fill: string }) {
  if (shape.kind === 'ellipse') {
    return (
      <Ellipse
        cx={shape.cx}
        cy={shape.cy}
        rx={shape.rx}
        ry={shape.ry}
        fill={fill}
        transform={shape.rot ? `rotate(${shape.rot} ${shape.cx} ${shape.cy})` : undefined}
      />
    );
  }
  if (shape.kind === 'rect') {
    return <Rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r ?? 0} fill={fill} />;
  }
  return <Path d={shape.d} fill={fill} />;
}

/**
 * A stylised front or back figure whose muscles are heat-filled by recent
 * volume per group (0..1). Unworked muscles show a faint tint so the anatomy
 * still reads.
 */
export function MuscleMap({
  heat,
  side,
  color,
  height = 300,
}: {
  heat: Record<MuscleGroup, number>;
  side: 'front' | 'back';
  color: string;
  height?: number;
}) {
  const theme = useForgeTheme();
  const base = theme.surfaceMuted;
  const idle = theme.colorScheme === 'dark' ? hexToRgba('#FFFFFF', 0.06) : hexToRgba('#17191C', 0.06);
  const fillFor = (group: MuscleGroup): string => {
    const h = heat[group] ?? 0;
    return h > 0 ? hexToRgba(color, 0.16 + h * 0.84) : idle;
  };
  const sideShapes = side === 'front' ? FRONT_SIDE : BACK_SIDE;
  const centerShapes = side === 'front' ? FRONT_CENTER : BACK_CENTER;
  const mirrorCenterPath = side === 'back'; // the back trap is authored as a left half
  return (
    <Svg viewBox="0 0 200 460" width="100%" height={height}>
      <BodyBase fill={base} side={side} />
      {/* left side */}
      <G>{sideShapes.map((s, i) => <Muscle key={`l${i}`} shape={s} fill={fillFor(s.group)} />)}</G>
      {/* mirrored right side */}
      <G transform="translate(200 0) scale(-1 1)">
        {sideShapes.map((s, i) => <Muscle key={`r${i}`} shape={s} fill={fillFor(s.group)} />)}
      </G>
      {/* central muscles */}
      {centerShapes.map((s, i) => <Muscle key={`c${i}`} shape={s} fill={fillFor(s.group)} />)}
      {mirrorCenterPath ? (
        <G transform="translate(200 0) scale(-1 1)">
          {centerShapes
            .filter((s) => s.kind === 'path')
            .map((s, i) => <Muscle key={`cm${i}`} shape={s} fill={fillFor(s.group)} />)}
        </G>
      ) : null}
    </Svg>
  );
}
