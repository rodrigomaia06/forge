# Architecture rules

Durable boundaries; they do not inventory the codebase.

## Shared-first

React Native is the default layer, and business/domain behavior stays shared. Use targeted
Swift/Kotlin only where it unlocks materially better platform capability (system timers,
background/system integration, widgets and Live Activities, notifications, or performance shared
code cannot reasonably deliver). Keep native code behind a clear module boundary and never fork
business rules across Swift, Kotlin and TypeScript without a strong reason. The iOS deployment
target follows the rest-timer Live Activity pod's minimum (its podspec), not any visual dependency.

## Established stack

Do not migrate navigation, language, state architecture, build system or framework conventions
because an external starter, skill or example prefers another (for example, do not adopt Expo
Router). A migration needs an explicit task or an accepted decision.

## Persistence

UI and screens never own storage mechanics; persistence stays behind `src/data/` repositories so
the storage technology can change. All persistent native state, including preferences and
auxiliary state, lives in the shared SQLite database. Forge serializes all SQLite transactions
through the repository boundary because providers share one connection. Full backups drain
pending provider writes before snapshotting and restore all persistent state; selective transfers
stay independent. Browser adapters preserve behavior without browser SQLite.

Bundled exercise catalogues are immutable versioned snapshots seeded as Forge-owned baseline
rows; seeding upgrades only those rows and never overwrites custom exercises, preferences,
routines or history. Any change to bundled catalogue content (add, remove, rename, re-identify)
must bump the catalogue version so the version-gated seed re-runs
([why](../docs/history/2026-09-22-catalogue-version-incident.md)). Renames and re-identifications
also need a `legacyIdMap` entry and the versioned canonical-identity migration, which may update a
recognised exercise's id, display name and snapshot across routines and history but preserves
sets, notes, completion and order and never guesses for custom or unrecognised records — history
progression and "Previous" values match by exercise id. When changing the catalogue, verify no
seeded id is missing, every logged `exerciseId` resolves, and the counts agree.

## Navigation

Navigation-focused modules own the navigation structure. Screens request navigation but do not
redefine the global navigation model.

## Render and memory responsiveness

High-frequency state (a per-keystroke live workout, a per-second timer) never shares a context
value, mounted tree or subscription with low-frequency state. The live workout comes through
`useActiveWorkout()`; the archive, actions and identity/start-time scalars through
`useWorkouts()` — do not re-bundle them. Primary tabs are warmed and kept live, with
`freezeOnBlur` only on the ticking Active Workout scene; do not re-enable global tab freezing.
Hot and startup paths look catalogue data up through maps and the cached search index, never a
linear scan. Large or unbounded lists are virtualized, and bundled images ship near display
resolution. Rationale: [ADR 0004](../docs/decisions/0004-render-and-memory-responsiveness.md).

## Presentation and data

Keep mock/sample data distinguishable from domain data so prototype shapes do not become models.
Reuse shared tokens and components where they remove duplication, without speculative
abstraction layers.

## Charts

`react-native-gifted-charts` is the only chart library, behind shared Forge chart components.
Forge keeps domain calculations, actual session dates, selected-session identity and
accessibility. Display-only curve sampling keeps the recorded endpoints and never creates
selectable sessions or changes metrics. Axes, markers and selection guides may use the existing
drawing primitives around the shared renderer.

## Feature-local code

Keep a feature's screens, interactive subcomponents, hooks, formatters and styles together in its
folder. Screens keep orchestration; independently interactive sections, modals, gestures, timers
and validation move into focused modules. Promote code to shared folders only when several
features reuse it.
