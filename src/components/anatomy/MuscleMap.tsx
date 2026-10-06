import React, { useState } from 'react';
import { View } from 'react-native';
import { muscleMapNeutrals } from '../../theme/tokens';
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';

import { useForgeTheme } from '../../theme/ThemeProvider';

// Forge muscle slugs (normalised catalogue muscles) → the highlighter's own
// slugs, so the figure lights the *specific* muscle worked (abductors ≠ quads,
// front/side/rear delts all read as the deltoid, etc.).
const FORGE_TO_HL: Record<string, Slug> = {
  chest: 'chest',
  lats: 'upper-back',
  upperback: 'upper-back',
  traps: 'trapezius',
  lowerback: 'lower-back',
  quads: 'quadriceps',
  hamstrings: 'hamstring',
  glutes: 'gluteal',
  calves: 'calves',
  adductors: 'adductors',
  abductors: 'gluteal',
  hipflexors: 'quadriceps',
  tibialis: 'tibialis',
  frontdelts: 'deltoids',
  sidedelts: 'deltoids',
  reardelts: 'deltoids',
  neck: 'neck',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearm',
  abs: 'abs',
  obliques: 'obliques',
};

const RAMP_STEPS = 5;

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
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

/** The figure and legend share the same low-to-high, muted-to-saturated ramp. */
export function muscleHeatColors(base: string, neutral: string): string[] {
  return [0.72, 0.5, 0.28, 0.12, 0].map((amount) => mix(base, neutral, amount));
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
  const colors = muscleHeatColors(color, theme.surfaceMuted);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  const figureHeight = availableWidth === null ? height : Math.min(height, availableWidth * 2);
  const neutrals = muscleMapNeutrals[theme.colorScheme];
  // Collapse Forge slugs onto highlighter slugs, keeping the hottest contributor.
  const hlHeat = new Map<Slug, number>();
  for (const [forgeSlug, h] of Object.entries(heat)) {
    if (h <= 0) continue;
    const hl = FORGE_TO_HL[forgeSlug];
    if (!hl) continue;
    hlHeat.set(hl, Math.max(hlHeat.get(hl) ?? 0, h));
  }
  // Bundled paths have their own fixed colours, which take precedence over
  // defaultFill. Supply per-part neutrals so untrained anatomy follows Forge.
  const neutralSlugs: Slug[] = [
    ...new Set(Object.values(FORGE_TO_HL)),
    'ankles',
    'feet',
    'hands',
    'knees',
  ];
  const data: ExtendedBodyPart[] = neutralSlugs.map((slug) => ({
    slug,
    color: neutrals.fill,
  }));
  for (const [slug, h] of hlHeat) {
    data.push({ slug, intensity: Math.min(RAMP_STEPS, Math.max(1, Math.ceil(h * RAMP_STEPS))) });
  }
  return (
    <View
      style={{ width: '100%', alignItems: 'center' }}
      onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
    >
      <Body
        data={data}
        side={side}
        gender={gender}
        scale={figureHeight / 400}
        colors={colors}
        border={neutrals.border}
        defaultFill={neutrals.fill}
      />
    </View>
  );
}
