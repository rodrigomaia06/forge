# Rule router

Use this file to load the minimum useful context for a task.

## Always

- `core.md` — authority, ambiguity, language/dependency defaults, rule-change safety.
- `maintenance.md` — automatic knowledge-impact review and completion reporting.

## Read `architecture.md` when changing

- navigation or routing
- state ownership or providers
- persistence or data access
- module/folder boundaries
- native Swift/Kotlin integration
- build/runtime architecture
- dependencies with architectural impact

## Read `design.md` when changing

- screens or reusable UI
- visual hierarchy or layout
- theme/tokens/typography
- interaction behavior
- animations, haptics, input, keyboard behavior
- accessibility or platform-specific presentation

## Read `external.md` when

- framework/platform behavior needs current guidance
- an Expo API/package is involved
- iOS/Android behavior or native integration is involved
- performance guidance from an external rule pack may help

## Product requirements

Read only relevant active files under `.agents/docs/product/` when the task touches product behavior that has already been explicitly promoted there.

Do not infer requirements from `.agents/docs/archive/` or `.agents/docs/research/`.

## Decisions

Read relevant accepted ADRs under `.agents/docs/decisions/` when changing an architectural boundary they cover.
