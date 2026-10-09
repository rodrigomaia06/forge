import type { ExerciseCatalogItem } from '../exerciseCatalog';

const words: Record<string, string> = {
  dumbbells: 'dumbbell',
  db: 'dumbbell',
  barbells: 'barbell',
  bb: 'barbell',
  kettlebells: 'kettlebell',
  kb: 'kettlebell',
  biceps: 'bicep',
  triceps: 'tricep',
  curls: 'curl',
  raises: 'raise',
  squats: 'squat',
  extensions: 'extension',
  flyes: 'fly',
  flies: 'fly',
  flys: 'fly',
  pullups: 'pull up',
  pullup: 'pull up',
  pushups: 'push up',
  pushup: 'push up',
  cables: 'cable',
  skullcrusher: 'skull crusher',
  skullcrushers: 'skull crusher',
  pulldowns: 'pulldown',
  deadlifts: 'deadlift',
  rows: 'row',
  rdl: 'romanian deadlift',
  ohp: 'overhead press',
  bss: 'bulgarian split squat',
};
function normalized(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => (Object.hasOwn(words, word) ? words[word] : word))
    .join(' ')
    .replace(/\bone arm\b/g, 'single arm')
    .replace(/\bbicep curl\b/g, 'curl')
    .replace(/\brear delt fly\b/g, 'reverse fly')
    .replace(/\bab wheel(?: rollout)?\b/g, 'ab wheel rollout');
}
const key = (name: string) => {
  let tokens = normalized(name).split(/\s+/).filter(Boolean);
  if (tokens.includes('incline') && tokens.includes('press'))
    tokens = tokens.filter((token) => token !== 'bench');
  return tokens.sort().join(' ');
};
type Index = Map<string, ExerciseCatalogItem | null>;
function add(index: Index, name: string, exercise: ExerciseCatalogItem) {
  const identity = key(name);
  if (!identity) return;
  if (!index.has(identity)) index.set(identity, exercise);
  else if (index.get(identity)?.id !== exercise.id) index.set(identity, null);
}

/** Full movement tokens must agree; ordering and explicit equipment notation may differ. */
export function importExerciseMatcher(catalog: ExerciseCatalogItem[]) {
  const names: Index = new Map(),
    aliases: Index = new Map();
  for (const exercise of catalog) {
    add(names, exercise.name, exercise);
    const equipment = exercise.equipmentIds ?? [];
    for (const item of equipment) {
      if (
        !['barbell', 'dumbbell', 'cable', 'machine', 'kettlebell', 'smith-machine'].includes(item)
      )
        continue;
      const equipmentWords = normalized(item).split(' ');
      if (!equipmentWords.every((word) => normalized(exercise.name).split(' ').includes(word)))
        add(names, `${exercise.name} ${item.replace(/-/g, ' ')}`, exercise);
    }
    for (const alias of exercise.aliases ?? []) {
      add(aliases, alias, exercise);
      for (const item of equipment) {
        // Support explicit source equipment, without adding anatomy or choosing a variant.
        if (
          ['barbell', 'dumbbell', 'cable', 'machine', 'kettlebell', 'smith-machine'].includes(item)
        )
          add(aliases, `${alias} ${item.replace(/-/g, ' ')}`, exercise);
      }
    }
  }
  return (name: string): ExerciseCatalogItem | undefined => {
    const identity = key(name);
    if (names.has(identity)) return names.get(identity) ?? undefined;
    return aliases.get(identity) ?? undefined;
  };
}
