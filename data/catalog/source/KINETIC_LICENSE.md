# Kinetic Exercises Database source snapshot

`kinetic-exercises-2026-09-15.json` is a source snapshot from the Kinetic Exercises Database, used only to curate Forge's immutable bundled catalogue. The upstream dataset is MIT licensed: <https://github.com/kinetic-place/exercises-db>.

Forge does not load it at runtime. The curated output is regenerated with `node scripts/curate-kinetic-catalog.mjs`; Forge retains its own identifiers and taxonomy.
