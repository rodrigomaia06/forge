# Rule router

Load the minimum useful context for a task.

## Always

- `core.md` — precedence, ambiguity, language, dependencies, rule-change safety.
- `maintenance.md` — knowledge maintenance, verification, commits and the completion report.

## By task

- `architecture.md` — navigation, state ownership, persistence, folder boundaries, native
  Swift/Kotlin integration, build/runtime architecture, dependencies with architectural impact.
- `design.md` — screens and reusable UI, layout, theme and typography, interaction, motion,
  haptics, input and keyboard behavior, accessibility, platform-specific presentation.
- `external.md` — when framework, platform, Expo or native behavior needs current guidance, or an
  external rule pack is involved.

## Canonical documents

- `.agents/docs/product/` — read only the files for product behavior the task touches.
- `.agents/docs/decisions/` — read the ADRs covering an architectural boundary being changed.
- `.agents/docs/research/`, `audits/` and `history/` are context, never requirements.
