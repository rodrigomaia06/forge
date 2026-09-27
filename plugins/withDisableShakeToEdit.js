const { withAppDelegate } = require('expo/config-plugins');

// iOS pops a system "Undo Typing?" alert when the device is shaken while a text
// field is focused (UIKit's shake-to-edit gesture). During a live workout the
// user routinely shakes the phone (racking weights, wiping sweat) while a set
// value is focused, so the alert fires unprompted. There is no Info.plist key
// for this; UIKit only exposes `applicationSupportsShakeToEdit`, which must be
// disabled on the shared UIApplication at launch. This is a managed Expo
// project with no committed `ios/`, so we patch the prebuilt AppDelegate here.
//
// Note: this is independent of React Native's debug "shake to open dev menu"
// gesture, which RN implements via its own motion handling, not this flag.
const MARKER = 'applicationSupportsShakeToEdit';

// Matches the Swift `application(_:didFinishLaunchingWithOptions:)` header,
// including its multi-line signature and default launchOptions argument, and
// captures through the opening brace so we can inject right after it.
const SWIFT_DID_FINISH = /(func application\(\s*_\s+application:[\s\S]*?didFinishLaunchingWithOptions[\s\S]*?\)\s*->\s*Bool\s*\{)/;

// Objective-C fallback for older AppDelegate templates.
const OBJC_DID_FINISH = /(-\s*\(BOOL\)application:\(UIApplication \*\)application\s+didFinishLaunchingWithOptions:[\s\S]*?\{)/;

function withDisableShakeToEdit(config) {
  return withAppDelegate(config, (config) => {
    const { modResults } = config;
    let contents = modResults.contents;

    if (contents.includes(MARKER)) {
      return config;
    }

    if (SWIFT_DID_FINISH.test(contents)) {
      contents = contents.replace(
        SWIFT_DID_FINISH,
        `$1\n    application.applicationSupportsShakeToEdit = false`,
      );
    } else if (OBJC_DID_FINISH.test(contents)) {
      contents = contents.replace(
        OBJC_DID_FINISH,
        `$1\n  application.applicationSupportsShakeToEdit = NO;`,
      );
    } else {
      console.warn(
        '[withDisableShakeToEdit] Could not locate didFinishLaunchingWithOptions ' +
          'in the AppDelegate; shake-to-undo was left enabled.',
      );
      return config;
    }

    modResults.contents = contents;
    return config;
  });
}

module.exports = withDisableShakeToEdit;
