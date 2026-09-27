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

**Also do not wrap the scroll view in an extra flex `View`.** In the
hug-then-scroll pattern the scroll view must be a **direct child** of the
`ForgeBottomSheet` surface (alongside the handle and header), exactly like
`PreviousSessionsSheet`. Nesting it inside an intermediate `<View style={{
flexShrink: 1 }}>` wrapper breaks the surface→scroll height chain: the wrapper
takes the surface's height and the scroll view no longer hugs its content, so a
tall body (observed on the muscle-balance tile settings) renders full-height with
a large dead gap under the last row. Pass the handle/header/scroll view as direct
children (`ForgeBottomSheet` accepts a plain `ReactNode`, not only a render
function) and give the scroll body its bottom padding via the
`contentContainerStyle`, not an outer wrapper.

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

## `ForgeActionSheet` replacement views must render as direct children

`ForgeActionSheet` hosts multiple views (its action list plus `replacement`
views: note / info / previous-sessions / rest pickers). The reason a scroll
body in a `replacement` view was clipping instead of scrolling — a tall
Exercise-info body with the last card cut off and no scroll — is the direct-child
rule above: `flexShrink: 1` only bounds a scroll view when its parent chain has a
**definite** height. The surface has one (its `maxHeight`), but the action
sheet's own `<View style={styles.sheet}>` wrapper *and* a caller's per-view
`<View key={view}>` transition wrapper both **hug**, so they never pass a
definite height down. The scroll view then grows to its content and the surface's
`overflow: hidden` clips it — it cannot scroll.

Fix, applied here:

- `ForgeActionSheet` renders a `replacement` **directly** (`replacement(close)`),
  not wrapped in its `styles.sheet` view. Only the default action-list path keeps
  that wrapper. So a replacement's handle / header / scroll view are direct
  children of the surface, exactly like the single-view `ForgeBottomSheet`
  sheets. Each replacement view therefore owns its **own bottom clearance** (its
  scroll `contentContainerStyle` padding), since it no longer inherits the
  wrapper's `paddingBottom`.
- The per-view transition wrapper is a **keyed `React.Fragment`**
  (`<React.Fragment key={view}>`), not a `<View>`. A keyed fragment still
  remounts the view on change (for the cross-fade) without inserting a hugging
  wrapper that breaks the height chain.
- Do **not** stack bottom padding. Exercise-info content came from the shared
  `ExerciseDetailBody`, whose `detailContent` already carries a `paddingBottom`;
  inside the sheet that stacked with the scroll padding into visible dead space.
  `ExerciseDetailBody` now takes a `bottomPadding` override so the hosting sheet
  can collapse it and provide clearance once, via the scroll container.

## Scroll only when the body overflows

A `flexShrink: 1` scroll body that fits its viewport should not rubber-band. Set
`scrollEnabled` from a measured comparison — `contentHeight > viewportHeight`
via `onContentSizeChange` and `onLayout` — so a short Exercise-info card is
static and only a genuinely tall one scrolls. `ExerciseInfoContent` does this.
