# Design rules

Durable design guardrails, not a complete design specification. Values live in `src/theme/`.

## Identity and platform

- Keep one Forge visual identity across iOS and Android; do not imitate stock iOS or Material
  because of the platform. Platform differences address behavior, system integration,
  accessibility, input or native capability.
- Apple/Android guidance informs native expectations, modality, input, haptics and system
  integration; it does not override Forge's hierarchy, brand or visual system unless the user
  decides so.
- Do not copy exact visual constants from an external guideline when the platform offers a
  semantic value or Forge already owns the decision.
- Visual screen explorations default to iPhone portrait; they are directional previews, not
  assets or specifications.

## Colour

- Use shared semantic tokens and primitives; never duplicate raw visual values that a token covers.
- Light: pure-white page and header, achromatic grey surfaces and controls, no green or warm tint.
- Dark: a neutral zinc grey ramp with no blue-green cast and ascending elevation
  (`background` < `surface` < `surfaceElevated`); secondary text is a mid grey, not near-white.
- Forge has no brand accent colour; the monochrome hierarchy is deliberate. `actionPrimary` /
  `onActionPrimary` is the only default filled action and `selectionIndicator` the generic
  selected/toggle state.
- Never infer colour from a label: Save, Add, Start, Finish and Done stay neutral, as do Back,
  Close, Cancel, More, Filter, Skip and reversible Hide. Green is for success and the form-completion
  action below, amber for warnings, red for actions that directly delete, remove or discard data.
- The single treatment for a form's final confirmation (header Save, in-form Save, sheet confirm)
  is the success outline with a checkmark when enabled and neutral when disabled; never substitute
  a neutral or primary-filled Save.
- Workout-type colours are data: only small type markers and badges, calendar markers, charts and
  legends, and the type editor/colour selector. Never text, buttons, headers, navigation, checks,
  switches, metrics or large backgrounds. Resolve them through the shared workout-type presentation
  helper so custom colours and built-in fallbacks agree.

## Cards

- Every card is a `ForgeCard`; screens never hand-roll a card's background, border or radius, and
  related rows use the shared grouped card.
- Cards separate by tone, never by outline. Base cards (on a screen or sheet) use `surface` with
  no border; every top-level card looks identical. Nested cards (inside a card) step up to
  `surfaceElevated`, also borderless. Light adds the soft card shadow; Dark relies on tone. In
  Light the base surface is light grey and nested cards are white; sheets are painted the base
  `surface`.
- `border` is the neutral ring for `outline` buttons and the edge of text/search fields (white
  `surfaceElevated` fill in Light, `input` fill in Dark). `divider` is only for hairlines between
  rows inside a card; the floating dock keeps a soft `divider` rim in Light.

## Controls

- Painted controls have a resting fill distinct from their container, resolved from the nearest
  painted container through the shared control-surface context (Light: soft off-white on the page,
  muted tonal inside cards, never stark white; Dark: the elevated/muted steps). Secondary and
  neutral outline buttons, choice rows and stepper groups use that context, never local fills.
  Disabled painted controls keep a distinct neutral fill.
- Button borders match across themes, with Dark as the reference: `outline` keeps its 2 px
  semantic ring (grey, red or green by tone) in both; the "add" affordances (Add exercise, Add
  variation) keep their dashed outline in both; `secondary` is borderless (tone in Dark,
  container-aware tonal fill plus soft shadow in Light); `primary` is solid `actionPrimary`;
  `ghost` is transparent.
- Header actions use `HeaderAction`: icon-only actions are 44 pt circles, labelled pills use
  `controlLabel`, and both stay neutral unless the screen promotes the action or it is directly
  destructive.
- Neutral circular header and sheet controls are borderless in both themes, separate by a
  contrasting tone resolved from their container (never a grey or white ring), and use the frosted
  surface below. Sheet close is `SheetCloseButton`; an in-sheet Back matches it.
- The dock and neutral circular controls use a frosted surface (a `BlurView` plus a dock-tone tint
  film) that is identical on every device. Forge does not use native Liquid Glass /
  `expo-glass-effect`: it rendered inconsistently (iOS 26 only, native edge artifacts). Primary
  filled actions such as the live-workout Finish keep solid `actionPrimary`; destructive and
  success controls keep their semantic surfaces.
- Joined action pills keep their internal vertical separators; each accessible segment fills its
  share and the outer corners clip press feedback.
- Shared switches are presentational; their rows own touch handling, accessibility and haptics.

## Choices and menus

- Finite single-choice lists are one connected rounded group with content-fitting rows, inset
  dividers and a checked row, never separate cards per choice. Distinct records such as workout
  sessions stay separate cards.
