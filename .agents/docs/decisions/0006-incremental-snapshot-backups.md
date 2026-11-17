# ADR 0006: Incremental snapshot backups, local first, mirrored to a hidden iCloud container

Status: Accepted
Date: 2026-11-17

## Context

Forge had only manual full backups: a `.sqlite` file shared through the system share sheet. A
lost phone lost every workout the user had not exported by hand. Backups should run on their
own, survive a lost phone on iPhone, keep older versions without filling storage, and never
depend on iCloud having free space. Forge is distributed as signed Ad Hoc builds (paid Apple
Developer account) and as a free-signed build that cannot carry iCloud entitlements.

## Decision

- A backup is a content-addressed snapshot (`src/data/snapshots/`). Every user-owned SQLite row
  becomes one object named by the SHA-256 of its canonical JSON (`objects/<aa>/<hash>.json`);
  a manifest (`snapshots/<id>.json`) lists the object hashes per table. Unchanged rows reuse
  their object, so a new snapshot stores only what changed, like git.
- Snapshots are written to the phone first. On iPhone the default is Forge's Documents folder,
  shown in Files as On My iPhone › Forge (`UIFileSharingEnabled` with in-place document opening),
  so backups are visible and easy to copy; iOS deletes it with the app. A backup folder the person
  picks outside the app sandbox (iOS Files via a security-scoped bookmark; Android via a
  persisted Storage Access Framework grant) survives deleting Forge; when it cannot be reached,
  backups fall back to `Documents/Backups`. The live database moves to Library/Application
  Support so it never appears in Files. When the iCloud copy is on (off by default), and
  iCloud Drive is available, the missing objects and the manifest are then copied to the app's
  ubiquity container under `ForgeBackups/`, outside its Documents scope, so the folder is hidden
  from the Files app. iCloud failure or a full iCloud never fails the backup; it is recorded and
  surfaced by the two-week reminder.
- Retention keeps every snapshot from 7 days, the newest per ISO week for 8 weeks and the newest
  per month for 12 months, plus always the latest; unreferenced objects are then swept.
- A restore materializes the snapshot into a copy of the live database (keeping the bundled
  catalogue and device-only rows such as diagnostics and backup bookkeeping), validates it and
  copies it over the live database, after first saving a "Before restore" snapshot. Download
  shares the same materialized database as a `.sqlite` file the existing restore accepts.
- Folder and iCloud access on iOS is a local Expo module (`modules/forge-backup-storage`). Its iCloud entitlements are added by
  its config plugin only when `FORGE_ICLOUD=1`, which the signed workflow sets and the signing
  script then requires on the app profile. Other builds and Android report iCloud unavailable and
  keep local snapshots.

## Consequences

- Weekly automatic backups (on by default) cost a few kilobytes after the first one.
- Snapshot objects follow the SQLite row shapes, so a schema change must keep old snapshots
  restorable (bump `SNAPSHOT_VERSION` and migrate on read if a row shape changes incompatibly).
- iCloud storage counts against the user's iCloud plan, and a new phone must download objects
  before a restore; reads wait for iCloud to bring files down.
- The free-signed build has no off-device copy; it relies on the reminder and manual file export.

## Alternatives considered

- Uploading the whole `.sqlite` file to iCloud each week: simple, but every backup costs the
  full database size and keeping history multiplies it.
- CloudKit records: per-record storage, but needs a schema in the CloudKit console and account
  state handling that file-based snapshots avoid.
- iCloud only: a full or disabled iCloud would mean no backup at all.
- App storage only: simplest, but iOS and Android delete it with the app, which is exactly when a
  backup is needed.
