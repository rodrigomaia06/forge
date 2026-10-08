# Design rules

These are durable implementation/design guardrails, not a complete product design specification.

## Shared Forge identity

Forge should keep one coherent visual identity across iOS and Android. Do not make the app visually imitate stock iOS or Material solely because it runs on that platform.

Use platform-specific behavior where it improves system integration, accessibility, input, navigation expectations, or native capability.

## Semantic design system

Use shared semantic tokens and reusable primitives for recurring color, typography, spacing, shape, and interaction roles. Avoid duplicating raw visual values across feature components when a shared semantic value already exists.

Finite single-choice lists use the shared Forge selection primitives. Standalone choices use the Forge selection sheet; a value opened from an existing sheet replaces that sheet's content with an internal selection view and provides an explicit Back path to the prior content.

Icon-only dismiss and navigation header actions use the shared 44 pt circular overlay surface, pressed state, haptic feedback, and accessible name. Circular sheet/header controls are borderless in both themes: they separate by a tonal surface lighter than the header (the raised-control tone — `surfaceElevated` in Light, `surfaceMuted` in Dark), never a grey/white ring. Sheet close controls use `SheetCloseButton`, the same-sized neutral circle matched by an in-sheet Back action.

**Button borders match across themes: a button outlined in Dark is outlined in Light too.** Dark is the reference. The `outline` variant keeps its 2px semantic ring in *both* themes — grey (`border`), red (`textDestructive`) or green (`success`) by tone — and the "add" affordances (Add exercise, Add variation) keep their dashed outline in both. The deepened Light `border` token is what makes the neutral ring visible there. `secondary` is borderless in both themes: Dark separates it by tone, Light by its elevated/tonal fill (`surfaceElevated` neutral / `destructiveSurface` / `successSurface`) plus the soft card shadow. `primary` is the solid `actionPrimary` fill, `ghost` is transparent, and circular sheet/header controls are borderless in both themes (the rule above). Colour still carries meaning on the tonal fills (soft red = destructive, soft green = success). When adding button work, keep Light and Dark borders in step rather than diverging them.

Bottom-attached modal sheets use the shared Forge sheet presentation for their backdrop, drag handle, dismissal motion, corner treatment, shadow, close control, and pressed feedback. Their header uses the shared centred-title shell and 44 pt circular X dismiss control; the X aligns to the shared top-right sheet edge regardless of any content inset. The complete header zone—including the title—is always a drag-to-dismiss target. When a sheet's body does not scroll, the whole card is a drag-to-dismiss target as well (wrap the non-scrolling body in the shared sheet drag area), so a non-scrolling card dismisses from anywhere on it. Only a genuine page/list scroller exempts its own area, so the dismiss gesture never competes with the scroll. A value wheel is not a page scroller: a wheel picker stays drag-to-dismiss (its header and surrounding card dismiss; the wheel itself still spins). Specialised sheets may add Back, Save, Delete, or Default controls without replacing that shell. Backdrop opacity is animated in a layer behind the sheet, never on a parent that would make the sheet transparent; bottom sheets settle at their snap point without overshoot and their surface extends through the system navigation area. When a sheet input opens the keyboard, the shared sheet synchronizes its animation with the keyboard. A short sheet rises only far enough to remain fully visible above the keyboard with a small breathing gap; a taller sheet expands to the top safe-area inset and its content must remain scrollable. Both retain normal rounded upper corners and restore their compact height when the keyboard hides. Individual sheets may vary only their content and height.

Every persistent screen header above vertically scrollable user content shows the shared `HeaderEdge` only after the content passes beneath it; non-scrolling and top-of-content states remain unlined. Card-like press targets and filter choices inside scrolling content use a short press-recognition delay so a drag never leaves a control looking selected.

