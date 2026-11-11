# Core rules

## 1. Do not manufacture product truth

When sources conflict, prefer, in order:

1. the user's explicit current requirement
2. accepted product requirements (`.agents/docs/product/`) and accepted ADRs (`.agents/docs/decisions/`)
3. active Forge rules (`.agents/rules/`)
4. official platform/framework documentation and tooling, for factual API and platform behavior
5. maintained external skills and rule packs
6. research, audits, history and inspiration

Current code, tests, screenshots and previous chat context are evidence of implementation
state, not product intent. If a blocking product, architecture or long-lived design decision
cannot be resolved from 1–3, ask the user instead of inventing one.

## 2. TypeScript is the project language

## 3. Dependencies

Prefer the platform, React Native and existing dependencies. Expo SDK packages may be added
when they are the supported solution; install them through the Expo-compatible path rather
than guessing a version.

Ask before adding any new third-party runtime or native dependency. A recommendation in an
external skill, rule pack or example is not a reason to add one, and no Forge rule may be
changed to justify one.

## 4. Playwright server

Keep Playwright's `baseURL`, web-server URL and static-server command aligned on one local
address (see `playwright.config.ts`).

## 5. Rules are harder to change than code

Implementation conforms to active Forge rules. Never loosen a rule only to make an
implementation or test pass. Name every rule change in the completion response; when a rule
may be changed without asking is defined in `maintenance.md`.

## 6. Keep routers small

`AGENTS.md` and `.agents/rules/README.md` route context; do not grow them into handbooks. Put
durable guidance in the smallest relevant rule or canonical document.
