import { readFile } from 'node:fs/promises';

const path = new URL('../src/data/catalog/forge_exercise_catalog_v3_flat.json', import.meta.url);
const catalog = JSON.parse(await readFile(path, 'utf8'));
const controlled = ['load', 'grip', 'stance', 'setup', 'laterality'];
const families = new Map();
const ids = new Set();
const canonicalStrengthNames = new Map();
const trackingTypes = new Set([
  'weight-reps',
  'bodyweight-reps',
  'added-weight-reps',
  'assisted-bodyweight',
  'reps-only',
  'duration',
  'duration-weight',
  'distance-duration',
  'weight-distance',
  'weighted-bodyweight',
]);
const sourceNoise = /(?:exercise ball|balance trainer|bosu|anti.gravity|rocky|pirate ships|otis.up|cocoons|spell caster|body.up|london bridges|judo flip|car drivers?)/i;
const canonicalStrengthKey = (value) => String(value)
  .toLowerCase()
  .replace(/\bpushups\b/g, 'push up')
  .replace(/\bskull crusher\b/g, 'skullcrusher')
  .replace(/[^a-z0-9]/g, '')
  .replace(/s$/, '');
const bodyweightEquipment = catalog.taxonomies?.equipment?.find((entry) => entry.id === 'none');
if (bodyweightEquipment?.label !== 'Bodyweight') {
  throw new Error('The no-equipment taxonomy must present as Bodyweight.');
}
for (const exercise of catalog.exercises) {
  if (ids.has(exercise.id)) throw new Error(`Duplicate catalogue id: ${exercise.id}`);
  ids.add(exercise.id);
  for (const field of ['id', 'name', 'familyId', 'group', 'category', 'primaryEquipment', 'trackingType']) {
    if (typeof exercise[field] !== 'string' || !exercise[field].trim()) {
      throw new Error(`Incomplete catalogue record ${exercise.id}: ${field}`);
    }
  }
  if (!Array.isArray(exercise.workoutTypeIds) || !exercise.workoutTypeIds.length) {
    throw new Error(`Missing workout type on ${exercise.id}`);
  }
  if (!trackingTypes.has(exercise.trackingType)) {
    throw new Error(`Unknown tracking type on ${exercise.id}: ${exercise.trackingType}`);
  }
  if (/\b(\w+) \1\b/i.test(exercise.group)) {
    throw new Error(`Repeated family word on ${exercise.id}: ${exercise.group}`);
  }
  if (exercise.workoutTypeIds.includes('strength')) {
    const nameKey = canonicalStrengthKey(exercise.name);
    const prior = canonicalStrengthNames.get(nameKey);
    if (prior) throw new Error(`Duplicate Strength movement: ${prior.name} / ${exercise.name}`);
    canonicalStrengthNames.set(nameKey, exercise);
    if (exercise.id.startsWith('kinetic-') && sourceNoise.test(exercise.name)) {
      throw new Error(`Noisy Kinetic Strength record retained: ${exercise.name}`);
    }
  }
  const key = `${exercise.category}\u0001${exercise.group}`;
  families.set(key, [...(families.get(key) ?? []), exercise]);
}
let classified = 0;
for (const [key, exercises] of families) {
  const represented = exercises.filter((exercise) => {
    const facets = exercise.variationFacets ?? {};
    return exercise.trackingType === 'assisted-bodyweight' || facets.other?.length || controlled.some((axis) => typeof facets[axis] === 'string') || !Object.keys(facets).length;
  });
  if (represented.length !== exercises.length) throw new Error(`Unclassified variation in ${key}`);
  classified += represented.length;
}
if (classified !== catalog.exercises.length) throw new Error('Catalogue exercise count changed during variation audit.');
console.log(`Variation audit passed: ${classified} exercises across ${families.size} movement families; ${canonicalStrengthNames.size} distinct Strength movements.`);
