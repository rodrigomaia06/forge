# External guidance

External guidance supplies current expertise. It does not define Forge product truth.

## Authority rule

When sources conflict, prefer:

1. explicit current user requirement
2. active Forge product requirement / accepted Forge decision
3. active Forge rules
4. official platform/framework documentation and tooling for factual API/platform behavior
5. maintained external/community skills and rule packs
6. research/inspiration
7. archived material

Do not copy an external rule into Forge merely because it exists. Promote only a Forge-specific adaptation when the project has deliberately adopted or modified the policy.

## Expo

For Expo-specific implementation, package compatibility, native capabilities, configuration, builds, and upgrades, prefer current official Expo documentation/CLI. The official Expo skills/plugin may be used as an agent-facing adapter, but Expo documentation and tooling remain authoritative for Expo facts.

Recommended agent setup:

- Claude Code: official Expo plugin from the Claude plugin marketplace.
- Codex: official Expo plugin from the OpenAI-curated Codex marketplace.

Do not adopt Expo Router or restructure this established project solely because an external Expo example uses it.

## React Native engineering

Vercel's maintained React Native agent guidance may be consulted for rendering correctness, performance, animation, lists, state, and native integration.

Treat dependency recommendations as advisory. A recommendation to use FlashList, Reanimated, or another package does not override Forge's dependency policy.

## Apple platform guidance

Use current Apple Human Interface Guidelines for iOS behavior and platform expectations. A React-Native-oriented HIG skill may be used to make that guidance easier for an agent to apply, but it remains an adapter rather than a Forge source of truth.

Apply Apple guidance primarily to accessibility, safe areas, input/keyboard behavior, modality, haptics, native system integration, and interaction expectations. Do not let it redefine Forge's shared visual identity by default.

## Android platform guidance

Use current Android/platform documentation for Android-specific system behavior and native integration. Preserve Forge's shared visual identity unless the platform genuinely requires a different component/behavior.

## Freshness

When an external framework/platform fact could have changed, verify it from a current official source rather than relying on a copied local summary.
