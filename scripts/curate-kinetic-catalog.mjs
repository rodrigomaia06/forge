import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = new URL('../data/catalog/source/kinetic-exercises-2026-09-15.json', import.meta.url);
const outputPath = new URL('../src/data/catalog/forge_exercise_catalog_v3_flat.json', import.meta.url);
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const catalog = JSON.parse(await readFile(outputPath, 'utf8'));
const normalize = (value) => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (value) => normalize(value).replace(/ /g, '-');
const existingNames = new Set(catalog.exercises.map((exercise) => normalize(exercise.name)));
const equipment = { Bands: 'resistance-band', Barbell: 'barbell', 'Body Only': 'none', Cable: 'cable', Dumbbell: 'dumbbell', 'E-z Curl Bar': 'ez-bar', 'Exercise Ball': 'stability-ball', 'Foam Roll': 'foam-roller', Kettlebells: 'kettlebell', Machine: 'machine', 'Medicine Ball': 'medicine-ball', Other: 'none' };
const muscle = { abdominals: 'abs', abductors: 'abductors', adductors: 'adductors', biceps: 'biceps', calves: 'calves', chest: 'chest', forearms: 'forearms', glutes: 'glutes', hamstrings: 'hamstrings', lats: 'lats', 'lower-back': 'lower-back', 'middle-back': 'upper-back', neck: 'neck', quadriceps: 'quads', shoulders: 'side-delts', traps: 'traps', triceps: 'triceps' };
const categoryFor = (value, category) => {
  if (category === 'cardio') return 'cardio'; if (category === 'stretching') return 'mobility'; if (category === 'olympicWeightlifting') return 'olympic'; if (category === 'plyometrics') return 'plyometrics';
  return ({ chest: 'chest', lats: 'back', 'lower-back': 'back', 'middle-back': 'back', traps: 'back', shoulders: 'shoulders', biceps: 'biceps', triceps: 'triceps', forearms: 'forearms', quadriceps: 'quads', hamstrings: 'hamstrings', glutes: 'glutes', calves: 'calves', abdominals: 'core', abductors: 'glutes', adductors: 'glutes', neck: 'neck' })[value] ?? 'full-body';
};
const workoutTypes = { strength: ['strength'], olympicWeightlifting: ['olympic-weightlifting'], stretching: ['mobility'], cardio: ['cardio'], plyometrics: ['plyometrics'], powerlifting: ['strength'] };
const bodyRegion = (category) => ({ chest: 'upper-body', back: 'upper-body', shoulders: 'upper-body', biceps: 'upper-body', triceps: 'upper-body', forearms: 'upper-body', neck: 'upper-body', quads: 'lower-body', hamstrings: 'lower-body', glutes: 'lower-body', calves: 'lower-body', core: 'core', cardio: 'cardio', mobility: 'full-body', olympic: 'full-body', plyometrics: 'full-body', 'full-body': 'full-body' })[category];
const included = new Set(['strength', 'olympicWeightlifting', 'stretching', 'cardio', 'plyometrics', 'powerlifting']);
for (const exercise of source) {
  if (!included.has(exercise.category) || existingNames.has(normalize(exercise.name))) continue;
  const primarySource = exercise.muscleGroups.find((item) => item.type === 'primary')?.slug ?? exercise.muscleGroups[0]?.slug ?? 'abdominals';
  const category = categoryFor(primarySource, exercise.category);
  const exerciseEquipment = [...new Set(exercise.equipment.map((item) => equipment[item.name]).filter(Boolean))];
  const primaryEquipment = exerciseEquipment[0] ?? 'none';
  const trackingType = exercise.type === 'time' ? 'duration' : exercise.type === 'distance' ? 'distance-duration' : primaryEquipment === 'none' ? 'bodyweight-reps' : 'weight-reps';
  const primaryMuscle = muscle[primarySource] ?? 'full-body';
  const secondaryMuscles = [...new Set(exercise.muscleGroups.filter((item) => item.slug !== primarySource).map((item) => muscle[item.slug]).filter(Boolean))];
  const id = `kinetic-${slug(exercise.name)}`;
  const movementPattern = exercise.category === 'stretching' ? 'stretch' : exercise.category === 'cardio' ? 'locomotion' : exercise.category === 'plyometrics' ? 'jump' : exercise.category === 'olympicWeightlifting' ? 'olympic' : exercise.forceType === 'pull' ? 'horizontal-pull' : exercise.forceType === 'push' ? 'horizontal-push' : 'conditioning';
  const mechanics = exercise.category === 'cardio' ? 'cardio' : exercise.category === 'stretching' ? 'mobility' : exercise.mechanics === 'compound' || exercise.mechanics === 'isolation' ? exercise.mechanics : 'isometric';
  catalog.exercises.push({ id, name: exercise.name.trim(), familyId: slug(exercise.name), group: exercise.name.trim(), category, bodyRegion: bodyRegion(category), equipment: exerciseEquipment.length ? exerciseEquipment : ['none'], primaryEquipment, primaryMuscle, secondaryMuscles, workoutTypeIds: workoutTypes[exercise.category], trackingType, movementPattern, mechanics, laterality: 'bilateral', aliases: [], searchTerms: [exercise.name.trim(), ...exercise.equipment.map((item) => item.name), ...exercise.muscleGroups.map((item) => item.name)] });
  existingNames.add(normalize(exercise.name));
}
catalog.version = 4;
catalog.schemaVersion = '4.0.0-flat';
catalog.description = 'Forge flattened runtime exercise catalog. Curated from Forge v3 and the Kinetic Exercises Database source snapshot; do not hand-edit.';
catalog.generatedFrom = 'forge_exercise_catalog_v3.json + data/catalog/source/kinetic-exercises-2026-09-15.json';
catalog.legacyIdMap = { ...catalog.legacyIdMap, 'kneeling-triceps-extension-with-cable-2': 'kinetic-kneeling-cable-triceps-extension' };
catalog.counts.exercises = catalog.exercises.length;
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
