# Forge agent router

This file is the stable entry point for coding agents. Keep it short. It routes work to focused rules instead of duplicating them here.

## Always read

Before changing the repository, read:

- `rules/core.md`
- `rules/maintenance.md`
- `rules/README.md`

Then read only the additional rule files that `rules/README.md` routes to for the current task.

Do not read `docs/archive/` or `docs/research/` as current requirements unless the task explicitly asks for historical or research context.

## Authority

- The user's explicit current requirements define product intent.
- Active Forge rules define durable repository constraints, not product requirements.
- Accepted documents under `docs/product/` define only requirements that have been explicitly promoted there.
- Accepted ADRs under `docs/decisions/` explain durable architectural decisions.
- Current code and tests are evidence of implementation state, not proof of product intent.
- External skills, framework guidance, research, archived docs, and previous chat context are advisory/contextual, not Forge product truth.
- If a blocking product or policy decision cannot be resolved from an explicit requirement or active canonical document, ask the user rather than inventing one.

## Project defaults

- Keep the project in TypeScript migration.
- React Native is the default implementation layer. Use targeted Swift/Kotlin components only when they materially improve or unlock platform capabilities that are unreasonable in shared React Native code.
- Preserve a shared Forge visual identity across iOS and Android. Platform differences should primarily address behavior, system integration, accessibility, or genuinely native capabilities.
- Preserve the established navigation/framework choices unless a task explicitly requires reconsidering them.

## Dependencies

- Prefer the platform, React Native, and existing project dependencies before adding packages.
- Expo SDK packages may be added when justified; use the Expo-recommended compatible install path.
- Ask before adding a new third-party runtime or native dependency.
- Do not introduce a dependency merely because an external rule or example recommends it.

## Verification

Use the smallest useful check during iteration. Before finishing a code change, run:

`npm run verify`

If verification cannot run, report exactly what was not run and why.

## Completion contract

Documentation/rule maintenance is implicit in every task. The user never needs to ask for it.

Before finishing, follow the knowledge-impact procedure in `rules/maintenance.md` and tell the user one of:

- `Knowledge: updated ...` with the durable files changed and why, or
- `Knowledge: no durable knowledge change.`

Any change to a Forge rule must be called out explicitly in the completion response.

## Project tree

docs/
├── decisions
│   └── README.md
├── product
│   └── README.md
├── README.md
└── research
    └── README.md
rules/
├── architecture.md
├── core.md
├── design.md
├── external.md
├── maintenance.md
└── README.md
src/
├── components
│   ├── BottomNavigation.tsx
│   ├── calendar
│   ├── Calendar.tsx
│   ├── DashboardHeader.tsx
│   ├── DockChrome.tsx
│   ├── DockSurface.tsx
│   ├── IconButton.tsx
│   ├── NavigationFooter.tsx
│   ├── ui
│   └── WorkoutRow.tsx
├── domain
│   ├── exercises
│   ├── rest
│   └── workouts
├── data
│   ├── mockWorkouts.ts
│   └── workoutRepository.ts
├── debug
│   └── layoutProbe.ts
├── navigation
│   └── AppNavigator.tsx
├── screens
│   ├── activeWorkout
│   ├── ActiveWorkoutScreen.tsx
│   ├── dashboard
│   ├── DashboardScreen.tsx
│   ├── HistoryScreen.tsx
│   └── PlaceholderScreen.tsx
├── state
│   ├── WorkoutContext.tsx
│   └── workoutMutations.ts
├── theme
│   ├── dashboardTheme.ts
│   └── tokens.ts
├── types
│   ├── icons.ts
│   ├── navigation.ts
│   ├── theme.ts
│   ├── ui.ts
│   └── workout.ts
└── types.ts
tests/

This section should be updated as files are created for an updated overview of the project.
Tests directory doesn't need to be expanded.
