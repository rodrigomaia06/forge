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
when Expo changes the affected header. SDK 57 also does not yet pass Swift 6's
strict concurrency checking when its actor-isolated raw-pointer trampolines use
standalone `nonisolated(unsafe)` bindings. The same guarded patch replaces
those bindings with Expo's existing `NonisolatedUnsafeVar` wrapper, retaining
Swift 6 checking and the Xcode 26.3 toolchain for the full archive. It must be
removed when Expo's upstream migration makes the module Swift 6 clean.
The existing `EXPO_TOKEN` secret may remain configured but is not used for this
workflow. No Apple account or EAS build is needed.

## Consequences

The workflow consumes GitHub Actions macOS time rather than EAS iOS builds.
The unsigned workflow remains suitable for sideload testing: iLoader must
re-sign that artifact with the user's Apple ID. Native errors are visible in the GitHub
build log, and the direct WidgetKit/ActivityKit extension remains part of the
archived app.

## Signed Ad Hoc workflow (2026-10-20)

At the user's request, `.github/workflows/build-ipa-signed.yml` provides a separate
manual Apple-signed build while preserving the unsigned workflow. It uses the
same direct macOS/Xcode toolchain and guarded Expo patches, without EAS. The iOS
Bundle ID is `com.rodrigo.forge.training`; the local plugin derives the extension
ID as `com.rodrigo.forge.training.resttimer`. Android's application ID and the
portable Forge document type are independent and remain unchanged.

The signed workflow decodes a distribution identity and two Ad Hoc profiles from
GitHub repository secrets. A temporary keychain holds the imported identity.
Before archiving, the workflow checks profile expiry, exact app and extension
identities, matching teams, a common registered device, distribution signing and
certificate membership in both profiles. The app profile must authorize Time
Sensitive Notifications and production push notifications; generated Release
entitlements use production APNs. Manual signing assigns a separate profile to
each Release target. Export produces a signed registered-device IPA and validates
both signatures and Bundle IDs, showing the identifiers in the build logs and
summary without printing signing secrets or device identifiers. Cleanup runs on
success or failure; only the signed IPA and build logs are uploaded as artifacts.

The signing inputs are `BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`,
`APP_PROVISION_PROFILE_BASE64` and `WIDGET_PROVISION_PROFILE_BASE64`. Regenerating
profiles for an additional device requires replacing the corresponding secrets
and running another signed build. This workflow does not submit to TestFlight or
the App Store. Linux checks cover signing configuration and workflow structure;
macOS archive/export and installation remain native verification steps.

## Alternatives considered

Keeping the Ubuntu workflow and remote EAS build uses fewer GitHub macOS
minutes but is constrained by EAS's iOS build quota. A self-hosted Mac would
avoid hosted-runner quota, but Forge does not currently rely on user-owned Mac
hardware being online.