- Standalone choices use the Forge selection sheet. A value opened from an existing sheet replaces
  that sheet's content with an internal selection view and an explicit Back.
- Short mutually exclusive choices side by side (7d/30d/90d, Male/Female, Groups/Muscles,
  Left/Right, Info/Progress/History) use `ForgeSegmentedSwitch` with `showLabels`: `standard` fills
  its row, `compact` hugs its labels in card headers with the 15 pt control label and 44 pt
  targets. Never hand-build segment rows; described choices keep the connected list and
  multi-select keeps chips or checkboxes. In Light the track is a distinct neutral with
  primary-colour unselected text. The Appearance switch may use a shorter track with 44 pt targets.
- Dropdowns use `ForgeDropdown`, sized to their options and checkmark within the viewport, with a
  compact appearance in one panel: inset rounded rows, a quiet tonal selected fill, primary text,
  a checkmark and 44 pt targets. The panel separates by an elevated surface, an external shadow
  kept outside the clipped option surface, and a quiet backdrop tint.
- Bottom-attached lists of discrete actions use `ForgeActionSheet` (handle, centred title, 44 pt
  close, grouped neutral icon rows with chevrons; a primary destructive action moves to the header's
  right edge and Close to the left). Never use it for selection lists, pickers, forms, detail sheets
  or confirmations.

## Sheets

- Bottom sheets use the shared Forge sheet for backdrop, handle, dismissal motion, corners, shadow,
  close control and press feedback, with the shared centred-title header and 44 pt circular X
  aligned to the sheet's top-right edge. Sheets may add Back, Save, Delete or Default controls and
  vary only content and height.
- The whole header, title included, is a drag-to-dismiss target. A non-scrolling body is too (wrap
  it in the shared sheet drag area); only a genuine page or list scroller exempts its own area. A
  value wheel is not a scroller: its sheet stays drag-to-dismiss while the wheel spins.
- A sheet body scrolls only when its measured content overflows; fitting content neither bounces nor
  claims the gesture, and overflow stays reachable above the keyboard.
- Backdrop opacity animates in a layer behind the sheet, never on a parent of it. Sheets settle
  without overshoot and their surface extends through the system navigation area.
- With the keyboard open, the sheet moves in sync with it: a short sheet rises just enough to stay
  fully visible with a small gap, a tall sheet expands to the top safe area and keeps scrolling, and
  both restore their height when the keyboard hides.
- Sheets never capture text-selection, caret or suggestion touches to dismiss the keyboard; the
  backdrop, close controls and configured scroll gestures own dismissal. Scroll-body
  drag-to-dismiss yields while the keyboard is visible; header and handle keep theirs.
- On iOS, returning from another app preserves the focused input and keyboard layout: background or
  other-app keyboard notifications never collapse sheets, reset workout scroll or replay an
  unchanged layout. Explicit dismissal and genuinely changed keyboard frames still apply.

## Screens, dock and navigation

- Persistent screen headers stay unlined at every scroll position.
- Scrollable pages extend to the bottom edge and reserve the bottom safe area inside their content,
  never as an opaque strip; primary tabs include the dock clearance there.
- Backgrounds exposed during navigation gestures and transitions follow the active theme, including
  the native root.
- Dashboard, History and Plans empty states share the illustration frame, top anchoring, title
  baseline and primary-action size and position; supporting copy may grow.
- Primary tabs use the persistent Forge tab bar: a short cross-fade (never push or slide) with one
  selection indicator, retapping the active tab preserves its navigation and scroll, and scroll
  bodies run behind the safe area and dock fade with only the dock's reachability inset reserved.
  The dock floats just above the home indicator at its established offset. Dock icons grow subtly
  to a slightly enlarged selected state.
- Android matches iOS: the navigation bar is fully transparent (contrast scrim disabled through the
  `expo-navigation-bar` plugin) with its tint following Forge's appearance. Gesture navigation keeps
  the iOS dock offset; the 3-button bar holds real controls, so the dock floats fully above it.

## Press feedback and haptics

- Every custom interactive control shows a pressed state across its whole visible surface through
  the shared press-state tint layer, following its shape and keeping its colour; content never turns
  translucent, disabled controls show none, and destructive actions keep stronger contrast without
  relying on haptics.
- Standard 44 pt round controls (three-dot menus, header/sheet actions, circular choices) get the
  centred 40 pt circular tint; an inset circle or chip keeps its larger touch target with the tint
  on the visible shape. Joined header segments tint their own segment, bare icon actions use rounded
  local feedback, and painted buttons and full rows match their surface. Drag grips use an inset
  vertical oval around the dots with space to the row, keeping their drag region. Routine-name
  feedback includes the leading type icon and row padding. Chart plots show selection through their
  point and guide, never a rectangular tint. A selector with a label above tints only its value
  button.
