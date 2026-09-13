# ADR 0002: Rest timer Live Activity bridge

Status: Accepted
Date: 2026-09-13

## Context

Forge's rest timer must remain accurate outside the JavaScript runtime, including the iPhone Lock Screen and Dynamic Island. A JavaScript interval cannot provide the system-owned presentation or survive normal foreground/background transitions.

## Decision

The timer state is represented by a persisted `endAt` timestamp and duration. React Native owns user actions and synchronizes native surfaces on start, adjustment, stop, expiry and hydration. On iOS, Expo's `expo-widgets` config plugin generates Forge's local ActivityKit extension and app-group configuration during prebuild; its SwiftUI date interval owns the Lock Screen and Dynamic Island countdown. The ActivityKit extension is built in an iOS development or production build, never Expo Go. Android uses its platform notification/channel fallback.

## Consequences

The visible countdown is derived from timestamps, so JS does not need a global one-second render loop. The generated activity uses its stale date to switch to an overdue red count even when the app is suspended; a `forge://rest-timer/open` deep link returns a tap to the Rest timer sheet. Notification sound and foreground haptics remain controlled by Forge preferences, while the operating system controls notification-banner appearance. The generated extension and its entitlements are included by the iOS build pipeline.

## Alternatives considered

Using only Expo notifications would not provide Dynamic Island or a continuously rendered Lock Screen timer. A JS-only countdown would make foreground UI state unreliable when the app is inactive.
