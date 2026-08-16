# Visual system

These are the approved current rules. They favor native iOS behavior and a restrained visual language.

## Structure

Use native `List`, `Form`, `NavigationStack`, sheets, menus, alerts, and system materials where they fit.
Use grouped sections and alignment to create hierarchy. Do not nest cards inside cards or use large
rounded surfaces for short lists.

Use 4pt for small grouped surfaces when a stronger separation is needed and 8pt for controls and main
cards. Keep internal rows unframed. Use capsules only for compact controls, progress indicators, or
other compact status elements. Let system sheets and navigation surfaces use their platform shape.
Navigation-heavy screens such as Settings, exercise browsing, backup/export, and workout plans are
background-first and use flat rows with separators. Filled surfaces are reserved for compact grouped
content, featured summaries, or controls that need stronger separation. Do not place a second rounded
surface behind each row. A colored rail, separator, or compact status label may carry hierarchy without
creating another card.

## Content and controls

Use a clear title, a short supporting line only when it adds information, and one obvious primary action.
Keep picker rows compact and avoid repeating movement names or metadata that is already visible. Use
native menus for option selection and familiar SF Symbols for icon actions. Maintain 44-point targets.

Typography follows Dynamic Type and uses hierarchy rather than oversized text. Spacing should be compact
enough for scanning during a workout without making rows difficult to tap.

## Color and materials

Use system backgrounds and materials where they improve hierarchy or preserve context. Color communicates
selection, progress, type, success, warning, or error. Never make color the only indicator. Avoid gradients,
decorative blobs, excessive glass, and one-hue screens that reduce contrast.

## Motion and accessibility

Animations must not change list height in a way that leaves blank space or delays input. Respect Reduce
Motion. Preserve stable scroll position and selection state. Verify Dynamic Type, increased contrast,
VoiceOver reading order, labels, and light and dark appearance on every significant workflow.
