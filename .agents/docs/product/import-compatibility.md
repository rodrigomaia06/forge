# Import from another app: compatibility matrix

Required by issue #18. Import flow behaviour (source rows, review, conflicts, atomic save) is
specified in `settings.md`; this file records which source export variants Forge accepts, how
each source field maps, and what is not imported.

## Evidence levels

- **User sample**: the anonymized files in `tests/fixtures/csv-import/` (supplied 2026-10-09;
  producing app versions unknown).
- **Published description**: built from public format descriptions (help pages, migration
  guides, open-source importers), *not yet verified against a real export*. Fixtures in
  `tests/fixtures/import-compat/` follow these descriptions.

Compatibility for a published-description variant is not claimed as verified until the sample
named in its row has been checked.

## Supported variants

| Source | Variant | Evidence | Sample that would confirm it |
| --- | --- | --- | --- |
| Hevy | Comma CSV, `weight_kg`/`distance_km` columns, `"14 May 2024, 17:30"` dates | User sample | — |
| Hevy | Imperial account: `weight_lbs` / `distance_miles` columns (kg column preferred when it has a value) | Published description | Hevy export from an account set to lbs and miles |
| Hevy | ISO timestamps, localized month names in dates | Published description | Hevy export from a non-English device locale |
| Strong | Classic comma CSV: `Duration` as `1h 5m`, unitless `Weight`/`Distance` (Forge asks for units) | User sample | — |
| Strong | All-quoted semicolon CSV: `Workout #`, `Duration (sec)`, `Weight (kg)`/`(lbs)`, `Distance (meters)`, decimal comma | User sample | — |
| Strong | `Rest Timer` rows (skipped and counted) and `Note` rows (exercise notes) in `Set Order` | Published description | Current Strong export with rest timers and exercise notes |
| Strong | `W`/`D`/`F` set orders → Warm Up / Drop Set / Failure | Published description | Strong export with tagged sets |
| Strong | Semicolon CSV with `Weight Unit` / `Distance Unit` columns (`lbs`, `mi.`) | Published description | Strong Android export |
| Strong | `Distance (km)`, `(miles)`, `(feet)` and `Duration (min)` headers | Published description | Strong export using those units |
| FitNotes Android | `Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time[,Comment]`, `kgs`/`lbs` | User sample + published description | FitNotes 25.x export including a comment |
| FitNotes iOS | `Weight (kg)` / `Weight (lbs)` columns, `Notes`, `Kind` | User sample | — |
| Strive (Strive Workout Log, iOS/Android) | SQLite database export (`.db`/`.sqlite`) with `routine_logs`, `routine_exercise_logs`, `routine_exercise_set_logs`, `exercises`; routines optional | Schema from the existing Forge reader; no public documentation exists | A current Strive database export from each platform |

All CSV variants: UTF-8 with or without BOM, CRLF or LF, quoted fields with embedded
delimiters, quotes and newlines, comma or semicolon delimiters, decimal comma, ambiguous
numeric dates (Forge asks for date order), unit spellings `kg`/`kgs`/`lb`/`lbs`/`lbs.`/`mi`/
`mi.`/`miles`/`m`/`meters`/`km`/`ft`/`yd`/`in`.

## Field mapping

| Forge field | Hevy | Strong | FitNotes | Strive |
| --- | --- | --- | --- | --- |
| Workout name | `title` | `Workout Name` | none (“FitNotes workout”) | `routine_logs.name` |
| Start / end | `start_time` / `end_time` | `Date` + `Duration` | date only | Unix seconds |
| Session identity | name + start | `Workout #`, else date + name | date | source UUID |
| Workout note | `description` | `Workout Notes` | none | unpinned routine notes |
| Exercise note | `exercise_notes` | `Note` rows | none | exercise log notes |
| Set comment | none | `Notes` | `Comment`/`Notes` | none |
| Weight, reps, distance, duration, RPE | yes (kg/lb, km/mi, sec) | yes (unit from header, unit column or user choice) | yes | yes (unit flags) |
| Set type | `set_type` | `Set Order` letters / `Set Type` | `Kind` (iOS) | `type` |
| Supersets | `superset_id` | none | none | `superset_with` |
| Routines | no | no | no | active routines as standalone routines |

Source ordering of sessions, exercises and sets is preserved. Unrecognized source columns are
kept as import metadata on each set.

## Not imported

- Strong rest timers (reported as skipped rows), Strong notes for exercises with no sets in
  that workout (reported), Strong measurements CSV.
- Hevy routines, body measurements and API data; Hevy `set_type` numeric codes are untested.
- FitNotes `.fitnotes` backups (app database, not a documented export), body weight log,
  separate same-day FitNotes sessions (grouped by date).
- Strive plan schedules, deleted routines, progression rules, global/pinned notes,
  measurements, photos, preferences, PDF reports and Pro routine-sharing files.
- Localized CSV headers (non-English app language): rejected with a prompt to switch the app
  to English and export again.
- Spreadsheet-resaved or hand-edited CSVs whose headers no longer match a variant above.
- JEFIT, Apple Health, Garmin and other apps.
