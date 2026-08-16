# Engineering

## Boundaries

Keep presentation, application state, domain rules, persistence, platform integrations, import/export,
and lifecycle coordination distinct. Keep business rules out of views and persistence details out of
UI components. Prefer small value types and explicit side effects.

## Quality

Read the relevant code path, source of truth, persistence path, lifecycle behavior, and tests before
editing. Follow existing patterns. Keep changes focused, resolve warnings, avoid force casts and
force unwraps on malformed data, and do not add a dependency for a small problem.

## Data and errors

Treat data loss, duplication, incorrect ordering, and broken migrations as critical defects. Use stable
identifiers, validate imports before replacement, and preserve the previous valid state on failure.
User-facing errors must be actionable and must not claim success when a write may have failed.

## Performance and concurrency

Keep launch and main-thread work small. Use lazy collections for large histories, invalidate timers and
observers, handle cancellation, and make actor boundaries explicit. Store timer end dates rather than
assuming an in-process timer survives suspension.

## Security and privacy

Use least privilege, keep secrets out of source control and logs, validate external data, use Keychain
only when credentials are required, and do not weaken transport security. Do not add analytics or
third-party tracking without a documented privacy review.

## Localization

Use localized resources and locale-aware date, number, duration, and unit formatting. Do not concatenate
user-facing fragments or store formatted display strings as source data.

## Change discipline

Use `rg` for exploration and `apply_patch` for manual edits. Do not revert unrelated work or use
destructive Git operations without explicit approval. Add tests with behavior changes and update the
relevant handbook page when a cross-cutting decision changes.
