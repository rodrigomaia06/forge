import React from 'react';
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';

import { useForgeTheme } from '../../theme/ThemeProvider';

// Forge muscle slugs (normalised catalogue muscles) → the highlighter's own
// slugs, so the figure lights the *specific* muscle worked (abductors ≠ quads,
// front/side/rear delts all read as the deltoid, etc.).
const FORGE_TO_HL: Record<string, Slug> = {
  chest: 'chest',
  lats: 'upper-back', upperback: 'upper-back', traps: 'trapezius', lowerback: 'lower-back',
  quads: 'quadriceps', hamstrings: 'hamstring', glutes: 'gluteal', calves: 'calves',
  adductors: 'adductors', abductors: 'gluteal', hipflexors: 'quadriceps', tibialis: 'tibialis',
  frontdelts: 'deltoids', sidedelts: 'deltoids', reardelts: 'deltoids', neck: 'neck',
  biceps: 'biceps', triceps: 'triceps', forearms: 'forearm',
  abs: 'abs', obliques: 'obliques',
};

const RAMP_STEPS = 5;

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const int = parseInt(h, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('')}`;
}
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** A light→hot 5-step ramp built from a base accent, for intensity 1..5. */
function heatRamp(base: string, dark: boolean): string[] {
  if (dark) {
    return [
      mix(base, '#FFFFFF', 0.6),
      mix(base, '#FFFFFF', 0.32),
      base,
      mix(base, '#000000', 0.14),
      mix(base, '#000000', 0.3),
    ];
  }
  // Light: the low end must not fade into the white card and the hot end must not go
  // muddy-dark on it — keep every step saturated and readable over #F8F8F6.
  return [
    mix(base, '#FFFFFF', 0.45),
    mix(base, '#FFFFFF', 0.22),
    base,
    mix(base, '#000000', 0.08),
    mix(base, '#000000', 0.18),
  ];
}

/**
 * A front or back anatomical figure whose muscles are heat-filled by recent
 * volume per group (0..1), using react-native-body-highlighter's real muscle
 * paths. Sizes to `height` (the figure is 200×400 at scale 1).
 */
export function MuscleMap({
  heat,
  side,
  color,
  height = 300,
  gender = 'male',
}: {
  /** Per-muscle intensity 0..1 keyed by Forge muscle slug (e.g. `frontdelts`). */
  heat: Record<string, number>;
  side: 'front' | 'back';
  color: string;
  height?: number;
  gender?: 'male' | 'female';
}) {
  const theme = useForgeTheme();
  const dark = theme.colorScheme === 'dark';
  const colors = heatRamp(color, dark);
  // Collapse Forge slugs onto highlighter slugs, keeping the hottest contributor.
  const hlHeat = new Map<Slug, number>();
  for (const [forgeSlug, h] of Object.entries(heat)) {
    if (h <= 0) continue;
    const hl = FORGE_TO_HL[forgeSlug];
    if (!hl) continue;
    hlHeat.set(hl, Math.max(hlHeat.get(hl) ?? 0, h));
  }
  const data: ExtendedBodyPart[] = [];
  for (const [slug, h] of hlHeat) {
    data.push({ slug, intensity: Math.min(RAMP_STEPS, Math.max(1, Math.ceil(h * RAMP_STEPS))) });
  }
  return (
    <Body
      data={data}
      side={side}
      gender={gender}
      scale={height / 400}
      colors={colors}
      // The theme greys are near-white on the light card, which made the untrained body
      // read as a featureless white blob; use clearly visible neutral greys in Light so
      // the anatomy reads. Dark keeps its subtle tonal muscles.
      border={dark ? theme.surfaceInset : '#B4B8B4'}
      defaultFill={dark ? theme.surfaceMuted : '#D4D7D2'}
    />
  );
}
