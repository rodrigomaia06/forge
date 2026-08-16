# Product

## Identity

Forge is a focused, private strength-training app for iPhone. It is a tool for recording workouts,
routines, history, and exercise details. It is not a social network, coach, game, storefront, or
subscription service.

## Priorities

Changes should make the app faster during a workout, easier to understand without instructions,
reliable when interrupted, safer for user data, and more consistent with native iOS behavior. Prefer
reliability, data integrity, privacy, and usability over novelty.

Design for one-handed use between sets. Use large tap targets, sensible defaults, immediate feedback,
reversible actions, stable layouts, and one clear primary task per screen. Do not hide essential actions
behind a gesture, reset context unexpectedly, or add engagement pressure.

## Native behavior

Use current SwiftUI and UIKit conventions for navigation, sheets, forms, menus, alerts, text input,
system appearance, accessibility, state restoration, and lifecycle transitions. Support light and dark
appearance, Dynamic Type, Reduce Motion, increased contrast, VoiceOver, and common iPhone sizes.

## Privacy and ownership

Workout data stays local by default. Forge does not require an account, advertising, analytics, or
cross-app tracking. Network use must be deliberate, visible, and useful to the user. Do not collect
data merely because it might be useful later.

## Accessibility

Accessibility is part of correctness. Every interactive element needs a meaningful label and a minimum
44-point target. Do not use color, position, shape, or haptics as the only indicator of state. Important
state changes should be announced, and layouts must remain usable with large text.

## Product language

Use English, sentence case, plain words, active verbs, and concrete explanations in project-owned text.
Buttons name actions. Errors say what failed, preserve the user's work, and offer a recovery action.
Do not use marketing copy, motivational pressure, emojis, or unsupported claims.
