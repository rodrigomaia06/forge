# Forge agent router

This file is the stable entry point for coding agents. Keep it short. It routes work to focused rules instead of duplicating them here.

Agent-facing material lives under `.agents/`: rules in `.agents/rules/`, canonical knowledge in `.agents/docs/`, and locally installed skills in `.agents/skills/`. The top-level `docs/` holds app/developer documentation only.

## Always read

Before changing the repository, read:

- `.agents/rules/core.md`
- `.agents/rules/maintenance.md`
- `.agents/rules/README.md`

Then read only the additional rule files that `.agents/rules/README.md` routes to for the current task.

Do not read `.agents/docs/research/` as current requirements unless the task explicitly asks for research context.

## Authority

- The user's explicit current requirements define product intent.
- Active Forge rules define durable repository constraints, not product requirements.
- Accepted documents under `.agents/docs/product/` define only requirements that have been explicitly promoted there.
- Accepted ADRs under `.agents/docs/decisions/` explain durable architectural decisions.
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

Use the smallest useful check during iteration. Before finishing a TypeScript code change, run `npm run typecheck` and only the tests that directly cover the files, consumers, and behavior changed.

Run automated tests at reduced system priority and use up to two thirds of the machine's available cores (rounded down, with a minimum of one). For example, use `nice -n 10 npx playwright test ... --workers=$(( $(getconf _NPROCESSORS_ONLN) * 2 / 3 ))`. This is the normal target, not a fixed single-worker default: use the available allowance so verification remains timely while the machine stays responsive. Do not consume all cores for verification unless the user explicitly overrides this constraint. Preserve memory headroom too: run only one resource-heavy suite at a time, reduce workers only when observed suite memory pressure requires it, and never configure a verification command to consume all available RAM.

Do not run unrelated test suites by default. Use `npm run verify` only when the changed surface is genuinely repository-wide and the full suite is therefore the smallest correct scope, or when the user explicitly requests it.

If targeted verification cannot run or an affected area has no relevant test, report exactly what was not verified and why.

## Completion contract

Documentation/rule maintenance is implicit in every task. The user never needs to ask for it.

Before finishing, follow the knowledge-impact procedure in `.agents/rules/maintenance.md` and tell the user one of:

- `Knowledge: updated ...` with the durable files changed and why, or
- `Knowledge: no durable knowledge change.`

Any change to a Forge rule must be called out explicitly in the completion response.

## Project map

A directory-level map for routing. It is deliberately not a per-file inventory —
list contents with the file tools instead, so this never drifts as files change.

- `.agents/rules/` — active Forge rules; start at `.agents/rules/README.md` (the
  router), which points to `core.md`, `maintenance.md`, `architecture.md`,
  `design.md`, `external.md`.
- `.agents/docs/` — agent-facing canonical knowledge: `product/` (accepted
  requirements), `decisions/` (ADRs), and `research/` (non-canonical).
- `.agents/skills/` — locally installed agent skills (gitignored; not app source).
- `docs/` — app/developer documentation (not agent rules). Empty for now; app-facing
  docs will be added here.
- `src/`
  - `components/` — shared UI, including `components/ui/` (the Forge primitives:
    sheets, buttons, fields, filters) and feature cards.
  - `screens/` — one file per screen, with `activeWorkout/`, `dashboard/`, and
    `settings/` holding their sub-sheets and parts.
  - `navigation/` — the navigator, tab bar, primary-dock context, and the
    opened-file (`.forge`) handoff.
  - `state/` — React context providers (workout, plans, settings, exercise
    catalogue, rest timer) plus their mutation and pending-handoff modules.
  - `data/` — persistence and portable transfer: SQLite repositories (with
    `*.web.ts` mirrors for the web build), the exercise catalogue, and the
    import/export/merge pipeline.
  - `domain/` — pure logic (`exercises/`, `workouts/`, `rest/`, trends); no
    React or storage.
  - `theme/` — tokens, typography, motion, and the theme provider.
  - `types/` — shared TypeScript types (plus `src/types.ts`).
  - `utils/`, `debug/` — small helpers and development probes.
- `modules/forge-rest-timer/` — the native rest-timer module (iOS Live Activity
  and numeric keyboard), wired via its config plugin.
- `plugins/` — Expo config plugins (disable shake-to-edit, `.forge` file
  association).
- `tests/` — `tests/unit/` and Playwright `tests/e2e/`.
- `.github/workflows/` — manual build workflows: `build-ipa.yml` (iOS) and
  `build-apk.yml` (Android).
