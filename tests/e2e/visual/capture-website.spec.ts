import { expect, test, type Page } from '@playwright/test';

/**
 * Marketing captures for the public website and the repository README.
 *
 * Seeds about six weeks of fictional training, a plan, a measure and a live
 * session, then saves full-viewport PNGs for each theme into
 * `tests/results/website-captures/`. `scripts/website-captures.mjs` turns them
 * into the WebP/MP4/WebM assets. Run both with `npm run website:captures`.
 */

const OUT = 'tests/results/website-captures';
// The profile's default viewport (420 × 719) leaves room for browser chrome; the
// website's phone frame shows the full 420 × 912 screen (1260 × 2736 at 3x).
const FULL_SCREEN = { width: 420, height: 912 };

/**
 * The website frames these captures in an iPhone bezel, so the app must leave
 * room for the camera cutout and home indicator like it does on a device. The
 * web safe-area provider measures a hidden element padded with
 * `env(safe-area-inset-*)`, which is 0 in a browser; override that padding.
 */
async function deviceInsets(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Init scripts can run before <html> exists (WebKit); add the rule once it does.
    const add = () => {
      const style = document.createElement('style');
      style.textContent = `div[style*="safe-area-inset-top"] {
        padding-top: 62px !important;
        padding-bottom: 34px !important;
      }`;
      document.head.appendChild(style);
    };
    if (document.head) add();
    else document.addEventListener('DOMContentLoaded', add, { once: true });
  });
}
// Dates are relative to the real clock: freezing the browser clock also freezes the
// app's animations, so tab cross-fades and row entrances would never finish.
const NOW = new Date();
const DAY = 24 * 60 * 60 * 1000;
const at = (daysAgo: number, hour: number, minute = 0): number => {
  const d = new Date(NOW.getTime() - daysAgo * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
};

type SetSeed = { weight?: number; reps?: number; distanceKm?: number; seconds?: number };
type ExerciseSeed = { exerciseId: string; name: string; trackingType: string; sets: SetSeed[] };

let idCounter = 0;
const id = (prefix: string): string => `site-${prefix}-${++idCounter}`;

function sets(seed: SetSeed[], doneAt: number, completed = true) {
  return seed.map((s) => {
    const measurements = [
      ...(s.distanceKm !== undefined ? [{ id: id('m'), kind: 'distance', unit: 'km', value: s.distanceKm }] : []),
      ...(s.seconds !== undefined ? [{ id: id('m'), kind: 'duration', unit: 'sec', value: s.seconds }] : []),
    ];
    return {
      id: id('set'),
      weight: s.weight !== undefined ? String(s.weight) : '',
      reps: s.reps !== undefined ? String(s.reps) : '',
      completed,
      ...(completed ? { completedAt: doneAt } : {}),
      ...(measurements.length ? { measurements } : {}),
    };
  });
}

function workout(name: string, type: string, daysAgo: number, hour: number, minutes: number, exercises: ExerciseSeed[], note = '') {
  const startedAt = at(daysAgo, hour);
  return {
    id: id('workout'),
    name,
    type,
    startedAt,
    completedAt: startedAt + minutes * 60 * 1000,
    durationSeconds: minutes * 60,
    averageRestSeconds: 95,
    note,
    exercises: exercises.map((e) => ({
      id: id('exercise'),
      exerciseId: e.exerciseId,
      name: e.name,
      trackingType: e.trackingType,
      sets: sets(e.sets, startedAt + minutes * 30 * 1000),
    })),
  };
}

const lift = (exerciseId: string, name: string, weight: number, reps: number[]): ExerciseSeed => ({
  exerciseId,
  name,
  trackingType: 'weight-reps',
  sets: reps.map((r) => ({ weight, reps: r })),
});

function completedWorkouts() {
  const list = [];
  // Ten weeks, oldest first, with steady progression. Week 0 is the current week.
  for (let week = 9; week >= 0; week -= 1) {
    const step = (9 - week) / 2;
    const monday = week * 7 + ((NOW.getDay() + 6) % 7); // days back to that week's Monday
    list.push(
      workout('Push', 'Strength', monday, 7, 58, [
        lift('barbell-bench-press', 'Barbell Bench Press', 70 + step * 2.5, [8, 8, 7]),
        lift('incline-dumbbell-press', 'Incline Dumbbell Press', 24 + step, [10, 10, 9]),
        lift('barbell-overhead-press', 'Barbell Overhead Press', 42.5 + step * 1.25, [8, 7, 6]),
        lift('cable-triceps-pushdown', 'Cable Triceps Pushdown', 30 + step * 2.5, [12, 12]),
      ], week === 0 ? 'Bench moved well. Paused reps on the last set.' : ''),
    );
    if (week > 0) {
      list.push(
        workout('Pull', 'Strength', monday - 3, 18, 52, [
          lift('barbell-row', 'Barbell Row', 60 + step * 2.5, [8, 8, 8]),
          lift('lat-pulldown', 'Lat Pulldown', 55 + step * 2.5, [10, 10, 9]),
          { exerciseId: 'neutral-grip-pull-up', name: 'Neutral-Grip Pull-Up', trackingType: 'bodyweight-reps', sets: [{ reps: 8 + Math.floor(step / 2) }, { reps: 7 + Math.floor(step / 2) }] },
        ]),
        workout('Legs', 'Strength', monday - 5, 10, 64, [
          lift('barbell-squat', 'Barbell Back Squat', 90 + step * 5, [6, 6, 5]),
          lift('romanian-deadlift', 'Barbell Romanian Deadlift', 80 + step * 2.5, [8, 8]),
          lift('barbell-hip-thrust', 'Barbell Hip Thrust', 100 + step * 5, [10, 10]),
        ]),
        workout('Easy run', 'Cardio', monday - 1, 19, 34, [
          { exerciseId: 'running', name: 'Running', trackingType: 'distance-duration', sets: [{ distanceKm: 5 + step * 0.2, seconds: 1800 + step * 20 }] },
        ]),
        workout('Mobility', 'Mobility', monday - 6, 9, 20, [
          { exerciseId: 'plank', name: 'Plank', trackingType: 'duration', sets: [{ seconds: 60 }, { seconds: 60 }] },
        ]),
      );
    }
  }
  return list.filter((w) => w.startedAt < NOW.getTime());
}

const routine = (name: string, type: string, exercises: ExerciseSeed[], planId?: string) => ({
  id: id('routine'),
  name,
  type,
  ...(planId ? { planId } : {}),
  exercises: exercises.map((e) => ({ id: id('rx'), exerciseId: e.exerciseId, name: e.name, trackingType: e.trackingType, sets: sets(e.sets, 0, false) })),
  createdAt: at(50, 12),
  updatedAt: at(10, 12),
});

function plansState() {
  const planId = 'site-plan-ppl';
  return {
    plans: [
      {
        id: planId,
        name: 'Strength block',
        description: 'Three days a week.',
        routines: [
          routine('Push', 'Strength', [lift('barbell-bench-press', 'Barbell Bench Press', 82.5, [8, 8, 8]), lift('incline-dumbbell-press', 'Incline Dumbbell Press', 30, [10, 10, 10]), lift('barbell-overhead-press', 'Barbell Overhead Press', 50, [8, 8, 8])], planId),
          routine('Pull', 'Strength', [lift('barbell-row', 'Barbell Row', 72.5, [8, 8, 8]), lift('lat-pulldown', 'Lat Pulldown', 65, [10, 10, 10])], planId),
          routine('Legs', 'Strength', [lift('barbell-squat', 'Barbell Back Squat', 115, [6, 6, 6]), lift('romanian-deadlift', 'Barbell Romanian Deadlift', 92.5, [8, 8])], planId),
        ],
        createdAt: at(50, 12),
        updatedAt: at(10, 12),
      },
    ],
    standaloneRoutines: [
      routine('Easy run', 'Cardio', [{ exerciseId: 'running', name: 'Running', trackingType: 'distance-duration', sets: [{ distanceKm: 6, seconds: 2100 }] }]),
    ],
  };
}

function activeWorkout() {
  const startedAt = NOW.getTime() - 23 * 60 * 1000;
  // `previous` mirrors what the app derives from history when a session starts.
  const done = (weight: number, reps: number, previous: string) => ({ id: id('set'), weight: String(weight), reps: String(reps), previous, completed: true, completedAt: startedAt + 10 * 60 * 1000 });
  const todo = (weight: number, reps: number, previous: string) => ({ id: id('set'), weight: String(weight), reps: String(reps), previous, completed: false });
  return {
    id: 'site-active',
    name: 'Pull',
    type: 'Strength',
    startedAt,
    completedAt: null,
    note: '',
    exercises: [
      { id: id('exercise'), exerciseId: 'barbell-row', name: 'Barbell Row', trackingType: 'weight-reps', sets: [done(72.5, 8, '70 × 8'), done(72.5, 8, '70 × 8'), todo(72.5, 8, '70 × 8')] },
      { id: id('exercise'), exerciseId: 'lat-pulldown', name: 'Lat Pulldown', trackingType: 'weight-reps', sets: [todo(65, 10, '62.5 × 10'), todo(65, 10, '62.5 × 10'), todo(65, 10, '62.5 × 9')] },
    ],
  };
}

function preferences(appearance: 'light' | 'dark') {
  const weights = [80.4, 80.1, 80.3, 79.8, 79.9, 79.5, 79.6, 79.2, 79.4, 79.0, 78.9, 78.7, 78.8, 78.5];
  return {
    appearance,
    dailyMeasurementDefinitions: [{ id: 'site-weight', name: 'Body weight', unit: 'kg', icon: 'weight', color: '#7C8CF8' }],
    dailyMeasurementEntries: weights.map((value, index) => {
      const d = new Date(NOW.getTime() - (weights.length - 1 - index) * 3 * DAY);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { id: `site-weight-${index}`, definitionId: 'site-weight', date, value };
    }),
  };
}

// A fresh install starts with every tile hidden; show a representative set.
const dashboardLayout = [
  { id: 'start', kind: 'start', visible: true },
  { id: 'week', kind: 'week', visible: true },
  { id: 'last-workout', kind: 'last-workout', visible: true },
  { id: 'volume', kind: 'volume', visible: true },
  { id: 'muscle-heatmap', kind: 'muscle-heatmap', visible: true },
  { id: 'measurement:site-weight', kind: 'measurement', visible: true, settings: { measurementId: 'site-weight' } },
];

async function seed(page: Page, appearance: 'light' | 'dark', withActive: boolean): Promise<void> {
  await page.addInitScript(
    ([completed, plans, active, prefs, layout]) => {
      localStorage.setItem('@forge/dashboard-layout-v1', JSON.stringify(layout));
      localStorage.setItem('@forge/completed-workouts', JSON.stringify(completed));
      localStorage.setItem('@forge/plans-v1', JSON.stringify(plans));
      localStorage.setItem('@forge/active-workout', JSON.stringify(active));
      localStorage.setItem('@forge/settings-preferences', JSON.stringify(prefs));
    },
    [completedWorkouts(), plansState(), withActive ? activeWorkout() : null, preferences(appearance), dashboardLayout] as const,
  );
}

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

for (const appearance of ['light', 'dark'] as const) {
  test.describe(`website captures (${appearance})`, () => {
    test.beforeEach(({}, info) => {
      test.skip(info.project.name !== 'iphone-air', 'Captures use the iPhone Air profile (1260 × 2736).');
    });

    test(`gallery and hero tabs (${appearance})`, async ({ page }) => {
      await page.setViewportSize(FULL_SCREEN);
      await deviceInsets(page);
      await seed(page, appearance, true);
      await page.goto('/');
      await page.getByRole('tab', { name: 'Dashboard' }).click();
      await expect(page.getByTestId('dashboard-header-title')).toBeVisible();
      await shot(page, `dashboard-${appearance}`);

      await page.getByRole('tab', { name: 'History' }).click();
      await expect(page.getByRole('button', { name: /^Open Push/ }).first()).toBeVisible();
      await shot(page, `history-${appearance}`);

      await page.getByRole('tab', { name: 'Workout', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
      await shot(page, `live-workout-${appearance}`);

      await page.getByRole('tab', { name: 'Plans' }).click();
      await expect(page.getByText('Strength block').first()).toBeVisible();
      await shot(page, `plans-${appearance}`);

      await page.getByRole('tab', { name: 'History' }).click();
      await page.getByRole('button', { name: /^Open Push/ }).first().click();
      await expect(page.getByTestId('workout-details-summary')).toBeVisible();
      await shot(page, `workout-details-${appearance}`);
      await page.goBack();

      await page.getByRole('tab', { name: 'Settings' }).click();
      await page.getByRole('button', { name: 'Exercises' }).click();
      await page.getByRole('button', { name: 'All exercises, 608 exercises' }).click();
      await expect(page.getByTestId('settings-detail-title').last()).toHaveText('All exercises');
      await shot(page, `exercises-${appearance}`);
    });

    test(`readme screens (${appearance})`, async ({ page }) => {
      // The README keeps its shorter 420 × 719 crop.
      await page.setViewportSize({ width: 420, height: 719 });
      await seed(page, appearance, true);
      await page.goto('/');
      await page.getByRole('tab', { name: 'Dashboard' }).click();
      await expect(page.getByTestId('dashboard-header-title')).toBeVisible();
      await shot(page, `readme-dashboard-${appearance}`);
      await page.getByRole('tab', { name: 'History' }).click();
      await shot(page, `readme-history-${appearance}`);
      await page.getByRole('tab', { name: 'Workout', exact: true }).click();
      await shot(page, `readme-live-workout-${appearance}`);
      await page.getByRole('tab', { name: 'Plans' }).click();
      await shot(page, `readme-plans-${appearance}`);
      await page.getByRole('tab', { name: 'History' }).click();
      await page.getByRole('button', { name: /^Open Push/ }).first().click();
      await expect(page.getByTestId('workout-details-summary')).toBeVisible();
      await shot(page, `readme-workout-details-${appearance}`);
      await page.goBack();
      await page.getByRole('tab', { name: 'Settings' }).click();
      await page.getByRole('button', { name: 'Exercises' }).click();
      await page.getByRole('button', { name: 'All exercises, 608 exercises' }).click();
      await shot(page, `readme-exercises-${appearance}`);
    });
  });
}
