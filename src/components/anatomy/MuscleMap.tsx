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
function heatRamp(base: string): string[] {
  return [
    mix(base, '#FFFFFF', 0.6),
    mix(base, '#FFFFFF', 0.32),
    base,
    mix(base, '#000000', 0.14),
    mix(base, '#000000', 0.3),
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
}: {
  /** Per-muscle intensity 0..1 keyed by Forge muscle slug (e.g. `frontdelts`). */
  heat: Record<string, number>;
  side: 'front' | 'back';
  color: string;
  height?: number;
}) {
  const theme = useForgeTheme();
  const colors = heatRamp(color);
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
      gender="male"
      scale={height / 400}
      colors={colors}
      border={theme.colorScheme === 'dark' ? theme.surfaceInset : theme.border}
      defaultFill={theme.surfaceMuted}
    />
  );
}
