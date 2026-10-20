# Long names, text overflow, and accessible type

Research date: 2026-10-20. Status: recommendations adopted by explicit user request. Canonical requirements: [Names and accessible text](../product/typography.md) and [Typography design rules](../../rules/design.md#typography). Company observations below remain dated research, not proprietary implementation claims.

## Finding

Use one consistent decision process across the app, with different outcomes for compact navigation, selectable records, full details, and editable content. Making every long name smaller is not a complete overflow strategy: it creates uneven reading sizes and still cannot guarantee that arbitrary names fit.

The reviewed public material does **not** establish a shared Duolingo/Facebook/Instagram long-name algorithm, nor their current per-screen font floors or line limits. It supports intentional hierarchy, scalable text, localization-aware copy, and language-aware text layout. The strongest prescriptive overflow guidance comes from Apple, Android, and W3C, rather than proprietary-app speculation.

Recommended Forge direction: preserve readable semantic type; allocate width and adapt surrounding layout first; use deliberate line budgets; use ellipsis only where the full value is visibly reachable; reserve bounded shrinking for exceptional compact controls. Treat OS text enlargement as a user preference to support, rather than something to cancel with shrinking.

## Method and limits

Reviewed first-party company design/engineering articles, a Duolingo product illustration, official platform guidance, React Native 0.86 documentation, and relevant Forge source. No authenticated production-app testing, binary inspection, or controlled long-name experiments were performed on the three reference apps. Published illustrations show selected examples, not behavior at every length or accessibility size. Older articles describe historical decisions, not guaranteed current implementation.

Evidence labels distinguish **documented** publisher statements, **observed** illustration details, **unknown** implementation details, and **proposals** for Forge. Clones, generated third-party design systems, search snippets, and user reports were not treated as proof of proprietary behavior. Facebook/Instagram Help Center pages were inaccessible to this research client; their text-size instructions could not be verified. Stories editing tools must not be confused with app UI typography.

## What the named apps document

### Duolingo

**Documented:** its public [typography guide](https://design.duolingo.com/identity/typography) separates short display headlines from longer text, discourages long display-font sentences, and prohibits type escaping the display. This is brand guidance, not an app username-overflow specification. Its numeric brand minima should not be copied into Forge.

**Documented:** its [Spanish localization article](https://blog.duolingo.com/how-duolingo-keeps-its-spanish-localization-inclusive-2/) describes choosing shorter equivalent wording when text does not fit. That applies to authored copy; it does not justify abbreviating a person's name or an exercise's identifying words.

**Documented:** the [core-tabs redesign](https://blog.duolingo.com/core-tabs-redesign/) uses a small set of type styles, purpose-specific header tiers, and QA across languages/devices.

**Observed:** its [header illustration](https://storage.ghost.io/c/7a/33/7a33d0f4-927d-4fe8-a6bf-96131b5e76d4/content/images/2026/01/10.-Caption.-Consistent-header-size-and-title-placement-1.png), inspected during research, shows aligned titles and single-line leaderboard names beside scores. These sample names fit; this is not an overflow stress test.

**Unknown:** current long-username fallback, fitting floor, Dynamic Type coverage, and overflowing-row line count. No reviewed evidence supports “Duolingo shrinks all names.”

### Facebook

**Documented:** Meta's [Facebook.com rebuild article](https://engineering.fb.com/2020/05/08/web/facebook-redesign/) explains rem-based sizing to respect user defaults and support font-size customization. This establishes scalable web typography, not the native iOS/Android implementation.

**Unknown:** an app-wide policy for long person/group/page names, exact native line budgets, fitting thresholds, and accessibility fallback layouts. Feed previews, page titles, search results, and notifications must not be assumed to share one rule. Controlled examples of these surfaces were not verified.

**Proposal for Forge:** central scalable text roles are a sound foundation. A compact record preview can have a different line budget from its full-detail page. The latter recommendation is directly supported by W3C below, rather than attributed to an undocumented Facebook policy.

### Instagram

**Documented:** Meta's [Instagram text-engineering article](https://engineering.fb.com/2022/07/18/developer-tools/building-text-animations-for-instagram-stories/) describes platform text shaping and language-aware word boundaries. It concerns authored Stories/Reels text, not profile-name overflow. It illustrates why character counts or splitting on spaces do not adequately model rendered text.

**Unknown:** exact current overflow behavior for usernames/display names in feed headers, profiles, search rows, and messages at different OS text sizes. This review did not verify production caption expansion thresholds, username limits, font floors, or uniform Dynamic Type support. Commonly repeated caption character cutoffs should not become layout rules.

**Proposal for Forge:** distinguish entity identity from descriptive content; preserve original strings; use native shaping and a discoverable full-name presentation. This is a recommendation, not a recovered Instagram implementation.

### Comparison

| Question | Duolingo | Facebook | Instagram |
| --- | --- | --- | --- |
| Useful first-party evidence | Type hierarchy, shorter localized copy, cross-language/device QA | Scalable typography on Facebook.com | Language-aware shaping in Stories/Reels |
| Exact long-name algorithm verified? | No | No | No |
| Evidence for universal shrinking? | None found | None found | None found |
| Transferable lesson | Choose type roles and copy intentionally | Respect size preferences through shared foundations | Preserve language and rendered-text behavior |

These apps are useful references, but popularity does not establish accessibility correctness. Their undocumented overflow details should remain unknown rather than become invented requirements.

## Standards that answer the overflow question

### Apple: expand and rearrange content

[Get started with Dynamic Type, WWDC24](https://developer.apple.com/videos/play/wwdc2024/10074/) recommends scalable text styles, sufficient lines, growing containers, and changing horizontal arrangements to vertical ones at larger accessibility sizes. It describes Large Content Viewer for navigation controls that cannot reasonably grow, not as a general long-record-name solution.

For Forge, move secondary metadata/actions away from a crowded name before reducing readability. A compact navigation header can coexist with a complete wrapping title in the page body. Do not assume custom React Native controls automatically inherit native Large Content Viewer support.

### Android: support large text and test layout

Android's [font-scaling guidance](https://developer.android.com/about/versions/14/features#non-linear-font-scaling) documents nonlinear scaling up to 200% starting in Android 14 and recommends maximum-size testing. Manual fontScale multiplication is not a substitute for platform scaling.

[TextView autosizing](https://developer.android.com/guide/topics/ui/look-and-feel/autosizing-textview) supports configured ranges/preset sizes. That capability is not a recommendation to autosize every label or proof that the named apps do so. Native TextView configuration is not a direct React Native API prescription.

### W3C: truncated previews need full-content access

[Understanding WCAG 2.2 SC 1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) describes enlargement to 200% without loss of content/functionality. It explicitly allows constrained labels, such as message subjects, to truncate when full content is available on focus or activation and access is indicated.

This supports ellipsis plus an obvious full-name destination. An accessibility label alone does not expose the value to a sighted user. WCAG here is a web benchmark/design reference, not a claim of native-app conformance or a legal assessment.

### React Native: keep the mechanisms distinct

The versioned [Text API](https://reactnative.dev/docs/0.86/text) separates `allowFontScaling` from `adjustsFontSizeToFit`. `minimumFontScale` bounds fitting; `numberOfLines` limits lines; `ellipsizeMode` controls omission. On Android, multiline ellipsis reliably supports `tail`.

Express those choices in shared text roles. Preserve original strings and accessible names. Prefer native shaping/layout over JS character-count cutoffs. Verify web separately: browser zoom and CSS sizes do not simulate native Dynamic Type.

## Forge implications

Source review on the research date found exercise-name fitting down to 75% of authored size, a shared 1.5× text-scaling cap, separate sheet-title fitting options, and single-line workout/plan names. These observations are not external standards or proof of desired behavior. Review entry points: [exercise names](../../../src/components/ui/ForgeExerciseName.tsx), [shared text](../../../src/components/ui/ForgeText.tsx), [sheet headers](../../../src/components/ui/ForgeSheetHeader.tsx), and [design rules](../../rules/design.md).

Risks to resolve before adopting a replacement:

- Different name lengths create different apparent hierarchy within a list.
- A relative 75% floor can fall below Forge's minimum semantic text role; it is not a readability guarantee.
- A minimum fitting size cannot make an arbitrary name fit one line. Another fallback is necessary.
- Full screen-reader text does not guarantee visual access to the full name.
- Fitting and device-width downscaling can compound; native behavior needs measurement.
- Web canvas fitting does not establish native shaping or scaling behavior. Inline font-size updates need zoom and font-loading checks.
- The 1.5× cap limits access to larger preferences. Revisiting that cap is separate from replacing fitting behavior.

The active rule requests single-line shrinking. This research does not supersede it. Adoption must explicitly update the relevant rule/product requirement alongside implementation.

## Proposed app-wide policy for review

One policy should mean predictable priorities and shared components, not identical line counts everywhere.

| Context | Proposed normal behavior | Overflow / larger-text fallback |
| --- | --- | --- |
| Compact navigation title | Stable semantic size; one line with tail ellipsis | Full wrapping name in page body or explicit disclosure; Back/Close stays reachable |
| Exercise/workout/plan selection row | Up to two lines at the same size as peers | Grow row; retain distinguishing variation/equipment; reveal full name before ambiguous selection |
| Active-workout heading | Up to two lines; protect control space | Move secondary metadata/actions below or into existing More; allow more space at larger sizes |
| Record detail heading | Full wrapping name | Grow naturally in scrollable content; no fixed two-line cap |
| Sheet/menu title | Short authored task title | Put long entity name in separate wrapping content |
| Dropdown selected value | One-line ellipsized preview | Opening exposes the full wrapping selected label |
| Dropdown/menu options | Readable labels with a deliberate normal line budget | Grow/scroll panel and expose full names; preserve touch targets |
| Tabs, filters, actions | Concise authored labels at a shared role | Reflow group or use overflow before shrinking; keep labels unambiguous |
| Editing and import review | Preserve exact full string | Scroll/wrap editing as appropriate; reveal full compared names before accepting a match |

These line counts are proposals, not values measured in the reference apps. Allocate width and protect sibling controls first, adapt layout second, then apply an intentional line budget. Ellipsis is acceptable only with discoverable full-content access. Do not slice stored names, remove variation qualifiers, invent abbreviations, or default to scrolling marquees.

Reserve shrinking for an approved compact exception with a semantic readable floor and a full-name fallback. Do not combine global autosizing with arbitrary fixed row heights. Coverage includes workout types, routines, plans, sessions, exercises, imports, menus, sheets, and navigation.

Example: “Single-arm overhead cable triceps extension (rope attachment)” stays exact in storage. A row can show two readable lines, its detail page the complete wrapping title, and navigation a compact preview. Two exercises differing only at the end must remain distinguishable before selection is committed.

## Validation and adoption criteria

Before implementation, agree whether two-line rows are acceptable, whether compact navigation plus full body titles is preferred, and whether the 1.5× cap is in scope. Use Forge's semantic roles and native checks to choose readable floors.

Validate:

- Short/long catalogue and custom names, including identical prefixes with different suffixes.
- Long unbroken strings, emoji/combined characters, CJK, Arabic/RTL, and expanded localized labels. Preserve names; shorten only authored copy deliberately.
- Both themes, both configured phone profiles, narrow layouts, adjacent badges/buttons.
- Native iOS default/largest accessibility categories; Android default/maximum size; web enlargement/zoom through 200% including intermediate sizes. Browser profiles alone cannot verify native scaling.
- Visual full-name discovery, screen-reader output, keyboard activation, edit/import identity, reachable controls after reflow.
- No overlap/clipping, no reduction below adopted type roles, distinguishable options before selection, actual full-value revelation, and intact virtualization/scroll restoration as rows grow.

The adopted policy supersedes the former single-line shrinking rule and 1.5× cap. Where historical proposals in this report differ (including bounded shrinking), the canonical requirements linked above govern.
