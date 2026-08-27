# Live Workout

- The bottom navigation dock may compact while the Live Workout content is scrolled, but must remain visible, restore its full size when touched, and transition continuously when navigating to another tab. It remains visually separated from the bottom system indicator with a light lower fade.
- The Live Workout list must reserve enough bottom space for the persistent dock so the `Add exercise` action remains reachable after adding many exercises.
- Elapsed and rest timers derive from timestamps and refresh together once per second; active-workout persistence is debounced during ordinary edits, while finishing or cancelling remains immediate.
- Sets and exercise cards reveal compact contextual delete actions with a left swipe; the action remains hidden in the resting state.
- The Add exercises picker dismisses its keyboard when its list is touched or dragged, without preventing the requested list action.
