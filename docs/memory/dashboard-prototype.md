# Dashboard prototype

Status: first visual prototype for review.

This prototype is intentionally limited to the Dashboard and uses mock data. It exists so visual feedback can guide the next iteration before the rest of the product is implemented.

Included:

- Dashboard header with integrated start/add action.
- Month calendar with completed-workout markers and selected-day state.
- Inline selected-day workout list.
- Empty selected-day state with historical-entry action.
- Restrained recent training context.
- Five-position navigation: Dashboard, History, centered Workout action, Plans, More.

Not yet included:

- Active workout behavior.
- Real persistence or data model.
- Plans, History, More, and modal flows.
- Dark theme.
- Historical workout entry.

The prototype should be judged visually and interactively first. Product and implementation details should only expand after the visual direction has been reviewed.

## Anti-AI review pass

The current prototype avoids generic generated patterns by using direct labels, a labeled `Start` action, a calendar-led composition, flat workout rows, restrained markers, and separated training context instead of a metrics card. It intentionally has no gradients, glass, decorative hero, repeated card grid, motivational copy, streaks, badges, or celebration animation.
