# Tests

- `unit/` — pure domain and selector coverage; no navigation setup.
- `e2e/core/` — independent phone journeys across Dashboard, plans/routines, Live Workout, History, and data transfer. These protect the durable paths that cross feature boundaries.
- `e2e/support/` — shared, side-effect-free Playwright journey helpers; not a test suite.
- `e2e/dashboard/` — dashboard, calendar, and dock journeys.
- `e2e/exercises/` — exercise library and catalogue journeys.
- `e2e/workouts/` — plans, active workouts, and history journeys.
- `e2e/settings/` — settings journeys.
- `e2e/visual/` — intentional visual-regression and screenshot-capture coverage.
- `results/` — generated artifacts and reports; do not use it as test source.

Run the core flow matching the changed feature across the configured phone profiles, for example: `nice -n 10 npx playwright test tests/e2e/core/live-workout.flow.spec.ts --project=iphone-air --project=samsung-galaxy-s24 --workers=$(( $(getconf _NPROCESSORS_ONLN) * 2 / 3 ))`.

Run all core flows only when a change crosses input, persistence, navigation, or transfer boundaries. Keep test processes at reduced priority and use at most two-thirds of available cores; run one resource-heavy suite at a time.

Motion changes require focused phone coverage for dock/tab state, shared-sheet state, swipe reveal/settle, live-workout feedback, and stack back navigation. Run those checks with normal and emulated reduced motion, then manually inspect the corresponding Light and Dark captures on both configured phone profiles.
