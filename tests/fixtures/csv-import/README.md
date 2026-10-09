# CSV import samples

These five small samples were supplied by the user on 2026-10-09 from a downloaded
internet fixture set. The original source URL and producing app versions were not
provided. Treat them as regression examples, not proof of every app's export format.
The files retain their supplied bytes, including CRLF line endings.

Unit tests check ordering, measurements, dates and session counts. Browser tests
use the same files for detection and exercise-review captures. Separate fixtures
cover documented FitNotes headers and units, malformed records, locale choices,
mixed measurements and save recovery.
