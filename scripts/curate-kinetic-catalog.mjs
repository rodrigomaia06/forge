import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = new URL('../data/catalog/source/kinetic-exercises-2026-09-15.json', import.meta.url);
const outputPath = new URL('../src/data/catalog/forge_exercise_catalog_v3_flat.json', import.meta.url);
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const catalog = JSON.parse(await readFile(outputPath, 'utf8'));
const bodyweightEquipment = catalog.taxonomies?.equipment?.find((entry) => entry.id === 'none');
if (bodyweightEquipment) bodyweightEquipment.label = 'Bodyweight';
const normalize = (value) => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Source spellings such as "Pullups", "Pull Ups", and "Pull-Up" identify
// the same movement. This key is intentionally only for curation/audit: user
// custom exercises keep their own identity unless explicitly migrated.
const canonicalNameKey = (value) => normalize(value)
  .replace(/\bpullups\b/g, 'pull up')
  .replace(/\bpushups\b/g, 'push up')
  .replace(/\bskull crusher\b/g, 'skullcrusher')
  .replace(/\babs\b/g, 'ab')
  .split(' ')
  .map((word) => {
    if (word === 'ups') return 'up';
    if (/ies$/.test(word) && word.length > 4) return `${word.slice(0, -3)}y`;
    if (/(?:ches|shes|xes|zes|sses)$/.test(word) && word.length > 4) return word.slice(0, -2);
    return word.length > 3 && /[^s]s$/.test(word) ? word.slice(0, -1) : word;
  })
  .join(' ');
