# Project guidance

Read this file and the documents in `docs/` before making product, UX, visual, or implementation decisions.

## Product status

This repository is starting from an empty workspace. Do not use another app, Swift project, screenshot, codebase, or existing UI as a reference. The product direction in `docs/` is the source of truth for this project.

The product name and supplied logo are provisional. Do not let the logo force premature decisions about the experience, design system, or information architecture.

## Current phase

Discovery and design definition come before implementation. The Dashboard is the next representative screen to design and review. Do not begin React Native implementation until the product direction, information architecture, design system, and first-screen design have been explicitly approved.

## Product principles

- Quiet, fast, private strength-training tool.
- Help users record real workouts without distracting them from training.
- Prioritize one-handed operation, stable layouts, generous touch targets, and immediate feedback.
- Keep coaching, social features, ads, accounts, tracking, gamification, and unnecessary analytics out of the core experience.
- Use a coherent cross-platform design system; platform-specific UI is used only where the operating system genuinely requires it.
- Preserve accessibility, dark mode, reduced motion, keyboard behavior, safe areas, and system insets as first-class requirements.

## Working practices

- Make small, focused changes.
- Read the relevant documents before changing them or implementing related work.
- Update the relevant documentation when an approved product decision changes.
- Verify changes in proportion to their risk.
- Commit meaningful checkpoints frequently with clear messages. Keep discovery, design-system, screen, and implementation milestones reviewable separately.
- Do not silently change the agreed information architecture or active-workout data boundaries. Raise a decision when a change is genuinely necessary.

