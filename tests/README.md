# Tests

- `unit/` — pure domain and selector coverage; no navigation setup.
- `e2e/dashboard/` — dashboard, calendar, and dock journeys.
- `e2e/exercises/` — exercise library and catalogue journeys.
- `e2e/workouts/` — plans, active workouts, and history journeys.
- `e2e/settings/` — settings journeys.
- `e2e/visual/` — intentional visual-regression and screenshot-capture coverage.
- `results/` — generated artifacts and reports; do not use it as test source.

Run a feature folder with `npx playwright test tests/e2e/workouts --workers=<available-workers>`.
