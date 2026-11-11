# Forge agent router

Stable entry point for coding agents. It routes to focused rules instead of repeating them.

## Always read

Before changing the repository, read `.agents/rules/core.md`, `.agents/rules/maintenance.md`
and `.agents/rules/README.md`, then only the rule files the README routes the task to.

- Precedence between user requirements, rules, product docs and external guidance: `core.md`.
- Dependencies: `core.md`. Verification, commits and the completion report: `maintenance.md`.

## Project map

Directory-level only; list contents with the file tools.

- `.agents/rules/` — active Forge rules; start at its `README.md`.
- `.agents/docs/` — `product/` (accepted requirements), `decisions/` (ADRs), `research/`
  (non-canonical), `audits/` and `history/` (dated records, not requirements).
- `.agents/skills/` — installed agent skills (`skills-lock.json`, `.claude/skills/` links); not app source.
- `docs/` — app/developer documentation and product screenshots, not agent rules.
- `src/`
  - `components/` — shared UI; `components/ui/` holds the Forge primitives.
  - `screens/` — one file per screen, with feature folders for their sheets and parts.
  - `navigation/` — navigators, dock/tab bar and `.forge` file handoff.
  - `state/` — React context providers and their mutation modules.
  - `data/` — persistence (SQLite repositories with `*.web.ts` mirrors), the exercise
    catalogue and the import/export pipeline.
  - `domain/` — pure logic; no React or storage.
  - `theme/` — tokens, typography, motion, scale and the theme provider.
  - `types/`, `utils/`, `debug/` — shared types, small helpers, development probes.
- `modules/` — native Expo modules (rest-timer Live Activity, range keypad), each wired by its config plugin.
- `plugins/` — app-level Expo config plugins.
- `tests/` — `unit/`, Playwright `e2e/` and `fixtures/`.
- `scripts/` — verification guard and catalogue/signing tooling.
- `website/` — the static public website (GitHub Pages).
- `.github/workflows/` — manually dispatched Android/iOS build workflows.
- `flake.nix` — the Nix dev shell (loaded by direnv) that local checks and CI take Node from.
