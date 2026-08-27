# Design rules

These are durable implementation/design guardrails, not a complete product design specification.

## Shared Forge identity

Forge should keep one coherent visual identity across iOS and Android. Do not make the app visually imitate stock iOS or Material solely because it runs on that platform.

Use platform-specific behavior where it improves system integration, accessibility, input, navigation expectations, or native capability.

## Semantic design system

Use shared semantic tokens and reusable primitives for recurring color, typography, spacing, shape, and interaction roles. Avoid duplicating raw visual values across feature components when a shared semantic value already exists.

Do not copy exact visual constants from an external design guideline when the platform provides a semantic/system value or Forge already owns that visual decision.

## Accessibility is part of correctness

Interactive UI must remain understandable without color alone. Icon-only actions need accessible names. Preserve useful touch targets, safe areas/system insets, text scaling where practical, keyboard usability, and reduced-motion preferences.

Accessibility fixes may alter layout or interaction; do not treat them as optional polish.

## Stable interaction

Prefer stable, predictable layouts during active input and repeated interactions. Avoid unnecessary focus stealing, surprise scrolling, or decorative motion that interferes with task completion.

Custom interactive controls must provide a visible pressed state. Reuse Forge's shared pressed feedback for ordinary controls and preserve stronger semantic contrast for destructive actions; do not rely on haptics alone.

## Platform guidance is behavioral guidance

Apple/Android guidance may inform native expectations, system components, accessibility, modality, input, haptics, and system integration. It does not override Forge's product hierarchy, brand, or shared visual system unless the user explicitly decides otherwise.