Bottom-attached lists of discrete actions use `ForgeActionSheet`. It owns the handle, semantic centred title, 44 pt close control, grouped neutral icon rows with chevrons, and promotes the primary destructive action to the header's right edge while moving Close to the left. Do not use it for radio/selection lists, pickers, forms, detail sheets, or confirmation dialogs; those retain their specialised primitives and semantics.

When a text keyboard is visible in a shared sheet, the first tap elsewhere in the sheet dismisses it instead of activating the tapped control. Number-pad editing in Live Workout remains exempt so repeated set entry is uninterrupted.

Use the shared grouped-card primitive whenever a feature presents related rows. It owns the common surface, border, radius, and shadow treatment in both themes; screens may not recreate a locally divergent card outline.

### Card separation contract

Card surfaces separate from their container by tone first, not by outline. Every card uses the shared `ForgeCard`; screens never hand-roll a card's background, border, or radius. A card has exactly one of two treatments, chosen by its container, in both themes:

- **Base** (default): a card sitting on a screen background or on a sheet. It uses the base card surface (`theme.surface`) with **no border** — its tone alone separates it (lighter/raised over a dark page, darker/recessed on an elevated sheet), carried by the soft card shadow in Light and pure tone in Dark. Every top-level card — History rows, Dashboard cards, Settings sections, Plans cards, live-workout exercise cards, summary cards — is a base card and looks identical.
- **Nested**: a card placed *inside* another card. It steps one tone up (`theme.surfaceElevated`) and is **borderless like the base card**, separating by tone in **both** themes — Light and Dark each give `surfaceElevated` a distinct step above `surface` — reinforced by the soft card shadow in Light. It never shows a grey outline.

Both themes use a real elevation ramp (page `background` < base `surface` < `surfaceElevated`), so borderless surfaces separate by tone, not outlines. In Light, `border` and `surfaceMuted` are deepened enough to read against the compressed page tones (a near-page `border`/`input` left fields and controls invisible); Dark's tones are unchanged. Bottom sheets are painted the base `surface`, so elevated controls and nested cards (`surfaceElevated`) read against them. Borders never define a card — base or nested. In Light, `theme.border` is the neutral ring tone for `outline` buttons (see the button rule above) and the edge for text/search fields, which also take an elevated (`surfaceElevated`) fill so they read on the page; `secondary` and circular controls stay borderless. In Dark those fields keep their `input` fill. `theme.divider` is reserved for hairline separators *between rows inside* a card, never a card's own outline, and a card border is never a hardcoded colour. The deepened Light `border` is for fields, not chrome: the floating dock keeps a soft rim (`divider` in Light), not the field border.

Controls use a monochrome neutral hierarchy by default. `actionPrimary`/`onActionPrimary` are the only default filled-action treatment, and `selectionIndicator` is the monochrome generic selected/toggle state. The `outline` variant keeps its semantic ring in both themes; `secondary` is borderless and tonal (per the button rule above). Do not infer colour emphasis mechanically from labels such as Save, Add, Start, Finish, or Done; these actions remain neutral. An enabled final confirmation action in an add/edit form may use the success-outline treatment with a checkmark to make the ready-to-submit state explicit (a soft success surface with a green ring, in both themes); its disabled state remains neutral. This success-with-checkmark is the single shared treatment for that final form-completion action wherever it appears — an edit screen's header Save, an in-form Save button, or a sheet's confirm — so completing a form reads identically across editors; do not substitute a neutral or primary-filled Save for it. Green is reserved for success states and this explicit form-completion affordance, amber for warnings, and red for destructive actions that directly delete, remove, or confirm discarding data. Back, Close, Cancel, More, Filter, Skip, and reversible Hide remain neutral.

Workout-type colours are data, not chrome. They may appear only in small type markers and badges, calendar markers, charts and legends, and the workout-type editor or colour selector. Do not use them for text, buttons, headers, navigation, checks, switches, metrics, or large decorative backgrounds. Resolve type-marker presentation through the shared workout-type presentation helper so saved custom colours and built-in fallbacks remain consistent.

