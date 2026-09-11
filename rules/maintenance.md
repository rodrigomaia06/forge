# Automatic knowledge maintenance

Knowledge maintenance is part of every implementation task. The user does not need to request it.

## After implementation: inspect the complete diff

Before finishing, review the complete change and ask whether it introduced or changed a durable:

- explicit product requirement
- architectural boundary or accepted architecture decision
- Forge-wide design invariant
- dependency policy/exception
- external-guidance exception or adoption policy

## If durable knowledge changed

Update the smallest canonical file in the same task.

- Explicit product behavior -> relevant active file under `docs/product/`.
- Architecture policy/boundary -> `rules/architecture.md` when it is a general invariant, or an ADR under `docs/decisions/` when a meaningful decision/trade-off should be preserved.
- Forge-wide design invariant -> `rules/design.md`.
- Agent/process policy -> the smallest relevant file under `rules/`.

Do not create a document just to narrate the implementation.

## Explicit versus inferred policy

If the user's requirement explicitly establishes a durable rule or requirement, update the canonical knowledge automatically without asking for a second confirmation.

If the agent merely infers a new long-lived product/design/architecture policy, ask the user before promoting that inference into a rule or canonical product document.

This distinction prevents implementation convenience from silently becoming project policy.

## Do not preserve transient state

Do not store these as durable repository knowledge:

- chat summaries or conversation memory
- debugging observations that are no longer needed
- implementation progress or "next task" statements
- rejected experiments
- temporary screenshots/geometry observations
- inventories derivable from source code or `package.json`
- claims that a feature is "not yet implemented"

Delete obsolete temporary documentation instead of maintaining a generic memory folder.

## Commit organization

When a change is large or spans multiple responsibilities, divide it into commits by
cohesive concern rather than committing the entire change as one mixed unit.

- Keep each commit internally understandable and independently reviewable where practical.
- Separate concerns such as dependencies/configuration, feature behavior, UI refactors, and tests when they form clear boundaries.
- Use a Conventional Commit subject in the form `type: concise description` (for example, `fix: restore history cards and dock transitions` or `perf: reduce live workout render and input pressure`).
- Write commit subjects in English, keep them concise, and add a short body for changes whose scope or rationale is not clear from the subject.
- Do not create artificial commits for tiny or inseparable changes merely to increase the commit count.
- Before splitting history, preserve the complete implementation and verify that the resulting commits together contain the same behavior.

### Commit size review

Do not create commits around 2,000 changed lines. Before committing, inspect `git diff --stat` and proactively look for a cohesive split when a commit exceeds roughly 750 changed lines or touches more than 15 files.

- Line/file counts are a review signal, not a reason to split an inseparable change artificially.
- A larger commit is acceptable only when its parts cannot be reviewed, tested, or reverted meaningfully on their own; explain that constraint in the commit body.
- If oversized commits are still local and the full behavior is preserved, rewrite them into smaller cohesive commits before sharing the branch.

## Targeted verification

Every implementation change must be verified, but verification should remain scoped to what changed.

- Run the project typecheck for TypeScript changes, then run only the tests that directly cover the changed files, their affected consumers, and the behavior at risk.
- Do not run unrelated test suites merely because they are available.
- When a shared primitive changes, include representative consumers for each affected behavior or presentation mode; this can legitimately require several targeted test files.
- Run the complete verification suite only when the change itself is repository-wide and the full suite is the smallest correct scope, or when the user explicitly requests it.
- Report the exact checks executed and identify any affected behavior that could not be verified.

### Verification capacity

Use the machine's available capacity to reduce verification time. Automated checks run with their maximum safe concurrency by default (for example, Playwright uses all available workers). Restrict work to a serial or lower-concurrency run only when a test, shared resource, or tool requires exclusive access.

## Explicit multi-item requests

When a user supplies an explicit list of tasks, address the items in that order and confirm each one before moving to the next. Do not collapse the list into an unstructured aggregate.

## ADR threshold

Create an ADR only when the decision is important enough that a future contributor would reasonably ask "why did we choose this instead of the alternatives?"

Do not create ADRs for routine refactors, local component choices, or straightforward implementation details.

## Completion response

Always report knowledge maintenance without being asked:

- `Knowledge: updated <file(s)> — <reason>.`
- or `Knowledge: no durable knowledge change.`

Also report verification performed and any verification that could not run.
