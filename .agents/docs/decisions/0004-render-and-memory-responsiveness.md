# ADR 0004: Render and memory responsiveness architecture

Status: Accepted
Date: 2026-09-17

## Context

Forge targets 120 Hz phones (iPhone Air, Galaxy S24). A performance audit found
JS-thread spikes on tab switches and live-workout set entry, and higher-than-needed
RAM. The causes were structural, not incidental, so the fixes are durable
decisions that later work must not silently reverse. This ADR records them and
the constraints they impose. The user-facing rule is the responsiveness
invariant in `.agents/rules/design.md`; this ADR is the mechanism and rationale.

## Decision

1. **Primary tabs are warmed and kept live; only Active Workout freezes.**
   `MainTabNavigator` uses `lazy: false` with `freezeOnBlur` set only on the
   `ActiveWorkout` screen. Warming avoids a first-visit cost; keeping the other
   tabs unfrozen avoids a freeze/thaw re-render burst on every tab switch. Active
   Workout is the exception because its rest timer ticks once per second, so it
   must pause off-screen.

2. **`WorkoutContext` is split by change frequency.** The live `activeWorkout`
   (a new object on every keystroke) is delivered through `useActiveWorkout()`.
   The archive, `ready`, the stable action creators, and the
   `activeWorkoutId` / `activeWorkoutStartedAt` scalars are delivered through
   `useWorkouts()`, whose value identity does **not** change on a keystroke.
   Action creators read live state via refs so they stay referentially stable.

3. **The catalogue is indexed, not scanned, and warmed off the interaction
   path.** `taxonomyLabel` and exercise-id checks use maps
   (`exerciseCatalogById`); the search/facet index is memoized per immutable
   catalogue snapshot (`catalogSelectors`) and warmed in idle chunks at startup
   (`warmCatalogIndex`). Pickers render their shell immediately and defer the
   index build.

4. **Large lists are virtualized.** The History timeline is a `FlatList` of
   weekly section blocks (rows and callbacks memoized). Its per-week SVG period
   rail is a deliberate, test-protected design element
   (`history.spec` asserts the gradient) — keep it.

5. **Bundled illustrations ship near display resolution**, so they do not decode
   to multi-megabyte bitmaps for a small on-screen size.

6. **ProMotion 120 Hz is opted into** via `CADisableMinimumFrameDurationOnPhone`
   in `app.json`; this only applies to a native build, never Expo Go.

## Consequences

- A set-entry keystroke re-renders only the edited exercise section (and its
  rows), not every exercise, not the four background tabs. Idle tabs and the
  rest-timer provider no longer re-render during set entry.
- Tab switching is a pure cross-fade with no thaw re-render.
- Keeping tabs live costs some idle RAM; this is accepted because the alternative
  (global `freezeOnBlur`) reintroduces the thaw spike. The correct lever for
  further RAM/render savings is finer context granularity, not re-freezing.

## Constraints for future changes (do not silently reverse)

- Do **not** re-add `activeWorkout` to the `useWorkouts()` value or set global
  `freezeOnBlur: true` on the tabs; both reintroduce the spikes this ADR removed.
  A component that only needs presence uses `activeWorkoutId`.
- Do **not** linear-scan `exerciseCatalog`/taxonomies in render or startup paths;
  use the maps and the cached index.
- Keep heavy or unbounded lists virtualized; keep bundled images near display size.

## Alternatives considered

- **Global `freezeOnBlur`** — lower idle RAM, but a visible thaw lag on every
  tab switch; rejected in favour of context granularity.
- **A selector library (e.g. `use-context-selector`)** — cleaner than splitting,
  but adds a runtime dependency; rejected under the dependency policy in favour
  of a plain context split.

## Known follow-ups (not yet done, deliberately deferred)

- Completed-workout history is still fully held in memory (unbounded for heavy
  users); paginating it risks the calendar/dashboard/History aggregates and was
  deferred.
- The bundled catalogue is retained more than once in memory and duplicated into
  never-read SQLite tables; collapsing these is entangled with the catalogue seed
  and was deferred.
- Per-set `SwipeableSetRow` still mounts always-present entrance/removal animation
  nodes and receives fresh inline callbacks; trimming these touches the swipe/
  toggle animations and was deferred to avoid visual regressions.
