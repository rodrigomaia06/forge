# Design rules

These are durable implementation/design guardrails, not a complete product design specification.

## Shared Forge identity

Forge should keep one coherent visual identity across iOS and Android. Do not make the app visually imitate stock iOS or Material solely because it runs on that platform.

Use platform-specific behavior where it improves system integration, accessibility, input, navigation expectations, or native capability.

## Semantic design system

Use shared semantic tokens and reusable primitives for recurring color, typography, spacing, shape, and interaction roles. Avoid duplicating raw visual values across feature components when a shared semantic value already exists.

Finite single-choice lists use the shared Forge selection primitives. Standalone choices use the Forge selection sheet; a value opened from an existing sheet replaces that sheet's content with an internal selection view and provides an explicit Back path to the prior content.

Icon-only dismiss and navigation header actions use the shared 44 pt circular overlay surface, including its border, pressed state, haptic feedback, and accessible name.

Bottom-attached modal sheets use the shared Forge sheet presentation for their backdrop, drag handle, dismissal motion, corner treatment, shadow, close control, and pressed feedback. Individual sheets may vary only their content and height.

Use the shared grouped-card primitive whenever a feature presents related rows. It owns the common surface, border, radius, and shadow treatment in both themes; screens may not recreate a locally divergent card outline.

Workout-type colors communicate workout-type data, swatches, charts, and contextual type selection only; they do not color generic Save, Finish, creation, navigation, or destructive actions. Shared controls use semantic Forge tones: Save, Done, and Finish use `success`; Start, Add, and New use `accent`; Discard, Delete, Remove, and destructive swipe actions use the destructive tokens; Back, Close, More, Filter, Skip, and reversible Hide remain neutral. Generic selected/toggle states use `inkInteractive`, while completed workout sets use `success`.

Header actions use `HeaderAction` only: icon-only controls are 44 pt circles and labelled pills use `controlLabel`. Do not bypass its semantic tones with local colour or label-style props. Shared switches are presentational; their containing rows own touch handling, accessibility, and any haptic feedback.

Do not copy exact visual constants from an external design guideline when the platform provides a semantic/system value or Forge already owns that visual decision.

## Typography

Use Forge's semantic type roles and shared text primitives rather than raw font values in product UI. Readable content must use at least the `label` role (13px); `caption` (12px) is reserved for non-essential compact metadata. Preserve user text scaling through Forge's shared 1.5× cap and ensure layouts reflow or expose full text at that scale.

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
