# ADR 0005: Forge sheet scroll sizing and content transitions

Status: Accepted
Date: 2026-09-17

## Context

`ForgeBottomSheet` (and `ForgeActionSheet`, which wraps it) is a bottom-anchored
sheet whose surface **hugs its content** and is capped by
`maxHeight: windowHeight - insets.top`. Several sheets host a scrollable body
(Previous Sessions, the routine chooser, the Add-exercise catalogue). Getting a
scrollable body to size correctly inside this hugging surface has been gotten
wrong more than once — each time producing either a body that will not scroll or
a large block of dead space under the content. This ADR records the correct
patterns so the mistake stops recurring.

## The two correct patterns

Pick one; do not mix them.

### 1. Hug-then-scroll (the sheet is as tall as its content, up to full screen)

Use when the sheet should be short for little content and only grow/scroll once
the content exceeds the screen (Previous Sessions, the routine chooser).

- The scroll view gets **`flexShrink: 1` and nothing else** — no `height`, no
  `maxHeight`, no `flex: 1`.
- The `ForgeBottomSheet` surface's own `maxHeight` is the bound. While the
  content fits, the surface hugs it and the list shows in full. Once the content
  would exceed the surface cap, the surface is at a definite height, so
  `flexShrink` shrinks the list and it scrolls.

Reference: `DashboardRoutineSourceContent` in `DashboardParts.tsx`
(`sourceScroll: { flexShrink: 1 }`) and `PreviousSessionsContent` in
`ExerciseOptionSheets.tsx` (`previousSessionsScroll: { flexShrink: 1 }`).

### 2. Always-full (the sheet is a fixed tall card; the list fills it)

Use when the sheet should always be a full-height card regardless of content
(the Add-exercise catalogue).

- The sheet content wrapper gets a **definite height** (e.g. `height: '92%'`).
- The list inside gets **`flex: 1`** to fill that definite height.

Reference: `AddExerciseSheet` in `WorkoutSheets.tsx`
(`pickerSheet: { height: '92%' }`, `pickerList: { flex: 1 }`).

## The mistake to never repeat

**Do not put `maxHeight` (or a fixed `height`) on the ScrollView itself in the
hug-then-scroll pattern.** A `maxHeight` on the scroll view makes React Native
size the scroll view to that max height rather than to its content, so a short
list renders inside a tall viewport and leaves a large dead gap beneath the last
row (observed as a ~250px gap under Previous Sessions). It also does **not** make
a long list scroll — only the surface cap does. The surface already provides the
bound; the scroll view must stay content-sized via `flexShrink: 1`.

Measuring the content with `onContentSizeChange` and setting an explicit height
was also tried and is worse: it fights the surface layout and still gapped.

## In-sheet content transitions: animate the surface, not with LayoutAnimation

`animateSheetContent` uses RN `LayoutAnimation`, which does **not** ease the
height change of the Reanimated `Animated.View` surface inside the native
`Modal` — so the option-view swaps (`key={view}` remounts) snapped, regardless
of the configured duration. Raising that duration does nothing; it is left in
place only for the incidental opacity of mounting rows.

The height change is instead eased with a **Reanimated `layout` transition on
the sheet surface**, behind the `ForgeBottomSheet` prop `animateContentLayout`
(off by default). `ForgeActionSheet` enables it — but only when it does *not*
`waitForContentLayoutBeforeEnter`, because those sheets re-measure just after
mount and that post-mount layout change would otherwise animate on open.

Animate the **surface**, not the content wrapper: the surface hugs its content,
so a `layout` transition on the content wrapper would let the surface jump to the
final height while the content eased inside it. The surface's own `overflow:
hidden` clips the content cleanly while the surface height eases.