- Card-like targets and filter choices inside scrolling content use a short press-recognition delay
  so a drag never leaves them looking selected.
- Each interaction has one haptic owner (the primitive performing it, else the screen). Haptics are
  for discrete causal actions only, never typing, scrolling or continuous gestures.

## Motion

Motion only confirms a direct action, preserves navigation hierarchy or keeps a gesture connected
to its result. Shared presets in `src/theme/motion.ts` own the feedback, state, sheet-settle and
swipe-settle timings. No decorative entrances, staggered reveals, bounce, or motion that delays
repeated entry.

- Tabs cross-fade; drill-in screens use one hierarchy-aware push/pop; shared sheets own their single
  entrance and exit with no nested directional entrance. Gesture-driven sheets and swipes follow the
  finger, then use their shared settle preset.
- `ForgePressable` settles rounded painted surfaces slightly inward while pressed (never below 0.97)
  over the tint. Square full-width rows, grouped segments, disabled controls, backdrops and dock
  tabs (whose feedback is the selection pill and the icon's selected size) do not scale.
- Changing numeric readouts (elapsed and rest timers) use `ForgeRollingNumber`: changed digits roll
  in the direction of change with tabular figures. Never roll static values or first display. The
  rest-timer Live Activity mirrors this with SwiftUI's numeric content transition (iOS 17+); its
  per-second tick is drawn by the system.
- A completed set check traces its stroke (`DrawnCheckIcon`) instead of fading.
- Native layout changes go through `animateNextLayout` (ease-out at the shared durations); never
  configure `LayoutAnimation` presets or ease-in-out curves locally, except a sheet following the
  system keyboard's own curve.
- Dropdown menus enter with a short fade and 0.96 → 1 scale from the corner nearest their trigger,
  never from zero, and close immediately. Confirmation dialogs fade their backdrop while the card
  fades and grows from 0.96, exiting faster than they enter.
- Swipe reveals share `swipeRevealShouldOpen` / `swipeRevealSettle`: a quick flick decides by
  direction before distance, and release velocity carries into the no-overshoot spring.
- State-indicator springs (segmented pills, the dock) never overshoot; reuse the clamped presets.
- Grids and heatmaps are present at once, never revealed as a staggered wave.
- Reduce Motion is the only motion setting: final states apply immediately for scale, lateral,
  spring and layout changes, keeping only short opacity context where a transition would otherwise
  disorient. Haptics, semantics and final states are unchanged.

## Icons

- Every icon renders through the shared `Icon` adapter (Tabler Icons); screens never import another
  icon library. `DrawnCheckIcon` is its only animated glyph.
- Confirm the rendered glyph, never the name: Tabler names mislead (`hourglass` maps to a face,
  `activity` to a running person), so trace the Forge name through `Icon.tsx` to its Tabler
  component and check that glyph. Prefer icons already proven in the codebase.

## Typography

- Product UI uses the semantic type roles and shared text primitives, never raw font values.
  Readable content is at least `label` (13 px); `caption` (12 px) is only for non-essential compact
  metadata. Textual actions use `controlLabel` (15 px) with 44 pt targets, including in compact
  header chrome.
- Titles, section and field labels use sentence or title case, never all caps, except where caps
  carry compact meaning: date rails and calendars, abbreviations such as RPE, units and initialisms
  such as kg or km.
- Text scaling, entity names, headings and wrapping follow the accepted
  [typography requirements](../docs/product/typography.md).

## Accessibility and responsiveness

- Accessibility is correctness, not polish: never rely on colour alone, name icon-only actions, and
  keep touch targets, safe areas, text scaling, keyboard use and reduced motion intact, even when
  that changes layout.
- Keep layouts stable during input and repeated interaction: no focus stealing or surprise
  scrolling.
- Input and navigation never wait on decorative work, full-list mounting or persistence. Back,
  close, tab switches, the header and text input work immediately; heavy screens render their shell
  first and may show a compact in-body loading state. Large content is virtualized or progressively
  prepared. A dismissal takes effect from the interaction itself and never leaves a surface
  capturing input. Background work is coalesced off the input path.

## Device sizing

Forge is authored on the iPhone Air canvas and adapts through `src/theme/scale.ts`: that width and
wider render 1:1, narrower devices scale down (never up). Type, spacing and radii flow through
`moderateScale` via the tokens; component sizes through `scaleUI`; touch targets never shrink below
44 pt. Scaling is native-only, so web and the Playwright profiles render the authored base. Never
hand-author raw dp for sizing that should scale, and never rebase the reference width.
