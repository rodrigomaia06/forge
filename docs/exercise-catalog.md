# Exercise catalog

## Identity model

An `Exercise.uuid` identifies one exact variation and remains the identity used by workouts, routines,
history, charts, personal records, rest timers, hidden state, and imports. Never merge or delete an
existing UUID merely because two exercises have similar names.

Exercises are grouped for browsing by a stable `movementID` and `movementTitle`. Structured variation
fields describe equipment, attachment, setup, grip, side, and load mode. Normalized tags support search
and filtering. Free-form manual values are searchable but are not global filter options.

## Browsing

Show a movement once in the main picker and settings lists. A single exact variation can be added or
opened directly. A movement with multiple combinations opens a compact configurator. The configurator
shows equipment first, then only compatible attributes. It may resolve an existing exact UUID or create
a custom variation with inherited metadata. The main list should not show a variation count.

Search matches movement titles and aggregated exact-variation metadata, including aliases and normalized
tags. Filter controls must use options present in the visible catalog and must not expose arbitrary
manual values as global choices.

## Display labels

Display labels are metadata, not identity. Prefer a movement title followed by only the details needed to
distinguish the exact variation, such as `Dumbbell, Incline, Hammer grip`. Do not repeat the movement
title in the variation subtitle. Suppress implicit details that add no meaning, such as `Rope` on `Jump
Rope`; preserve a real attachment such as `Cable, Rope` on a cable exercise.

## Catalog hygiene

Audit the complete catalog when fixing a representative naming issue. Normalize capitalization, aliases,
equipment terminology, duplicate movement names, and noisy setup labels together. Keep a canonical
navigation identity for visually duplicated entries without changing UUIDs. Add weighted or assisted
variants only where the movement supports that load mode.

## Custom exercises

Custom creation should use the same movement and structured variation identity as built-ins. Equipment is
variation metadata, not a second tracking-type classification. The default metric remains separate and
describes whether the exercise is measured by reps, duration, distance, or RPE.
