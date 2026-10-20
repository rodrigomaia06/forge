# Names and accessible text

Status: accepted by explicit implementation request, 2026-10-20.

Forge preserves original entity names and semantic font sizes across exercises, workouts, plans, routines and workout types. Automatic name shrinking and the former 1.5× text-size cap are superseded. Text and inputs support the complete operating-system accessibility text-size range without fitting away enlargement.

- Preview names occupy up to two lines with tail ellipsis only when activation reveals the complete value. A browsing row without that destination provides an explicit shared Show full name disclosure, or displays the full value.
- Full names wrap without a line limit in record headings, active workouts, selection options and import-matching candidates. Equipment and variation qualifiers remain visible before selection.
- Compact navigation and selected-value controls may ellipsize on one line; their opened destination exposes the full value. Accessible labels retain complete names.
- Detail headers show the name beside Back with 12 pt top/bottom spacing after the safe area, 12 pt gaps and minimum 44 pt action targets. A measured title taller than 40% of available screen height moves once into the beginning of scrollable content under compact controls.
- Long entity names belong in separate wrapping sheet/dialog content rather than inflated authored task titles.
- Rows and controls grow with text. Secondary metadata can move below names; independently actionable controls remain separate. Dense set entry reflows to labeled rows based on measured fit, preserving field order, editing, completion, unilateral behavior and keyboard navigation.
- Badges fit content. Wheels derive sufficient stable row height from scaled text. Dropdown placement and sheet overflow recalculate after layout or text-size changes.

Validation includes ordinary and long names, identical prefixes with distinct suffixes, unbroken strings, emoji, CJK, RTL and expanded labels. Check both themes on iPhone Air and Galaxy S24 and web enlargement through 200%. Verify actual iOS accessibility categories and Android maximum text size in native builds; browser emulation cannot establish native scaling support.

This policy changes presentation only, without changing storage, identities or navigation routes. Exercise Info retains its accepted grouped layout; wrapping is now the app-wide full-heading behavior rather than a page-specific exception.


- Text entry disables autocorrection, spell-checking and autocomplete suggestions across notes, comments, names, search and other editable fields. Shared Forge text inputs apply this consistently, including dashboard notes and numeric entry; normal capitalization and numeric keyboard selection remain independent.
