import { readFile, writeFile } from 'node:fs/promises';
import {
  applyReviewedClassification,
  dynamicMobilityIds,
  staticMobilityIds,
} from './catalog-classification.mjs';

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const path =
  option('--catalog') ??
  new URL('../src/data/catalog/forge_exercise_catalog_v3_flat.json', import.meta.url);
const catalog = JSON.parse(await readFile(path, 'utf8'));
const issues = [];
const taxonomy = Object.fromEntries(
  Object.entries(catalog.taxonomies).map(([key, values]) => [
    key,
    new Set(values.map((value) => (typeof value === 'string' ? value : value.id))),
  ]),
);
const categoryTypes = {
  cardio: 'cardio',
  mobility: 'mobility',
  plyometrics: 'plyometrics',
  olympic: 'olympic-weightlifting',
  carries: 'functional',
  'court-sport': 'court-sport',
  'field-sport': 'field-sport',
  'martial-arts': 'martial-arts',
};
const ids = new Set();
for (const exercise of catalog.exercises) {
  const fail = (message) => issues.push(`${exercise.id}: ${message}`);
  if (ids.has(exercise.id)) fail('duplicate identity');
  ids.add(exercise.id);
  for (const [field, key] of Object.entries({
    category: 'categories',
    trackingType: 'trackingTypes',
    primaryEquipment: 'equipment',
    movementPattern: 'movementPatterns',
    mechanics: 'mechanics',
    bodyRegion: 'bodyRegions',
  })) {
    if (!taxonomy[key].has(exercise[field])) fail(`unknown ${field}: ${exercise[field]}`);
  }
  for (const [field, key] of [
    ['workoutTypeIds', 'workoutTypes'],
    ['equipment', 'equipment'],
  ]) {
    if (!Array.isArray(exercise[field]) || !exercise[field].length) fail(`missing ${field}`);
    else
      for (const value of exercise[field])
        if (!taxonomy[key].has(value)) fail(`unknown ${field}: ${value}`);
  }
  if (!exercise.equipment.includes(exercise.primaryEquipment))
    fail('primary apparatus absent from equipment');
  const expectedType = categoryTypes[exercise.category];
  if (expectedType && !exercise.workoutTypeIds.includes(expectedType))
    fail(`category requires ${expectedType}`);
  if (
    exercise.category === 'cardio' &&
    !['duration', 'distance-duration', 'reps-only'].includes(exercise.trackingType)
  )
    fail('cardio uses strength measurements');
  if (exercise.category === 'mobility') {
    if (!['duration', 'reps-only'].includes(exercise.trackingType))
      fail('mobility uses strength measurements');
    if (
      exercise.id.startsWith('kinetic-') &&
      !staticMobilityIds.has(exercise.id) &&
      !dynamicMobilityIds.has(exercise.id)
    )
      fail('imported mobility requires instruction review');
  }
  if (
    exercise.category === 'plyometrics' &&
    exercise.primaryEquipment === 'none' &&
    exercise.trackingType !== 'reps-only'
  )
    fail('unloaded explosive movement requires reps');
  if (
    /swimming|cycling|running|treadmill|stationary-bike/.test(exercise.id) &&
    !exercise.workoutTypeIds.includes('cardio')
  )
    fail('endurance movement missing Cardio');
  const reviewed = applyReviewedClassification(exercise);
  for (const key of Object.keys(reviewed)) {
    if (JSON.stringify(reviewed[key]) !== JSON.stringify(exercise[key]))
      fail(`reviewed ${key} mapping changed`);
  }
}
if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Classification audit passed: ${ids.size} exercises; category, workout type, measurements, and apparatus checked.`,
  );
  if (option('--report')) {
    const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ['ID', 'Exercise', 'Category', 'Workout types', 'Tracking', 'Equipment'],
      ...catalog.exercises.map((exercise) => [
        exercise.id,
        exercise.name,
        exercise.category,
        exercise.workoutTypeIds.join('; '),
        exercise.trackingType,
        exercise.equipment.join('; '),
      ]),
    ];
    await writeFile(
      option('--report'),
      rows.map((row) => row.map(quote).join(',')).join('\n') + '\n',
    );
  }
}
