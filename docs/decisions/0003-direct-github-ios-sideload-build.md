# ADR 0003: Direct GitHub iOS sideload build

Status: Accepted
Date: 2026-09-14

## Context

Forge needs repeatable unsigned iOS IPAs for installation through iLoader. The
previous GitHub workflow delegated the native build to EAS, which imposed a
small monthly iOS build limit despite GitHub Actions providing a larger standard
runner allowance.

## Decision

The manual IPA workflow runs directly on GitHub's standard `macos-15` runner.
It generates the Expo iOS project, builds a Release device archive with signing
disabled, packages `Payload/Forge.app` as an IPA, validates the app and widget
extension executables, and uploads the IPA and native build log separately.
It explicitly selects Xcode 26.3 because the runner's default Xcode 16.4
provides Swift tools 6.1, while ExpoModulesJSI's SwiftPM package requires 6.2.
Until Expo SDK 57 ships its upstream fix, the workflow removes the two invalid
`SWIFT_RETURNS_RETAINED` constructor annotations from ExpoModulesJSI after
installing dependencies; Swift 6.2 rejects those annotations but preserves the
class's ordinary shared-reference ownership without them. The guarded patch is
deliberately local to the CI dependency install and must be removed or updated
when Expo changes the affected header.
The existing `EXPO_TOKEN` secret may remain configured but is not used for this
workflow. No Apple account or EAS build is needed.

## Consequences

The workflow consumes GitHub Actions macOS time rather than EAS iOS builds.
It remains suitable only for unsigned sideload testing: iLoader must re-sign
the artifact with the user's Apple ID. Native errors are visible in the GitHub
build log, and the direct WidgetKit/ActivityKit extension remains part of the
archived app.

## Alternatives considered

Keeping the Ubuntu workflow and remote EAS build uses fewer GitHub macOS
minutes but is constrained by EAS's iOS build quota. A self-hosted Mac would
avoid hosted-runner quota, but Forge does not currently rely on user-owned Mac
hardware being online.
