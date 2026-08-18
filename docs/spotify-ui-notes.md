# Spotify UI notes

This is a small research note, not a direction to copy Spotify. The useful lesson is how Spotify creates a coherent product language across many surfaces.

## Patterns worth carrying into Forge

- Content hierarchy comes first. Spotify’s own design principles describe the product as relevant, human, and unified: show the right information in context, make interactions understandable, and reuse a coherent system rather than inventing each surface independently.
- Strong grouping makes scanning easy. Spotify uses distinct surface layers, clear section groupings, and consistent spacing so a user can recognize what belongs together before reading every label.
- Priority is visible. Primary actions, active destinations, and currently playing context receive stronger contrast; secondary actions recede instead of competing for attention.
- The system is expressive where the content supports it. Spotify can use artwork and color for content discovery, but that expression is not spread evenly across every control.
- Reusable primitives create polish. Consistent corner treatment, icon behavior, typography, and navigation make separate screens feel like one product.

## Translation for Forge

- Keep the ink accent restrained and use semantic colors only for meaningful workout context.
- Make the calendar, selected day, and workout records the content hierarchy—not a generic metric grid.
- Use cards as purposeful groups with a clear internal rhythm, not as decoration around every row.
- Keep the floating dock and persistent workout context visually consistent across Dashboard, Plans, History, and More.
- Allow history and progress to carry more visual expression than the live workout, where stability and fast logging matter more.
- Do not copy Spotify’s black/green palette, music artwork, promotional surfaces, or discovery behavior.

## Icon research

Apple’s SF Symbols are a platform-specific library with thousands of symbols, multiple weights, scales, and filled/variant forms. They are not a suitable foundation for Forge’s Android-compatible identity.

Iconoir is the current trial because its React Native package uses SVG, supports the shared cross-platform component boundary, and offers a clean 24px grid with adjustable stroke weight and solid variants. It is closer to the disciplined outline language we want than a mixed platform icon set. Phosphor remains a valid fallback because it offers more explicit weight and fill variants.

Sources:

- [Apple Design Resources](https://developer.apple.com/design/resources/)
- [Spotify design principles](https://spotify.design/article/introducing-spotifys-new-design-principles)
- [Spotify Encore design systems](https://spotify.design/article/reimagining-design-systems-at-spotify)
- [Iconoir React Native](https://github.com/iconoir-icons/iconoir)
- [Phosphor React Native](https://github.com/phosphor-icons/react-native)
