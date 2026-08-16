# Testing

## Test layers

Use unit tests for domain rules, exercise grouping, filtering, date and duration handling, and variation
resolution. Use integration tests for Core Data persistence, migrations, import validation, backup and
restore, and failure recovery. Use UI tests for picker, routine, calendar, history, and custom exercise
flows. Include accessibility checks for VoiceOver, Dynamic Type, Reduce Motion, contrast, and tap targets.

## Required scenarios

Test exact exercise UUID preservation, duplicate prevention, missing and custom variation creation,
weighted and assisted options, calendar blank and routine workouts, cancellation, failed saves, backup
validation, interrupted workouts, and large histories. Test both light and dark appearance and common
iPhone sizes.

## CI and local checks

The GitHub Actions workflow generates the Xcode project with XcodeGen, selects the newest installed Xcode,
builds the Forge scheme, runs `ForgeTests` while excluding `ScreenshotTests`, and packages an unsigned IPA.
The equivalent test command is:

```sh
xcodebuild test -project Forge.xcodeproj -scheme Forge -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -skip-testing:ForgeTests/ScreenshotTests
```

Use the simulator available on the runner when the named device is unavailable. Run `git diff --check`
and inspect the final diff. Device testing follows a successful pushed CI build.
