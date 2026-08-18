# Design system direction

This is a design direction, not yet an implementation specification. Exact values should be tuned against the first representative screen and then treated as reusable tokens.

## Visual character

Premium and precise, understated and platform-neutral. Refinement should come from exceptional spacing, alignment, typography, numeric presentation, and carefully tuned controls—not gradients, glass, heavy shadows, or elaborate animation.

## Color semantics

Use semantic roles so light and dark themes share component logic:

- Background.
- Surface.
- Elevated surface.
- Primary text.
- Secondary text.
- Muted text.
- Divider/border.
- Accent ink.
- Accent interactive.
- Success.
- Warning.
- Destructive.
- Focus/selection.

The primary accent is blue-black ink with a slightly brighter interactive variant. Success, warning, and destructive states have independent semantic colors. No state relies on color alone.

Light mode is primary. Dark mode is equally intentional and uses semantic tokens rather than an inverted collection of component-specific colors.

## Typography

Use the platform system font. Establish identity through hierarchy, weight, scale, spacing, and layout rather than a custom typeface.

Exercise names are the strongest live-workout hierarchy. Current-set information comes next, followed by previous-performance context. Use highly legible compact numeric treatment and tabular/monospaced numerals where practical for weights, reps, set numbers, and timers.

## Spacing and density

Use a restrained scale based on 4- and 8-point relationships, with deliberate larger section spacing. Use one tuned default density rather than a user-facing density setting. Components may have contextual compact variants, especially set rows, while preserving generous touch targets.

## Shape and surfaces

- Tighter controls with moderate radii.
- Slightly softer radii for larger containers and sheets.
- Background contrast and separators do most of the structural work.
- Use subtle surface layers only where they clarify hierarchy.
- Use fine borders selectively.
- Remove shadows wherever possible.
- Avoid card-heavy layouts, excessive pills, glass effects, bubbles, and gradients.

## Controls and icons

Use one medium-weight cross-platform line icon family. Filled variants are acceptable for selected states when visually consistent. Custom icons are reserved for concepts that cannot be represented clearly by the shared family.

Use a solid accent-filled control only for the single most important action in a context. Secondary controls are neutral fills, subtle borders, or text/icon actions. Destructive controls use their own semantic styling.

## Cross-platform component contract

The product owns its reusable interface primitives in `src/components/ui/`. These components are built from React Native primitives and shared semantic tokens, so the visual identity does not depend on iOS-only controls or platform-default styling.

The initial foundation includes:

- `AppScreen` for safe-area-aware screen composition.
- `Button` for primary and secondary actions.
- `NavigationItem` for persistent destination navigation.
- `SectionHeader` for compact section hierarchy.
- `Divider` for quiet structural separation.

Platform-specific behavior remains appropriate for system integration such as safe areas, keyboards, accessibility services, haptics, and system permissions. It should not define the product’s core shapes, colors, spacing, or interaction language.

## Calendar language

The month grid is a meaningful product surface, not a decorative widget. Completed days use small accent markers or compact indicators. Multiple workouts can use multiple marks or a count. The selected date receives the strongest treatment through background, outline, or both, while trained days remain quiet enough to preserve scanability.

## Motion and feedback

Use smooth, restrained motion only to communicate a state change: completion, timer start/stop, expansion, navigation, addition, or error. Set completion should be clearly satisfying but stable: visible state update plus subtle haptic, with no celebration, screen movement, or gamification.
