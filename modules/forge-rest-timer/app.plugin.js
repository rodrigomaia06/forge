const { withDangerousMod, withInfoPlist, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TARGET_NAME = 'ForgeRestTimerWidget';
function widgetSource(timerGlyphBase64) {
  return `import ActivityKit
import Foundation
import SwiftUI
import UIKit
import WidgetKit

struct ForgeRestTimerAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var startDate: Date
    var endDate: Date
    var isOverrun: Bool = false
    var tint: ForgeRestTimerTint = .normal
  }
}

enum ForgeRestTimerTint: String, Codable, Hashable {
  case normal
  case warning
  case overdue
}

private let forgeTimerNormal = Color.white
private let forgeTimerWarning = Color(red: 0.773, green: 0.541, blue: 0.271)
private let forgeTimerOverdue = Color(red: 0.784, green: 0.361, blue: 0.361)

private struct RestCount: View {
  let state: ForgeRestTimerAttributes.ContentState
  let isOverrun: Bool
  let color: Color

  var body: some View {
    if isOverrun {
      Text(timerInterval: state.endDate...state.endDate.addingTimeInterval(60 * 60), countsDown: false)
        .foregroundStyle(color)
    } else {
      Text(timerInterval: state.startDate...state.endDate, countsDown: true)
        .foregroundStyle(color)
    }
  }
}

private extension ActivityViewContext where Attributes == ForgeRestTimerAttributes {
  var forgeIsOverrun: Bool { state.isOverrun || isStale }

  var forgeTimerTint: Color {
    if forgeIsOverrun || state.tint == .overdue { return forgeTimerOverdue }
    if state.tint == .warning { return forgeTimerWarning }
    return forgeTimerNormal
  }
}

private extension Font {
  static func forgeTimer(_ size: CGFloat, relativeTo textStyle: Font.TextStyle = .body) -> Font {
    // The plugin bundles Manrope with the extension. SwiftUI falls back to the
    // system face if a build strips the resource, so a timer never disappears.
    .custom("Manrope-SemiBold", size: size, relativeTo: textStyle)
  }
}

// The extension has its own bundle, so it cannot read the parent app's asset
// catalog at runtime. The build plugin embeds Forge's existing rest-timer
// glyph into the extension source, preserving the same icon on every native
// timer surface rather than falling back to Apple's generic timer symbol.
private let forgeRestTimerGlyphData = "${timerGlyphBase64}"
private let forgeRestTimerGlyph = Data(base64Encoded: forgeRestTimerGlyphData).flatMap { UIImage(data: $0) }

private struct ForgeRestTimerGlyph: View {
  let color: Color

  var body: some View {
    Group {
      if let forgeRestTimerGlyph {
        Image(uiImage: forgeRestTimerGlyph)
          .resizable()
          .renderingMode(.template)
          .foregroundStyle(color)
          .scaledToFit()
      }
    }
  }
}

struct ForgeRestTimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: ForgeRestTimerAttributes.self) { context in
      HStack(spacing: 12) {
        HStack(spacing: 7) {
          ForgeRestTimerGlyph(color: context.forgeTimerTint)
            .frame(width: 23, height: 23)
          Text("Rest")
        }
          .font(.forgeTimer(20, relativeTo: .title2))
          .foregroundStyle(context.forgeTimerTint)
        Spacer()
        RestCount(state: context.state, isOverrun: context.forgeIsOverrun, color: context.forgeTimerTint)
          .font(.forgeTimer(42, relativeTo: .largeTitle).monospacedDigit())
          .frame(maxWidth: 150)
          .multilineTextAlignment(.trailing)
      }
      .padding()
      .activityBackgroundTint(Color.black.opacity(0.6))
      .activitySystemActionForegroundColor(.white)
      .widgetURL(URL(string: "forge://rest-timer/open"))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.center) {
          HStack(spacing: 8) {
            ForgeRestTimerGlyph(color: context.forgeTimerTint)
              .frame(width: 22, height: 22)
            RestCount(state: context.state, isOverrun: context.forgeIsOverrun, color: context.forgeTimerTint)
              .font(.forgeTimer(34, relativeTo: .largeTitle).monospacedDigit())
              .multilineTextAlignment(.center)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          ProgressView(timerInterval: context.state.startDate...context.state.endDate, countsDown: true) {
            EmptyView()
          } currentValueLabel: {
            EmptyView()
          }
          .tint(context.forgeTimerTint)
        }
      } compactLeading: {
        ForgeRestTimerGlyph(color: context.forgeTimerTint)
          .frame(width: 18, height: 18)
      } compactTrailing: {
        RestCount(state: context.state, isOverrun: context.forgeIsOverrun, color: context.forgeTimerTint)
          .font(.forgeTimer(15, relativeTo: .caption).monospacedDigit())
          .lineLimit(1)
          .minimumScaleFactor(0.6)
          .multilineTextAlignment(.trailing)
          .frame(width: 48)
      } minimal: {
        RestCount(state: context.state, isOverrun: context.forgeIsOverrun, color: context.forgeTimerTint)
          .font(.forgeTimer(12, relativeTo: .caption2).monospacedDigit())
          .lineLimit(1)
          .minimumScaleFactor(0.6)
          .frame(width: 32)
      }
      .keylineTint(context.forgeTimerTint)
      .widgetURL(URL(string: "forge://rest-timer/open"))
    }
  }
}

@main
struct ForgeRestTimerWidgetBundle: WidgetBundle {
  var body: some Widget {
    ForgeRestTimerLiveActivity()
  }
}
`;
}

function widgetInfoPlist(version, buildNumber, bundleIdentifier) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>${bundleIdentifier}</string>
  <key>CFBundleName</key><string>Forge Rest Timer</string>
  <key>CFBundleDisplayName</key><string>Forge Rest Timer</string>
  <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundlePackageType</key><string>XPC!</string>
  <key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict>
  <key>CFBundleShortVersionString</key><string>${version}</string>
  <key>CFBundleVersion</key><string>${buildNumber}</string>
  <key>UIAppFonts</key><array><string>Manrope-SemiBold.ttf</string></array>
</dict></plist>`;
}

function findBuildPhase(project, targetUuid, isa, name) {
  const target = project.pbxNativeTargetSection()[targetUuid];
  const phases = project.hash.project.objects[isa] || {};
  return target?.buildPhases?.find((entry) => phases[entry.value]?.name === name || (!name && phases[entry.value]))?.value;
}

function addTarget(config, widgetBundleIdentifier) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    let targetUuid = project.findTargetKey(TARGET_NAME);
    if (!targetUuid) {
      const target = project.addTarget(
        TARGET_NAME,
        'app_extension',
        TARGET_NAME,
        widgetBundleIdentifier,
      );
      targetUuid = target.uuid;
    }

    const nativeTarget = project.pbxNativeTargetSection()[targetUuid];
    const configList = project.pbxXCConfigurationList()[nativeTarget.buildConfigurationList];
    for (const entry of configList.buildConfigurations) {
      const buildConfig = project.pbxXCBuildConfigurationSection()[entry.value];
      buildConfig.buildSettings = {
        ...buildConfig.buildSettings,
        APPLICATION_EXTENSION_API_ONLY: 'YES',
        CURRENT_PROJECT_VERSION: `"${config.ios?.buildNumber ?? '1'}"`,
        INFOPLIST_FILE: `"${TARGET_NAME}/Info.plist"`,
        IPHONEOS_DEPLOYMENT_TARGET: `"${config.ios?.deploymentTarget ?? '16.4'}"`,
        MARKETING_VERSION: `"${config.ios?.version ?? config.version ?? '1.0'}"`,
        PRODUCT_BUNDLE_IDENTIFIER: `"${widgetBundleIdentifier}"`,
        SWIFT_VERSION: '5.0',
        TARGETED_DEVICE_FAMILY: '"1,2"',
      };
    }

    if (!findBuildPhase(project, targetUuid, 'PBXSourcesBuildPhase', 'Sources')) {
      project.addBuildPhase(
        [`${TARGET_NAME}/ForgeRestTimerLiveActivity.swift`],
        'PBXSourcesBuildPhase',
        'Sources',
        targetUuid,
        'app_extension',
        '""',
      );
    }
    if (!findBuildPhase(project, targetUuid, 'PBXFrameworksBuildPhase')) {
      project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', targetUuid, 'app_extension', '""');
    }
    const fontResource = `${TARGET_NAME}/Manrope-SemiBold.ttf`;
    // `xcode`'s addResourceFile assumes the parent app contains a PBXGroup
    // literally named Resources. Expo's generated projects do not guarantee
    // that group, and correctForResourcesPath then dereferences null during
    // prebuild. A resource build phase does not need that presentation group,
    // so add the font through the same phase API used for the extension Swift
    // source. It remains idempotent because the file reference is reused on
    // subsequent prebuilds.
    if (!project.hasFile(fontResource)) {
      project.addBuildPhase(
        [fontResource],
        'PBXResourcesBuildPhase',
        'Resources',
        targetUuid,
        'app_extension',
        '""',
      );
    }
    return config;
  });
}

module.exports = function withForgeRestTimerLiveActivity(config) {
  const appBundleIdentifier = config.ios?.bundleIdentifier;
  if (!appBundleIdentifier) {
    throw new Error('ForgeRestTimerWidget requires ios.bundleIdentifier.');
  }
  const widgetBundleIdentifier = `${appBundleIdentifier}.resttimer`;

  config = withInfoPlist(config, (config) => {
    config.modResults.NSSupportsLiveActivities = true;
    return config;
  });
  config = withDangerousMod(config, ['ios', async (config) => {
    const directory = path.join(config.modRequest.platformProjectRoot, TARGET_NAME);
    const glyphPath = path.join(config.modRequest.projectRoot, 'assets', 'forge-rest-notification-icon.png');
    const fontPath = path.join(
      config.modRequest.projectRoot,
      'node_modules',
      '@expo-google-fonts',
      'manrope',
      '600SemiBold',
      'Manrope_600SemiBold.ttf',
    );
    if (!fs.existsSync(glyphPath)) {
      throw new Error('ForgeRestTimerWidget requires assets/forge-rest-notification-icon.png.');
    }
    if (!fs.existsSync(fontPath)) {
      throw new Error('ForgeRestTimerWidget requires the bundled Manrope SemiBold font.');
    }
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'ForgeRestTimerLiveActivity.swift'),
      widgetSource(fs.readFileSync(glyphPath).toString('base64')),
    );
    fs.writeFileSync(
      path.join(directory, 'Info.plist'),
      widgetInfoPlist(
        config.ios?.version ?? config.version ?? '1.0',
        config.ios?.buildNumber ?? '1',
        widgetBundleIdentifier,
      ),
    );
    fs.copyFileSync(fontPath, path.join(directory, 'Manrope-SemiBold.ttf'));
    return config;
  }]);
  return addTarget(config, widgetBundleIdentifier);
};
