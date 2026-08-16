# Visual system

These are the approved current rules. They favor native iOS behavior and a restrained visual language.

## Structure

Use native `List`, `Form`, `NavigationStack`, sheets, menus, alerts, and system materials where they fit.
Use grouped sections and alignment to create hierarchy. Do not nest cards inside cards or use large
rounded surfaces for short lists.

Forge uses one explicit surface language:

| Surface | Use | Treatment |
| --- | --- | --- |
| Card | One interactive or informational object in a scroll view | `Color.forgeSurface`, continuous 16pt corners, 16pt content inset, subtle semantic edge |
| Grouped surface | A quiet grouping inside a card, never an independent action | `Color.forgeBackground`, continuous 8pt corners |
| Native row | Short settings, picker, or catalog content | Native `List`/`Form` row; no extra card background |
| Section | A semantic group of native rows | Native section header/footer and system separators |
| Sheet/material | Temporary modal or progress state | System sheet shape or system material |

Use the shared `Theme.Surface` and `forgeCard` helpers for explicit cards. Cards receive one subtle
separator-colored edge so their boundary is clear in light and dark appearance; do not add a second
outline at individual call sites. Use a separator only between rows or a semantic color rail when it adds
meaning. Use 8pt for grouped surfaces and 16pt for cards. Keep internal rows unframed; separators belong between rows, not around
every row. Use capsules only for compact controls, progress indicators, or other compact status elements.
Let system sheets and navigation surfaces use their platform shape.

`List` and `Form` screens keep native row geometry. `forgeFormBackground()` may hide the opaque system
scroll background so those rows share the Forge canvas, but it must not turn each native row into a card.
Workout plans use a native `List` host for scrolling and deletion, with one explicit card per plan and
plain separated routine rows inside it. This preserves list behavior while keeping the plan surface aligned
with Dashboard and History; routines are grouped by spacing and separators, not nested cards.

## Content and controls

Use a clear title, a short supporting line only when it adds information, and one obvious primary action.
Keep picker rows compact and avoid repeating movement names or metadata that is already visible. Use
native menus for option selection and familiar SF Symbols for icon actions. Maintain 44-point targets.

Typography follows Dynamic Type and uses hierarchy rather than oversized text. Spacing should be compact
enough for scanning during a workout without making rows difficult to tap.

All actionable rows retain a minimum 44-point hit target. A card may contain multiple rows, but the card
itself is not an additional interactive layer. Color rails, badges, and selection fills support labels or
icons and never carry meaning alone.

## Color and materials

Use system backgrounds and materials where they improve hierarchy or preserve context. Color communicates
selection, progress, type, success, warning, or error. Never make color the only indicator. Avoid gradients,
decorative blobs, excessive glass, and one-hue screens that reduce contrast.

## Motion and accessibility

Animations must not change list height in a way that leaves blank space or delays input. Respect Reduce
Motion. Preserve stable scroll position and selection state. Verify Dynamic Type, increased contrast,
VoiceOver reading order, labels, and light and dark appearance on every significant workflow.
