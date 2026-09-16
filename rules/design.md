# Design rules

These are durable implementation/design guardrails, not a complete product design specification.

## Shared Forge identity

Forge should keep one coherent visual identity across iOS and Android. Do not make the app visually imitate stock iOS or Material solely because it runs on that platform.

Use platform-specific behavior where it improves system integration, accessibility, input, navigation expectations, or native capability.

## Semantic design system

Use shared semantic tokens and reusable primitives for recurring color, typography, spacing, shape, and interaction roles. Avoid duplicating raw visual values across feature components when a shared semantic value already exists.

Finite single-choice lists use the shared Forge selection primitives. Standalone choices use the Forge selection sheet; a value opened from an existing sheet replaces that sheet's content with an internal selection view and provides an explicit Back path to the prior content.

Icon-only dismiss and navigation header actions use the shared 44 pt circular overlay surface, pressed state, haptic feedback, and accessible name. In Light, its fine border provides separation; in Dark, circular sheet/header controls use a borderless tonal surface so they do not create noisy white outlines. Sheet close controls use `SheetCloseButton`, the same-sized neutral circle matched by an in-sheet Back action. Other button variants retain their semantic outlines in both themes.

Bottom-attached modal sheets use the shared Forge sheet presentation for their backdrop, drag handle, dismissal motion, corner treatment, shadow, close control, and pressed feedback. Their header uses the shared centred-title shell and 44 pt circular X dismiss control; the X aligns to the shared top-right sheet edge regardless of any content inset. The complete header zone—including the title—is the drag-to-dismiss target, while scrolling sheet content is never a dismissal target. Specialised sheets may add Back, Save, Delete, or Default controls without replacing that shell. Backdrop opacity is animated in a layer behind the sheet, never on a parent that would make the sheet transparent; bottom sheets settle at their snap point without overshoot and their surface extends through the system navigation area. When a sheet input opens the keyboard, the shared sheet synchronizes its animation with the keyboard. A short sheet rises only far enough to remain fully visible above the keyboard with a small breathing gap; a taller sheet expands to the top safe-area inset and its content must remain scrollable. Both retain normal rounded upper corners and restore their compact height when the keyboard hides. Individual sheets may vary only their content and height.

Every persistent screen header above vertically scrollable user content shows the shared `HeaderEdge` only after the content passes beneath it; non-scrolling and top-of-content states remain unlined. Card-like press targets and filter choices inside scrolling content use a short press-recognition delay so a drag never leaves a control looking selected.

Bottom-attached lists of discrete actions use `ForgeActionSheet`. It owns the handle, semantic centred title, 44 pt close control, grouped neutral icon rows with chevrons, and promotes the primary destructive action to the header's right edge while moving Close to the left. Do not use it for radio/selection lists, pickers, forms, detail sheets, or confirmation dialogs; those retain their specialised primitives and semantics.

When a text keyboard is visible in a shared sheet, the first tap elsewhere in the sheet dismisses it instead of activating the tapped control. Number-pad editing in Live Workout remains exempt so repeated set entry is uninterrupted.

Use the shared grouped-card primitive whenever a feature presents related rows. It owns the common surface, border, radius, and shadow treatment in both themes; screens may not recreate a locally divergent card outline.

Controls use a monochrome neutral hierarchy by default. `actionPrimary`/`onActionPrimary` are the only default filled-action treatment, and `selectionIndicator` is the monochrome generic selected/toggle state. Standard secondary, outline, destructive, and success actions retain their semantic outlines in both themes; only circular sheet/header controls use the borderless dark treatment. Do not infer colour emphasis mechanically from labels such as Save, Add, Start, Finish, or Done; these actions remain neutral. An enabled final confirmation action in an add/edit form may use the success outline treatment with a checkmark to make the ready-to-submit state explicit; its disabled state remains neutral. Green is reserved for success states and this explicit form-completion affordance, amber for warnings, and red for destructive actions that directly delete, remove, or confirm discarding data. Back, Close, Cancel, More, Filter, Skip, and reversible Hide remain neutral.

Workout-type colours are data, not chrome. They may appear only in small type markers and badges, calendar markers, charts and legends, and the workout-type editor or colour selector. Do not use them for text, buttons, headers, navigation, checks, switches, metrics, or large decorative backgrounds. Resolve type-marker presentation through the shared workout-type presentation helper so saved custom colours and built-in fallbacks remain consistent.

Header actions use `HeaderAction` only: icon-only controls are 44 pt circles and labelled pills use `controlLabel`. Their surface remains neutral unless the screen explicitly promotes the action or the action is directly destructive. Shared switches are presentational; their containing rows own touch handling, accessibility, and any haptic feedback.

Primary dock icons use the shared navigation item and animate subtly between their standard size and a slightly enlarged selected state.

Primary dock tabs use the persistent Forge tab bar. They cross-fade through the shared short tab transition rather than using a push or lateral slide, while a single local selection indicator moves to the active item. Retapping the active tab preserves its current navigation and scroll position. Their scroll bodies extend behind the lower system safe area and dock fade; only the dock's reachability inset is reserved, never a separate empty tab-bar band.

Across all vertically scrollable pages, including nested settings, details, and editors, the scroll viewport extends to the bottom screen edge. Reserve the bottom safe area inside the scrollable content so the final control can clear the home indicator; do not create an opaque safe-area strip outside the scroll viewport. Primary tabs include their floating dock clearance in that trailing space.

Backgrounds exposed behind pages during navigation gestures and transitions must follow the active Forge theme, including the native app root.

All application icons are rendered through Forge's shared `Icon` adapter, backed by Tabler Icons. Choose the icon semantically for the action or content it represents; screens must not import a separate icon library directly.

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

Prefer stable, predictable layouts during active input and repeated interactions. Avoid unnecessary focus stealing, surprise scrolling, or decorative motion that interferes with task completion.

Custom interactive controls must provide a visible pressed state. Reuse Forge's shared pressed feedback for ordinary controls and preserve stronger semantic contrast for destructive actions; do not rely on haptics alone.

Each interaction has one haptic owner: the reusable primitive that performs the interaction, or the screen when no reusable owner exists. Do not trigger haptics from both layers. Use haptics sparingly for discrete causal actions, never typing, scrolling, or continuous gestures.

## Platform guidance is behavioral guidance

Apple/Android guidance may inform native expectations, system components, accessibility, modality, input, haptics, and system integration. It does not override Forge's product hierarchy, brand, or shared visual system unless the user explicitly decides otherwise.
