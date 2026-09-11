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

Bundled exercise catalogues are immutable versioned release snapshots. SQLite seeds each release as Forge-owned baseline data, upgrades only those baseline rows, and never overwrites custom exercises, preferences, routines, or workout history. Completed workouts retain exercise and set snapshots so catalogue releases cannot reinterpret recorded history. Forge serializes all SQLite transactions through the repository boundary because providers share one native database connection.

## Navigation boundary

Keep application navigation structure owned by navigation-focused modules. Screens may request navigation but should not independently redefine the application's global navigation model.

## Presentation and data

Keep mock/sample data distinguishable from durable domain data. Avoid turning prototype shapes into permanent domain models by accident.

Reuse shared tokens/components where they reduce duplication, but do not create speculative abstraction layers before there is a real repeated need.

## Feature-local boundaries

Keep feature-specific screens, interactive subcomponents, hooks, formatters, and styles together in a feature-local folder. A screen should retain orchestration while independently interactive sections, modals, gestures, timers, and validation are extracted into focused modules. Promote code to shared folders only when multiple features genuinely reuse it.

## Dependency changes

Architectural convenience is not sufficient justification for a new dependency. Follow `core.md` dependency policy and prefer supported platform/Expo capabilities when they solve the problem cleanly.
