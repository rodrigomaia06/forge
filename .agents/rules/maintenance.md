# Knowledge maintenance, verification and commits

## Knowledge maintenance

Part of every implementation task; the user does not need to ask. Before finishing, review the
complete diff for a new or changed durable product requirement, architecture boundary or
decision, Forge-wide design invariant, dependency exception, or external-guidance adoption, and
update the smallest canonical file in the same task:

- product behavior → the relevant file in `.agents/docs/product/`
- architecture → `.agents/rules/architecture.md` for a general invariant, or an ADR in
  `.agents/docs/decisions/` (threshold in its README)
- Forge-wide design invariant → `.agents/rules/design.md`
- agent/process policy → the smallest relevant file in `.agents/rules/`

When the user's requirement explicitly establishes or supersedes a rule or requirement, update it
without asking again. When the agent merely infers that a new long-lived policy would be better,
ask before promoting it.

Durable documents state requirements, boundaries, rationale and adopted policy. Never store
chat summaries, progress or "next task" notes, "not yet implemented" claims, rejected
experiments, debugging or screenshot observations, or inventories derivable from source or
`package.json`. Delete obsolete temporary documents instead of keeping a memory folder.

## Verification

Verify every change, scoped to what changed: run `npm run typecheck` for TypeScript, then only the
tests covering the changed files, their consumers and the behavior at risk. A changed shared
primitive needs representative consumers for each affected mode. Run the full suite only when the
change is genuinely repository-wide or the user asks.

Run every check through `npm run typecheck`, `npm run test:visual -- <targeted arguments>` or
`npm run verify:run -- <command> <arguments>`. They enforce `scripts/verification-budget.mjs`
(reduced priority and a shared CPU pool of two thirds of the cores, inherited by browsers and
Metro). Never bypass the guard with another config, invocation, environment or unwrapped
command; if it cannot enforce its limits it refuses to start, so report that instead. This
applies to delegated agents too. Run one resource-heavy suite at a time and reduce workers only
for observed memory pressure.

For every user-reported visual, layout, gesture, navigation or interaction condition, capture and
inspect a screenshot of that exact changed state in each phone profile in `playwright.config.ts`,
and say which state each screenshot verified. Desktop captures may help diagnosis but are not the
visual check.

MCP browser tools may be used for exploratory checks when available; they complement but never
replace the checks above, and they cannot validate native Swift/Kotlin behavior or system
keyboards. Add a regression test when exploration finds a reproducible failure worth keeping.

## Commits

Never commit or push unless the user asks in the current conversation; leave changes uncommitted
for review.

When asked, split the work into commits by cohesive concern, each with its relevant tests and
durable knowledge, keeping imported skills and agent configuration separate from app changes. Use
the scoped Conventional Commit subject `type(scope): concise description` in English, with a
short body when scope or rationale is not obvious. Do not split inseparable changes artificially.
Check `git diff --stat` before committing: look for a split above roughly 750 changed lines or 15
files, never create one near 2,000 lines, and explain in the body why a larger commit cannot be
split. Verify that the split commits together keep the complete behavior.

When the user asks for commits and a push before follow-up work, finish and verify that work,
commit, and push before starting the follow-up.

## Requests and completion

Address an explicit list of tasks in its order, confirming each item before the next.

Every completion response reports the verification performed and anything that could not be
verified, names any rule change, and ends with one of:

- `Knowledge: updated <file(s)> — <reason>.`
- `Knowledge: no durable knowledge change.`
