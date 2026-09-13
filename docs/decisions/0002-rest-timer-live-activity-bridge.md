# ADR 0002: Rest timer Live Activity bridge

Status: Accepted
Date: 2026-09-13

## Context

Forge's rest timer must remain accurate outside the JavaScript runtime, including the iPhone Lock Screen and Dynamic Island. A JavaScript interval cannot provide the system-owned presentation or survive normal foreground/background transitions.

## Decision

The timer state is represented by a persisted `endAt` timestamp and duration. React Native owns user actions and synchronizes native surfaces on start, adjustment, stop, expiry and hydration. On iOS, Forge's local Expo module bridges to a direct Swift ActivityKit controller, and its local WidgetKit extension owns the SwiftUI date interval on the Lock Screen and Dynamic Island. The direct implementation does not require an App Group or a generated JavaScript widget layout, matching the prior Forge native implementation. The ActivityKit extension is built in an iOS development or production build, never Expo Go. Android uses its platform notification/channel fallback.

## Consequences

The visible countdown is derived from timestamps, so JS does not need a global one-second render loop. The direct activity adopts any existing Forge activity after a process relaunch, uses its stale date and a scheduled update to switch to an overdue red count, and `forge://rest-timer/open` returns a tap to the Rest timer sheet. Notification sound and foreground haptics remain controlled by Forge preferences, while the operating system controls notification-banner appearance. The local module and extension are included by the iOS build pipeline.

## Alternatives considered

Using only Expo notifications would not provide Dynamic Island or a continuously rendered Lock Screen timer. A JS-only countdown would make foreground UI state unreliable when the app is inactive. Expo's generated widget layout was rejected because it requires App Group storage and did not reproduce the proven direct ActivityKit behavior in the re-signed IPA workflow.