Header actions use `HeaderAction` only: icon-only controls are 44 pt circles and labelled pills use `controlLabel`. Their surface remains neutral unless the screen explicitly promotes the action or the action is directly destructive. Shared switches are presentational; their containing rows own touch handling, accessibility, and any haptic feedback.

Dashboard, History and Plans empty screens share the same illustration frame, top anchoring and title baseline. Empty-state primary actions use the same dimensions and vertical position; supporting copy may grow when text scaling or wrapping needs more space.

Primary dock icons use the shared navigation item and animate subtly between their standard size and a slightly enlarged selected state.

Primary dock tabs use the persistent Forge tab bar. They cross-fade through the shared short tab transition rather than using a push or lateral slide, while a single local selection indicator moves to the active item. Retapping the active tab preserves its current navigation and scroll position. Their scroll bodies extend behind the lower system safe area and dock fade; only the dock's reachability inset is reserved, never a separate empty tab-bar band. The dock floats just above the home indicator at its established offset; keep that placement.

The dock and neutral circular header/sheet controls use a **frosted surface** — a `BlurView` plus a soft dock-tone tint film — for a glass-like feel that is identical on every device (iOS and Android). Forge does **not** use native Liquid Glass / `expo-glass-effect`; a real-glass rollout read inconsistently (iOS-26-only, native edge artifacts), so the frosted blur is the deliberate cross-platform treatment. Primary filled actions (e.g. the live-workout Finish check) keep their solid `actionPrimary` fill rather than a frosted surface, so the icon never vanishes into the backdrop; destructive/success controls keep their semantic surfaces. (The iOS 16.4 deployment target is still pinned — it is required by the native rest-timer Live Activity pod, not by any glass dependency.)

## Motion

Forge motion is quiet and purposeful: use it only to confirm a direct action, preserve navigation hierarchy, or keep a gesture physically connected to its result. Shared motion presets own the 120 ms feedback, 160–180 ms state transition, no-overshoot sheet settle, and direct-manipulation swipe settle. Do not add decorative entrances, staggered content reveals, bounce effects, or motion that delays repeated task entry.

Tabs retain a short cross-fade and selection indicator; drill-in screens use one hierarchy-aware push/pop transition; shared sheets own their single entrance/exit and must not add a nested directional entrance. Gesture-driven sheets and destructive-row swipes follow the finger, then use the corresponding shared settle preset.

Respect the operating system Reduce Motion preference without a separate Forge setting. In that mode, use immediate final states for scale, lateral, spring, and layout changes; retain only short opacity context where a screen or sheet transition would otherwise be disorienting. Haptics, semantics, and final interaction states must be unchanged.

Across all vertically scrollable pages, including nested settings, details, and editors, the scroll viewport extends to the bottom screen edge. Reserve the bottom safe area inside the scrollable content so the final control can clear the home indicator; do not create an opaque safe-area strip outside the scroll viewport. Primary tabs include their floating dock clearance in that trailing space.

Backgrounds exposed behind pages during navigation gestures and transitions must follow the active Forge theme, including the native app root.

All application icons are rendered through Forge's shared `Icon` adapter, backed by Tabler Icons. Choose the icon semantically for the action or content it represents; screens must not import a separate icon library directly.

When choosing or changing an icon, confirm the actual rendered glyph — never select by name alone. Tabler names routinely mislead (`hourglass` maps to a mood/face glyph; `activity` renders as a running person), so map the intended Forge name through `Icon.tsx` to its Tabler component and verify that component's real glyph before using it. Prefer icons already proven correct in the codebase.

Visual screen explorations use iPhone portrait format by default unless a task explicitly calls for a different target. They are directional previews rather than app assets or implementation specifications.

Do not copy exact visual constants from an external design guideline when the platform provides a semantic/system value or Forge already owns that visual decision.

## Typography

