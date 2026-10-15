# Architecture rules

These rules protect durable boundaries. They intentionally do not inventory the current codebase.

## Shared-first architecture

React Native is the default implementation layer and shared business/domain behavior should remain shared where practical.

Targeted Swift/Kotlin components or modules are appropriate when they unlock materially better platform capabilities such as system timers, background/system integration, widgets/Live Activities, notifications, or performance that cannot reasonably be delivered in shared React Native code.

Keep native code behind a clear adapter/module boundary. Do not fork business rules across Swift, Kotlin, and Typescript without a strong reason.

## Preserve established stack by default

Do not migrate navigation, language, state architecture, build system, or framework conventions simply because an external starter, skill, or best-practice repository prefers another stack.

A migration requires an explicit task or an approved architectural decision.

## Persistence boundary

UI components and screens should not directly own durable storage mechanics. Keep persistence access behind data/repository modules so storage technology can change without rewriting presentation code.

Bundled exercise catalogues are immutable versioned release snapshots. SQLite seeds each release as Forge-owned baseline data, upgrades only those baseline rows, and never overwrites custom exercises, preferences, routines, or workout history. An explicit, versioned canonical-identity migration may update a recognised catalogue exercise's identifier, display name and immutable snapshot across routines and workout history, but preserves user sets, notes, completion and ordering; custom or unrecognised records are never guessed or renamed. Forge serializes all SQLite transactions through the repository boundary because providers share one native database connection.

Any change to bundled catalogue content — adding, removing, renaming, or re-identifying an exercise — must bump the catalogue version so the version-gated SQLite seed re-runs (`bundled_exercises` re-seeds only when the stored `bundled-catalog-version` is below the shipped one). Never change catalogue content while leaving the version equal to a previously shipped build: devices whose cache already holds that version are stranded on the older snapshot (observed: a 608-exercise release shipped under the same version `5` as an earlier 600-exercise build, so upgraded devices never received the 8 added exercises). Renames or re-identifications must additionally ship both a `legacyIdMap` entry and the canonical-identity migration, because history progression and previous-set lookups match sets across sessions by exercise id: a logged workout exercise left without a resolvable `exerciseId` (or `exerciseSnapshot.id`) silently loses its history and "Previous" values. When changing the catalogue, verify no seeded id is missing from the release, no logged workout `exerciseId` is unresolvable, and the counts agree.

## Navigation boundary

Keep application navigation structure owned by navigation-focused modules. Screens may request navigation but should not independently redefine the application's global navigation model.

## Render and memory responsiveness

High-frequency state (a per-keystroke live workout, a per-second timer) must not share a context value, a mounted tree, or a subscription with low-frequency state, or a small change fans out across unrelated screens. The live workout is delivered through `useActiveWorkout()`; the archive, action creators, and workout identity/start-time scalars through `useWorkouts()` — do not re-bundle the live workout into it. Primary tabs are warmed and kept live, with `freezeOnBlur` reserved for the ticking Active Workout scene; do not re-enable global tab freezing (it trades a thaw spike back). Hot and startup paths look catalogue data up through maps and a cached, startup-warmed search index, never a linear scan. Large or unbounded lists are virtualized and bundled images ship near display resolution. See `.agents/docs/decisions/0004-render-and-memory-responsiveness.md` for rationale, trade-offs, and deferred follow-ups; the user-facing form is the responsiveness invariant in `.agents/rules/design.md`.

## Presentation and data

Keep mock/sample data distinguishable from durable domain data. Avoid turning prototype shapes into permanent domain models by accident.

Reuse shared tokens/components where they reduce duplication, but do not create speculative abstraction layers before there is a real repeated need.

## Graph rendering

Use `react-native-gifted-charts` as Forge's only graph/chart library, behind shared Forge chart components. Keep domain calculations, actual session dates, selected-session identity and accessibility in Forge. Display-only curve sampling must retain recorded endpoints and must never create selectable sessions or change computed metrics. Axes, markers and selection guides may use the existing drawing primitives around the shared renderer.

## Feature-local boundaries

Keep feature-specific screens, interactive subcomponents, hooks, formatters, and styles together in a feature-local folder. A screen should retain orchestration while independently interactive sections, modals, gestures, timers, and validation are extracted into focused modules. Promote code to shared folders only when multiple features genuinely reuse it.

## Dependency changes

Architectural convenience is not sufficient justification for a new dependency. Follow `core.md` dependency policy and prefer supported platform/Expo capabilities when they solve the problem cleanly.
