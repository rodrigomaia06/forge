# Interaction principles

## Active Workout

Active Workout is a persistent, auto-saved session. It survives app closure, backgrounding, interruptions, and device restarts and resumes exactly where the user left it.

Only one active unfinished workout exists at a time. It remains separate from completed History and is clearly presented as Resume Workout. Starting another workout requires the user to resume, finish, or discard the current one; it is never silently replaced.

The user may leave the workout and browse the rest of the app. A compact “Workout in progress” bar above the main navigation remains visible where appropriate and provides a fast return path.

## Live workout layout

- Open directly into the workout.
- Use a continuous scroll with all exercise sections visible.
- Keep the layout stable after every interaction.
- Do not auto-scroll or steal input focus after set completion.
- Show the current exercise, previous performance, current set table, next relevant set, workout elapsed time, and rest status without excessive density.
- Keep Finish clearly reachable without requiring a long scroll.

## Set logging

Weight and reps are visible inline within each set row. Tapping either opens a focused numeric editing surface with the keyboard and convenient increment/decrement controls.

Entering values does not complete a set. A set requires an explicit completion action, which produces an immediate visible state change and subtle haptic feedback where supported. Status must also be understandable without color.

After completion, the next set of the same exercise can be visually emphasized, but the viewport and focus remain stable.

Users can add, remove, reorder, or skip exercises and sets, and change weights, reps, or targets during the session without feeling they violated a plan.

## Rest timer

The rest timer is a compact control inside the Active Workout header, not a bottom-anchored timer and not a takeover screen.

- Inactive: show a timer icon/control.
- Running: show remaining time with stable monospaced numerals.
- Tapping: open a compact timer surface.
- Inactive surface: choose a duration and explicitly press Start; remember the last duration when practical.
- Running surface: show a large countdown, simple progress, -10s, +10s, and Stop Timer.
- Expired timer: remain available with +30s and +1 min extensions.

The timer is always user-controlled and never interrupts logging.

## Completion and history

Finishing saves the workout and gets out of the way. A brief optional summary may show duration, exercises, sets, volume, and PRs. If planned work is incomplete, provide a lightweight confirmation but never force completion.

Historical entry should reuse the same workout model as live workouts and support date, duration, exercises, sets, weight, and reps. Completed workouts remain editable for corrections.

## Accessibility and platform quality

- Minimum generous touch targets: design toward at least 44pt/48dp where platform guidance differs.
- Support scalable text where practical.
- Provide VoiceOver and TalkBack labels.
- Support reduced motion without losing state meaning.
- Use sufficient contrast and non-color state indicators.
- Handle safe areas, system bars, edge-to-edge insets, keyboards, and one-handed reach.
- Use gestures as optional shortcuts only; every important action has a direct control.

