# Three exercise menu layouts

Exactly three static dark-mode proposals generated with [Stitch](https://stitch.withgoogle.com/projects/2465919600819940379). These explore the exercise three-dot popup only; they do not change application code or navigation.

1. **Anchored menu**: a narrow floating panel beneath the three dots preserves workout context and keeps actions close to their trigger.
2. **Flat sheet**: a full-width bottom sheet puts all seven actions directly on one surface, with one consistent reading order.
3. **Grouped sheet**: a mixed tile/list layout separates actions by purpose: Log & setup (Tracking, Add note, Warm-up sets), Review (Previous sessions, Exercise info), and Change exercise (Replace exercise, Mark off-session).

All retain Remove exercise. In the anchored menu it is a separate destructive row; in the sheets it is the header trash action.

| Concept | iPhone Air | Galaxy S24 | HTML |
| --- | --- | --- | --- |
| 1. Anchored menu | [Image](1-anchored-menu.iphone-air.png) | [Image](1-anchored-menu.samsung-galaxy-s24.png) | [Preview](1-anchored-menu.html) |
| 2. Flat sheet | [Image](2-flat-sheet.iphone-air.png) | [Image](2-flat-sheet.samsung-galaxy-s24.png) | [Preview](2-flat-sheet.html) |
| 3. Grouped sheet | [Image](3-grouped-sheet.iphone-air.png) | [Image](3-grouped-sheet.samsung-galaxy-s24.png) | [Preview](3-grouped-sheet.html) |

Shared visual decisions: Forge's dark neutral palette preserves identity and gives overlays tonal depth; Manrope matches the app's typography; 44 px minimum targets support touch use; spacing expresses either a continuous list or meaningful purpose groups. Red is reserved for removing the exercise. ENERGY 1 / RHYTHM 2 / MOTION 1.

The active-workout backdrop uses demo data. These are visual references, not working exercise flows. HTML previews may require Internet access for fonts and Tailwind. Original Stitch exports use `.stitch.png`; phone-profile renders are supplied separately.

## Visual review

- Scope PASS: exactly three screens returned by Stitch, each retaining the seven actions and Remove exercise; no app source changed.
- Layout PASS: all six phone renders inspected; document width matches the 420 px and 360 px viewports, with all action labels visible.
- Hierarchy PASS: floating narrow panel, ungrouped full-width sheet, and mixed tiles/grouped rows have distinct silhouettes and reading patterns.
- Purpose PASS: the three groups express logging/setup, reviewing information, and changing the exercise. Palette, type, spacing, and surface decisions are explained above.

Rendered using `npm run verify:run -- node /tmp/forge-render-menu-layouts.cjs`. These checks assess appearance only; exercise actions, native gestures and accessibility interactions were not validated.
