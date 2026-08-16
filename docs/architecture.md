# Architecture

## Target architecture

Forge should keep clear boundaries between SwiftUI presentation, application state and orchestration,
domain value types and rules, Core Data persistence, platform integrations, import/export, and lifecycle
coordination. Views should render state and send user intents. Application services should coordinate
writes and navigation. Domain code should be testable without SwiftUI or Core Data.

Completed workouts and routines must reference stable exact exercise UUIDs. Definitions and templates
must remain separate from completed historical records. Persistence changes require explicit, recoverable
migrations and import/export coverage.

## Current implementation

The current app is mid-transition toward these boundaries:

- Built-in exercise definitions are seeded from the JSON catalog.
- Custom exercise definitions are stored in Core Data and projected into the `Exercise` value model.
- Workouts, routines, history, and related settings still use exact exercise UUIDs.
- Core Data is versioned, with normalization and migration code handling older stores.
- Some SwiftUI screens still coordinate persistence and navigation directly.
- Workout sets support optional measurement fields for the different tracking metrics.
- Calendar entry creates dated drafts for current or past days; a draft is finalized explicitly and future
  scheduling is not implemented.

Treat this section as a snapshot. Verify the source and tests before relying on a detail that may have changed.

## Invariants

Never change an existing exercise UUID to repair a display label or catalog grouping. Do not merge
historical records because two titles look similar. Migrations must preserve workout and routine links,
validate imported data before replacement, and leave the active store untouched when a write fails.

## Evolution

Any future data-model redesign must be documented as a proposal before implementation. It must be split
into migration steps, with backups, export coverage, and recovery tests before data is rewritten.