Use Forge's semantic type roles and shared text primitives rather than raw font values in product UI. Readable content must use at least the `label` role (13px); `caption` (12px) is reserved for non-essential compact metadata. Preserve user text scaling through Forge's shared 1.5× cap and ensure layouts reflow or expose full text at that scale.

Descriptive titles, section labels, and field labels use sentence or title case, never all caps. Preserve all caps only where it carries compact semantic meaning: date rails and calendars, well-known abbreviations such as RPE, and units or initialisms such as kg or km.

Textual actions use the shared `controlLabel` role (15px) and retain a 44pt minimum touch target. Do not use smaller labels simply because an action is placed in compact header chrome.

## Accessibility is part of correctness

Interactive UI must remain understandable without color alone. Icon-only actions need accessible names. Preserve useful touch targets, safe areas/system insets, text scaling where practical, keyboard usability, and reduced-motion preferences.

Accessibility fixes may alter layout or interaction; do not treat them as optional polish.

## Stable interaction

Sheet bodies enable page scrolling only when their measured content exceeds the available viewport. Fitting content does not bounce or claim a scroll gesture and remains a drag-to-dismiss target; genuine overflow stays reachable, including above the keyboard. Value wheels retain their own scrolling behavior.

Prefer stable, predictable layouts during active input and repeated interactions. Avoid unnecessary focus stealing, surprise scrolling, or decorative motion that interferes with task completion.

### Responsiveness invariant

User input and navigation must never wait on decorative work, full-list mounting, or background persistence. Navigation controls (back, close, tab switch), the screen header, and search/text input stay usable immediately on entry; a heavy screen or sheet renders its shell first and may show a compact in-body loading state while it prepares expensive projections. Large or unbounded content is virtualized or progressively prepared rather than mounted whole. A dismissal must take effect from the interaction itself, never only when an animation completes, and it must never leave an interactive surface that keeps capturing input. Persistence and other background work is coalesced and moved off the input path so repeated edits and rapid re-entry stay fluid.

Custom interactive controls must provide a visible pressed state across their whole visible surface, not only their label or icon. An inset circle or chip retains its larger unpainted touch target; its tint follows the visible circle or chip. Routine-name feedback includes the leading type icon and row padding while adjacent actions remain independently accessible. Reuse Forge's shared press-state tint layer for buttons, rows, tabs and icon controls. The tint follows the control's shape and preserves its underlying color; content does not become translucent. Disabled controls do not show press feedback. Preserve stronger semantic contrast for destructive actions; do not rely on haptics alone.

For a selector with a label above its button, keep the label outside the press surface; only the rounded value button receives tint.

Each interaction has one haptic owner: the reusable primitive that performs the interaction, or the screen when no reusable owner exists. Do not trigger haptics from both layers. Use haptics sparingly for discrete causal actions, never typing, scrolling, or continuous gestures.

### Device sizing scale

Forge is authored against the iPhone Air canvas and adapts to other devices through
`src/theme/scale.ts`. The reference device — and anything wider — renders the authored
dp 1:1; only narrower devices scale down (the ratios are clamped at 1, never up), so the
iPhone Air look is never inflated. Type, spacing, radii and most fixed sizes flow through
`moderateScale` (already applied by the `typeScale`/`spacing` tokens); component dp (card,
chip, button sizes) flow through `scaleUI`, so a narrower phone is a proportional copy of
the reference rather than full-size boxes against shrunk text. Touch targets keep their
accessible size (≥44 dp) instead of scaling below it. Scaling is native-only: the web build
and the Playwright device profiles render at the authored base, so the e2e layout stays
canonical. Do not hand-author raw dp for new component sizing that should scale, and do not
rebase the guideline width away from the reference device.

## Platform guidance is behavioral guidance

Apple/Android guidance may inform native expectations, system components, accessibility, modality, input, haptics, and system integration. It does not override Forge's product hierarchy, brand, or shared visual system unless the user explicitly decides otherwise.
