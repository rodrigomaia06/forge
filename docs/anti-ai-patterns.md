# Anti-AI-patterns

This document is a review guardrail for design, copy, and implementation. It does not mean that every listed pattern is always bad. It means the pattern needs a concrete product reason before it enters Forge.

The goal is not to make the app look “anti-AI.” The goal is to avoid interchangeable output and preserve product-specific judgment.

## What we are avoiding

Recent design criticism commonly describes “AI slop” as output that converges on statistically common interfaces: gradients, glass, interchangeable cards, generic typography, and familiar composition without a reason tied to the product. The same convergence appears in language that is polished, relentlessly positive, vague, and full of business promises without concrete meaning.

Useful references:

- [AI Design Slop: Why AI-Generated UI Looks Generic](https://smoothui.dev/blog/ai-design-slop)
- [The New Skeuomorphism: How AI Makes Bad Design Look Good Enough](https://builtin.com/articles/ai-design-slop-era)
- [Spot the Slop: A UI Designer’s Guide to Fixing AI Defaults](https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c)
- [Slop — Impeccable](https://impeccable.style/slop/)
- [How to Make an AI-Generated Website Look Designed, Not Generated](https://buildtaste.com/how-to-make-ai-generated-websites-look-designed)
- [How to spot AI writing](https://www.tomsguide.com/ai/how-to-spot-ai-writing-5-telltale-signs)

## UI patterns to reject by default

### Generic visual tropes

- Purple, pink, or blue decorative gradients used as a shortcut for identity.
- Glassmorphism, translucent floating panels, blur, glow, and ornamental backdrop effects.
- Large hero compositions, centered marketing-style headlines, or oversized empty introductions that delay the useful content.
- Three-card feature grids or repeated card grids when a list, section, or calendar is more appropriate.
- Every section placed inside its own rounded card.
- Excessive corner radii that turn controls, rows, and sections into soft pills or bubbles.
- Heavy shadows, floating cards, inset shadows, or fake depth without a usability purpose.
- Gradient text, decorative outlines, noisy textures, and visual effects that compete with data.
- Emoji used as a substitute for a coherent icon system.

### Generic application structure

- A dashboard that is only a collection of metrics, cards, and charts.
- A navigation structure copied from a generic SaaS template rather than the product hierarchy.
- Unnecessary onboarding, overview, confirmation, or “welcome” screens before a user can perform the primary action.
- Modal or sheet stacks for actions that can happen directly in the current workspace.
- Hidden common actions behind gestures, hover-like affordances, or unexplained icon-only controls.
- Animated staggered entrances, celebration effects, or motion added to make a screen feel alive without communicating state.
- One-off component styling that breaks the spacing, radius, icon, or state system.
- Placeholder states that look complete but do not explain what the user can do next.

### Forge-specific rejection rules

- Do not turn the Dashboard calendar into a decorative widget or a heatmap-heavy analytics surface.
- Do not turn the Active Workout into a card dashboard.
- Do not move the set table, steal focus, or open a modal after every completed set.
- Do not make the rest timer a dramatic takeover or motivational moment.
- Do not add streaks, badges, scores, PR fireworks, or pressure-oriented progress cues.
- Do not make routines feel like prescriptions or punish deviation.
- Do not use color as the only indication of a completed, warning, or destructive state.
- Do not add a separate feature just because it is a familiar fitness-app pattern.

## Language patterns to reject by default

Forge language should be concise, concrete, calm, and confident. Avoid copy that sounds like a landing page, coach, chatbot, or corporate strategy deck.

Avoid:

- “Unlock your potential.”
- “Elevate your journey.”
- “Powerful tools to help you crush your goals.”
- “Seamlessly track your progress.”
- “Your fitness journey starts here.”
- “Let’s get you moving!”
- “Amazing work!” or other forced praise after ordinary actions.
- “Optimize,” “supercharge,” “transform,” “revolutionary,” “game-changing,” and “effortless” unless the exact claim is genuinely true and useful.
- Generic rhetorical openings such as “Ready to take your training to the next level?”
- Vague labels such as “Insights,” “Performance,” or “Discover” when a concrete label like “Workout history” or “Recent sessions” is clearer.
- Copy that repeats the screen title in a longer sentence without adding information.
- Over-explaining straightforward controls.
- Relentlessly upbeat language that leaves no room for incomplete, corrected, skipped, or messy real-world workouts.

Do not ban a punctuation mark mechanically. An em dash, colon, or semicolon is fine when it serves the sentence. The problem is repetitive mannerism, not one character.

Prefer:

- “Resume workout”
- “Start blank workout”
- “Add exercise”
- “2 planned sets are incomplete. Finish anyway?”
- “No workouts recorded”
- “Last session”
- “Rest timer”
- “Discard workout”

Labels should describe the action or information directly. Empty states should state the current condition and offer the next useful action, without motivational filler.

## Content and data presentation

- Use concrete workout names, dates, durations, exercises, sets, and units in prototypes. Do not fill screens with “Lorem ipsum,” invented marketing copy, or meaningless placeholder metrics.
- Never invent a PR, trend, workout, or user preference just to make a screen look populated.
- If realistic sample data is needed, keep it plausible and clearly local to the prototype.
- Avoid charts when a short list or comparison communicates the information faster.
- Do not show metrics merely because a dashboard has empty space.
- Keep the user's actual recorded work more prominent than derived interpretations.

## Design review questions

Before accepting a generated or hand-built screen, ask:

1. What specific Forge problem does each visual element solve?
2. Could this composition belong to any generic productivity, finance, or fitness app?
3. Is the hierarchy carried by spacing, typography, and meaning, or by decorative effects?
4. Are the important actions obvious without relying on a gesture or unexplained icon?
5. Are empty, loading, error, incomplete, dark-mode, large-text, and reduced-motion states designed?
6. Does the copy describe the user's real state in plain language?
7. Did any metric, card, animation, or prompt appear only because it is a common generated pattern?
8. Does the screen preserve the quiet, private, dependable character of the product?

## Implementation guardrails

- Use the documented semantic tokens and shared components instead of inventing local styles.
- Prefer a small number of deliberate compositions over a large catalog of generic components.
- Keep generated code reviewable; remove unused variants, dead placeholder content, and speculative abstraction.
- Use accessibility labels, stable layout behavior, and direct controls as part of the initial implementation.
- When a visual choice is uncertain, make a small prototype and ask for visual feedback rather than guessing from generic examples.

