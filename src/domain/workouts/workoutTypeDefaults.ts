/**
 * Forge's original six type swatches remain the canonical defaults. Extra
 * built-ins extend that set without reusing a swatch, so every visible type
 * remains distinguishable in markers, charts, and calendars.
 */
export const workoutTypeColorChoices = [
  { name: 'Blue', value: '#7C8CF8' },
  { name: 'Green', value: '#6BD48F' },
  { name: 'Red', value: '#F27D7D' },
  { name: 'Orange', value: '#F4A261' },
  { name: 'Purple', value: '#B78AF0' },
  { name: 'Gray', value: '#9CA3AF' },
] as const;

export const builtInWorkoutTypeColors: Record<string, string> = {
  strength: '#7C8CF8',
  calisthenics: '#2FA7A0',
  cardio: '#F4A261',
  mobility: '#B78AF0',
  functional: '#A16CD1',
  'olympic-weightlifting': '#4E78C8',
  plyometrics: '#D17A3D',
  'court-sport': '#6BD48F',
  'field-sport': '#4FA367',
  'martial-arts': '#F27D7D',
};

/** Colors shipped by the first React Native Forge defaults. */
export const supersededBuiltInWorkoutTypeColors: Record<string, string> = {
  strength: '#687CF2',
  calisthenics: '#4D9C8A',
  cardio: '#EF715F',
  mobility: '#62C98A',
  functional: '#B27BDA',
  'olympic-weightlifting': '#5478D8',
  plyometrics: '#D78543',
  'court-sport': '#E3A346',
  'field-sport': '#4C9B5D',
  'martial-arts': '#C56BE6',
};

/**
 * A custom type starts with an original Forge swatch, but it is never
 * constrained by the colours already used by built-ins or other custom types.
 */
export const defaultCustomWorkoutTypeColor = workoutTypeColorChoices[0].value;
