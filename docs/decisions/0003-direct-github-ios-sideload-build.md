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