const slug = (value) => normalize(value).replace(/ /g, '-');
const existingNames = new Set(catalog.exercises.map((exercise) => canonicalNameKey(exercise.name)));
const equipment = { Bands: 'resistance-band', Barbell: 'barbell', 'Body Only': 'none', Cable: 'cable', Dumbbell: 'dumbbell', 'E-z Curl Bar': 'ez-bar', 'Exercise Ball': 'stability-ball', 'Foam Roll': 'foam-roller', Kettlebells: 'kettlebell', Machine: 'machine', 'Medicine Ball': 'medicine-ball', Other: 'none' };
const muscle = { abdominals: 'abs', abductors: 'abductors', adductors: 'adductors', biceps: 'biceps', calves: 'calves', chest: 'chest', forearms: 'forearms', glutes: 'glutes', hamstrings: 'hamstrings', lats: 'lats', 'lower-back': 'lower-back', 'middle-back': 'upper-back', neck: 'neck', quadriceps: 'quads', shoulders: 'side-delts', traps: 'traps', triceps: 'triceps' };
const categoryFor = (value, category) => {
  if (category === 'cardio') return 'cardio'; if (category === 'stretching') return 'mobility'; if (category === 'olympicWeightlifting') return 'olympic'; if (category === 'plyometrics') return 'plyometrics';
  return ({ chest: 'chest', lats: 'back', 'lower-back': 'back', 'middle-back': 'back', traps: 'back', shoulders: 'shoulders', biceps: 'biceps', triceps: 'triceps', forearms: 'forearms', quadriceps: 'quads', hamstrings: 'hamstrings', glutes: 'glutes', calves: 'calves', abdominals: 'core', abductors: 'glutes', adductors: 'glutes', neck: 'neck' })[value] ?? 'full-body';
};
const workoutTypes = { strength: ['strength'], olympicWeightlifting: ['olympic-weightlifting'], stretching: ['mobility'], cardio: ['cardio'], plyometrics: ['plyometrics'], powerlifting: ['strength'] };
const bodyRegion = (category) => ({ chest: 'upper-body', back: 'upper-body', shoulders: 'upper-body', biceps: 'upper-body', triceps: 'upper-body', forearms: 'upper-body', neck: 'upper-body', quads: 'lower-body', hamstrings: 'lower-body', glutes: 'lower-body', calves: 'lower-body', core: 'core', cardio: 'cardio', mobility: 'full-body', olympic: 'full-body', plyometrics: 'full-body', 'full-body': 'full-body' })[category];
const included = new Set(['strength', 'olympicWeightlifting', 'stretching', 'cardio', 'plyometrics', 'powerlifting']);
const titleCase = (value) => value.split(' ').filter(Boolean).map((word) => ['ez', 'db'].includes(word) ? word.toUpperCase() : word === 'id' ? 'ID' : `${word[0].toUpperCase()}${word.slice(1)}`).join(' ');
// `curl` is a movement, never equipment. Treating it as equipment produced
// families such as "Leg" from "Standing Leg Curl". Keep this list strictly
// to apparatus words so the family derivation remains meaningful.
const equipmentWords = new Set(['barbell', 'dumbbell', 'cable', 'machine', 'kettlebell', 'kettlebells', 'band', 'bands', 'rope', 'pulley', 'sled', 'ball', 'bodyweight', 'body', 'ez', 'bar', 'plate', 'chains', 'chain', 'smith', 'bench', 'leverage', 'towel']);
const setupWords = new Set(['kneeling', 'standing', 'seated', 'lying', 'incline', 'decline', 'flat', 'one', 'two', 'arm', 'alternating', 'single', 'double', 'close', 'wide', 'narrow', 'reverse', 'neutral', 'pronated', 'supinated', 'overhead', 'bent', 'over', 'high', 'low', 'rear', 'front', 'side', 'with', 'the', 'a', 'an', 'on', 'to', 'and', 'behind', 'head', 'position', 'attachment', 'medium', 'grip', 'palms', 'up', 'down', 'in', 'out']);
const familyAliases = new Map([
  ['pec fly', 'Chest Fly'], ['butterfly', 'Chest Fly'], ['tricep extension', 'Triceps Extension'], ['press triceps', 'Triceps Extension'], ['overhead triceps', 'Triceps Extension'], ['triceps overhead extension', 'Triceps Extension'],
  ['seated cable rows', 'Seated Cable Row'], ['cable row', 'Seated Cable Row'], ['dumbbell row', 'Dumbbell Row'], ['barbell row', 'Barbell Row'],
  ['dumbbell fly', 'Dumbbell Chest Fly'], ['dumbbell flyes', 'Dumbbell Chest Fly'], ['leg raises', 'Leg Raise'], ['calf raises', 'Calf Raise'], ['triceps pushdown', 'Triceps Pushdown'], ['triceps pushdown rope', 'Rope Triceps Pushdown'],
  ['pullups', 'Pull-Up'], ['pull up', 'Pull-Up'], ['weighted pull ups', 'Pull-Up'], ['weighted pull up', 'Pull-Up'], ['chin up', 'Pull-Up'],
]);
const sourceNameWords = (name) => normalize(name).split(' ');
const facetForWords = (words) => {
  const pick = (...values) => values.find((value) => words.includes(value));
  const load = pick('weighted', 'assisted', 'bodyweight');
  const grip = pick('pronated', 'supinated', 'neutral', 'reverse');
  const stance = pick('wide', 'narrow', 'close');
  const setup = pick('kneeling', 'standing', 'seated', 'lying', 'incline', 'decline', 'overhead', 'bent');
  const laterality = pick('unilateral', 'alternating', 'single');
  const known = new Set([load, grip, stance, setup, laterality].filter(Boolean));
  const other = words.filter((word) => !known.has(word) && !equipmentWords.has(word) && !['with', 'the', 'a', 'an', 'and', 'on', 'to'].includes(word));
  return { ...(load ? { load: titleCase(load) } : {}), ...(grip ? { grip: titleCase(grip) } : {}), ...(stance ? { stance: titleCase(stance) } : {}), ...(setup ? { setup: titleCase(setup) } : {}), ...(laterality ? { laterality: titleCase(laterality) } : {}), ...(other.length ? { other: [titleCase(other.join(' '))] } : {}) };
};
const displayVariation = (facets, fallback) => [facets.load, facets.stance, facets.grip, facets.setup, facets.laterality, ...(facets.other ?? [])].filter(Boolean).join(' · ') || fallback;
const curatedStrengthSourceNames = new Set([
  // Kinetic is a provenance source, not a wholesale Strength catalogue. The
  // Forge baseline is the compact, reviewed default; retain only explicitly
  // reviewed gaps here. Additions require a concrete movement need.
  'kneeling cable triceps extension',
]);
function isCompactStrengthSource(exercise) {
  return curatedStrengthSourceNames.has(normalize(exercise.name));
}
function movementAndVariation(name, primaryEquipment) {
  const words = sourceNameWords(name);
  const retained = words.filter((word) => !equipmentWords.has(word) && !setupWords.has(word));
  const compactRetained = retained.filter((word, index) => word !== retained[index - 1]);
  let movement = compactRetained.join(' ').replace(/flyes/g, 'fly').replace(/curls/g, 'curl').replace(/raises/g, 'raise').replace(/extensions/g, 'extension').replace(/squats/g, 'squat').replace(/rows/g, 'row').replace(/presses/g, 'press').trim();
  if (/tricep/.test(movement) && /(extension|overhead)/.test(movement)) movement = 'triceps extension';
  if (/tricep/.test(movement) && /pushdown/.test(movement)) movement = 'triceps pushdown';
  movement = familyAliases.get(movement) ?? titleCase(movement || normalize(name));
  const movementWords = new Set(normalize(movement).split(' '));
  const descriptors = words.filter((word) => !movementWords.has(word) && !equipmentWords.has(word) && !['with', 'the', 'a', 'an', 'and', 'on', 'to'].includes(word));
  const variation = titleCase(descriptors.join(' ').replace(/flyes/g, 'fly')) || undefined;
  return { group: movement, variation: variation === 'Standard' ? undefined : variation, familyId: slug(movement), primaryEquipment };
}
// Rebuild imported records on every run so revisions to family curation are deterministic.
catalog.exercises = catalog.exercises.filter((exercise) => !exercise.id.startsWith('kinetic-'));
delete catalog.legacyIdMap['kneeling-triceps-extension-with-cable-2'];
// Curated compound pull-up variants are exact, selectable movements—not
// theoretical combinations created by the picker. The facets let the UI keep
// their compact label stable and distinguish them from their base movement.
const existingById = new Map(catalog.exercises.map((exercise) => [exercise.id, exercise]));
const pullUpFacets = {
  'pull-up': { grip: 'Pronated' },
  'chin-up': { grip: 'Supinated' },
  'neutral-grip-pull-up': { grip: 'Neutral' },
  'wide-grip-pull-up': { stance: 'Wide', grip: 'Pronated' },
  'weighted-pull-up': { load: 'Weighted', grip: 'Pronated' },
  'weighted-chin-up': { load: 'Weighted', grip: 'Supinated' },
};
for (const [id, facets] of Object.entries(pullUpFacets)) {
  const exercise = existingById.get(id);
  if (!exercise) continue;
  exercise.variationFacets = facets;
  exercise.variation = displayVariation(facets, exercise.variation);
  exercise.searchTerms = [...new Set([...(exercise.searchTerms ?? []), ...Object.values(facets)])];
}
if (!existingById.has('weighted-wide-pronated-pull-up')) {
  const weightedPullUp = existingById.get('weighted-pull-up');
  if (weightedPullUp) {
    catalog.exercises.push({
      ...weightedPullUp,
      id: 'weighted-wide-pronated-pull-up',
      name: 'Weighted Wide Pronated Pull-Up',
      variation: 'Weighted · Wide · Pronated',
      variationFacets: { load: 'Weighted', stance: 'Wide', grip: 'Pronated' },
      aliases: [...new Set([...(weightedPullUp.aliases ?? []), 'weighted wide pullup', 'wide weighted pullup'])],
      searchTerms: [...new Set([...(weightedPullUp.searchTerms ?? []), 'Weighted Wide Pronated Pull-Up', 'Weighted', 'Wide', 'Pronated'])],
    });
  }
}
existingNames.clear();
for (const exercise of catalog.exercises) existingNames.add(canonicalNameKey(exercise.name));
const pickerKeys = new Set(catalog.exercises.map((exercise) => `${normalize(exercise.group)}::${exercise.primaryEquipment}::${normalize(exercise.variation || exercise.name)}`));
for (const exercise of source) {
  if (!included.has(exercise.category) || existingNames.has(canonicalNameKey(exercise.name))) continue;
  if (workoutTypes[exercise.category]?.includes('strength') && !isCompactStrengthSource(exercise)) continue;
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
  const identity = movementAndVariation(exercise.name, primaryEquipment);
  const variationFacets = facetForWords(sourceNameWords(exercise.name).filter((word) => !normalize(identity.group).split(' ').includes(word)));
  let variation = normalize(identity.variation) === normalize(exercise.name) ? undefined : displayVariation(variationFacets, identity.variation);
  let pickerKey = `${normalize(identity.group)}::${primaryEquipment}::${normalize(variation || exercise.name)}`;
  if (pickerKeys.has(pickerKey)) {
    variation = titleCase(sourceNameWords(exercise.name).filter((word) => !equipmentWords.has(word)).join(' '));
    pickerKey = `${normalize(identity.group)}::${primaryEquipment}::${normalize(variation)}`;
  }
  if (pickerKeys.has(pickerKey)) continue;
  pickerKeys.add(pickerKey);
  catalog.exercises.push({ id, name: exercise.name.trim(), familyId: identity.familyId, group: identity.group, variation, variationFacets: Object.keys(variationFacets).length ? variationFacets : undefined, category, bodyRegion: bodyRegion(category), equipment: exerciseEquipment.length ? exerciseEquipment : ['none'], primaryEquipment, primaryMuscle, secondaryMuscles, workoutTypeIds: workoutTypes[exercise.category], trackingType, movementPattern, mechanics, laterality: 'bilateral', aliases: [identity.group], searchTerms: [exercise.name.trim(), identity.group, ...(variation ? [variation] : []), ...Object.values(variationFacets).flatMap((value) => Array.isArray(value) ? value : value ? [value] : []), ...exercise.equipment.map((item) => item.name), ...exercise.muscleGroups.map((item) => item.name)] });
  existingNames.add(canonicalNameKey(exercise.name));
}
catalog.version = 5;
catalog.schemaVersion = '5.0.0-flat';
catalog.description = 'Forge flattened runtime exercise catalog. Compact strength curation from Forge v3 and the Kinetic Exercises Database source snapshot; do not hand-edit.';
catalog.generatedFrom = 'forge_exercise_catalog_v3.json + data/catalog/source/kinetic-exercises-2026-09-15.json';
catalog.legacyIdMap = {
  ...catalog.legacyIdMap,
  'kneeling-triceps-extension-with-cable-2': 'kinetic-kneeling-cable-triceps-extension',
  'kinetic-abs-wheel-rollout': 'ab-wheel-rollout',
  'kinetic-bench-dips': 'bench-dip',
  'kinetic-concentration-curls': 'concentration-curl',
  'kinetic-dumbbell-step-ups': 'dumbbell-step-up',
  'kinetic-handstand-push-ups': 'handstand-push-up',
  'kinetic-leg-extensions': 'leg-extension',
  'kinetic-lying-leg-curls': 'lying-leg-curl',
  'kinetic-machine-preacher-curls': 'preacher-curl-machine',
  'kinetic-mountain-climbers': 'mountain-climber',
  'kinetic-pullups': 'pull-up',
  'kinetic-rack-pulls': 'rack-pull',
  'kinetic-seated-cable-rows': 'seated-cable-row',
  'kinetic-weighted-pull-ups': 'weighted-pull-up',
  'kinetic-squats-with-bands': 'kinetic-squat-with-bands',
};
// A compact release may intentionally omit a formerly bundled source item.
// Do not leave a legacy mapping pointing at a non-existent target: unknown
// historical/custom exercises are safer untouched than guessed at runtime.
const releaseIds = new Set(catalog.exercises.map((exercise) => exercise.id));
catalog.legacyIdMap = Object.fromEntries(
  Object.entries(catalog.legacyIdMap).filter(([, current]) => releaseIds.has(current)),
);
catalog.counts.exercises = catalog.exercises.length;
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
