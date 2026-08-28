# Settings

- Settings replaces the More destination in Forge's primary dock.
- Primary dock roots do not expose edge-swipe back to a previously visited destination; edge-swipe navigation is reserved for nested screens with an explicit Back path.
- Settings is a local-preferences hub. Exercises provides a searchable built-in library with a collapsible category filter. Workout types use compact visible/hidden lists, source signals (Forge-provided seal or custom pencil), header add/edit actions, and a dedicated editor with named colors plus a validated custom hex color. Built-in or referenced types are hidden, while unused custom types may be deleted; existing workouts retain their saved type text.
- Backup & Export, Logs, and About remain local-only destinations until their respective data tools are implemented. Settings does not introduce authentication, remote logs, or a database connection.
- General preferences persist locally and expose Light appearance, Metric as the default future unit, and a Monday/Sunday first day of week. Changing the first day of week immediately changes the Calendar; preferences do not convert recorded workout data.
