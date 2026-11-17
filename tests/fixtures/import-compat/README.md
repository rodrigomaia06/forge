# Import compatibility fixtures

Anonymized files written from published format descriptions (help pages, migration guides and
open-source importers), not copied from real exports. They are not yet verified against real
exports; `.agents/docs/product/import-compatibility.md` names the sample that would confirm each
variant.

- `hevy-imperial.csv` — `weight_lbs`/`distance_miles` columns, multiline description, superset,
  set types, custom exercise, cardio in miles.
- `strong-rest-timer-semicolon.csv` — all-quoted semicolon layout with `Rest Timer` and `Note`
  rows, `W`/`F` set orders, decimal comma, metre distances and a note for an exercise without sets.
- `strong-unit-columns.csv` — semicolon layout with `Weight Unit`/`Distance Unit` (`lbs`, `mi.`).
- `fitnotes-android-units.csv` — `kgs`/`lbs` unit values, `h:mm:ss` times, two dates.
- `strong-localized-headers.csv` — German headers, expected to be rejected with guidance.
- `strong-malformed-rows.csv` — invalid weight, short row and a session with only rest rows.
