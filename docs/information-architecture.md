# Information architecture

## Primary navigation

The permanent navigation has four destinations:

1. Dashboard
2. Plans
3. History
4. More

There is no Today tab, permanent Workout tab, or primary Exercises tab.

Active Workout is persistent application state above normal navigation, not a fifth tab.

## Dashboard

Dashboard is the main home surface and a polished training archive. Its dominant element is a month calendar.

Responsibilities:

- Show a prominent month grid.
- Mark completed workout days with restrained indicators.
- Allow day selection.
- Show selected-day workout entries inline below the calendar.
- Show recent or relevant training context without becoming an analytics dashboard.
- Provide a prominent start/add action.
- Make Resume Workout dominant whenever an active session exists.
- Eventually support full historical workout entry on a selected date.

The app does not currently schedule future workouts. Users start routines on demand.

## Starting a workout

The Dashboard start/add action offers:

- Blank workout.
- Routine from the Routines library.
- Routine contained in a Plan.

Starting a workout opens directly into Active Workout with no overview step.

## Plans

Plans is a segmented destination with Plans as the default segment and Routines directly accessible as the second segment.

- A Plan organizes multiple Routines.
- A Routine is a reusable workout template.
- A Routine may belong to multiple Plans.
- Routines can be created manually, edited, duplicated, started, or created from a completed workout.
- Routines are starting structures, not strict prescriptions.

## History

History answers: “What exactly did I do?”

It is a chronological list of completed workouts showing date, name/type, duration, and a compact exercise/set summary. Opening an item shows a summary first, then complete exercise sections and set-by-set detail. Completed workouts can be intentionally edited to correct recording mistakes and can be converted into routines.

## More

More is an organized collection of lower-frequency features, not one undifferentiated settings list.

Substantial destinations:

- Exercises.
- Data Management, including import/export.

Grouped preferences:

- Settings.
- Units.
- Appearance.
- Other secondary tools.

Exercises is reachable from More, routine editing, adding an exercise during a workout, workout history, search, and previous-performance views.

## Active Workout boundary

When a workout starts from a Routine, it becomes an independent snapshot. Later changes to the source Routine or Plan affect future workouts only. Changes to the current session happen inside Active Workout only.

The user may browse and edit Plans and Routines while a workout is active; those edits never silently synchronize into the active snapshot. An explicit “apply to current workout” action may be considered later, but automatic synchronization is not allowed.

