# Catalogue version incident (recorded 2026-09-22)

A 608-exercise catalogue release shipped under the same catalogue version (`5`) as an earlier
600-exercise build. The SQLite seed re-runs only when the stored `bundled-catalog-version` is below
the shipped one, so devices that already held version 5 never received the eight added exercises.

This is why `.agents/rules/architecture.md` requires a catalogue version bump for every change to
bundled catalogue content.
