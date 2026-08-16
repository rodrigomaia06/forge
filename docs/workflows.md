# Workflows

## Live workout

The live workout keeps exercise rows, set entry, previous results, notes, rest timing, and interruption
recovery on one stable flow. Adding an exercise selects one exact UUID. Selection and persistence must not
duplicate actions or move the list unexpectedly.

## Routines

Routines are editable templates. Adding, reordering, and removing exercises must preserve exact UUID links
and use the same deletion affordance as other exercise lists. A routine can start a live workout without
rewriting the routine.

## Calendar entry

Selecting today or a past day opens `Add workout` with two paths: `From routine` or `Blank workout`. A
routine path copies exercises and sets into an editable workout. A blank path starts without exercises.
The user sets start and end times manually, then opens the workout editor as a draft. The draft keeps
incomplete routine sets valid while exercises are added or edited, stays out of the live stopwatch view,
and becomes a completed history entry only when `Finish` is tapped. Future workout scheduling is not
supported yet.

## History

History opens exact workouts and exact exercise variations. Editing a historical record preserves its UUID,
date, ordering, and entered values unless the user explicitly changes them.

## Custom exercises

Custom exercises can be created, edited, hidden, and deleted through the exercise settings flow. Duplicate
structured identities should resolve to the existing exercise. Deletion must respect routine and history
protection and must not remove data silently.

## Backup and import

Create backups before destructive replacement. Validate the complete import before changing the active
store. If restore or import fails, keep the current data and explain the recovery action. Confirm backup
creation and restore only after the file operation succeeds.
