# Claude Code instructions for Forge

Forge's shared product, engineering, architecture, visual, data, testing, and release rules are
maintained in the [documentation handbook](docs/README.md). Read the relevant handbook pages before
editing code. Those pages are the source of truth for decisions that affect more than one file or
screen.

## Claude Code-specific workflow

- Inspect the relevant code, persistence path, lifecycle behavior, and existing tests before editing.
- Prefer `rg` and `rg --files` for repository searches.
- Use the existing architecture and local helpers before adding abstractions or dependencies.
- Use `apply_patch` for manual edits. Do not use shell redirection or scripts to rewrite tracked files.
- Keep changes focused. Do not revert user changes or unrelated work.
- Never use destructive Git commands such as `git reset --hard` or `git checkout --` unless explicitly requested.
- Preserve user data, UUIDs, migrations, licenses, attribution, and privacy boundaries.
- Keep project-owned text in English, with sentence case and concrete wording.
- Before finishing, run the relevant checks, inspect the diff, report anything not verified, and update the relevant handbook page when a cross-cutting decision changes.

## Completion

A change is complete only when the affected target builds, relevant tests pass, failure paths are checked,
and the final response states the commit, push, verification, and remaining risks. Follow the repository
instructions in [docs/testing.md](docs/testing.md) and [docs/release-and-licensing.md](docs/release-and-licensing.md)
for the required CI and release checks.
