const { withDangerousMod, withInfoPlist, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TARGET_NAME = 'ForgeRestTimerWidget';
const WIDGET_SOURCE = `import ActivityKit
import SwiftUI
import WidgetKit

struct ForgeRestTimerAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var startDate: Date
    var endDate: Date
    var isOverrun: Bool = false
  }
}

private struct RestCount: View {
  let state: ForgeRestTimerAttributes.ContentState
  let isOverrun: Bool

  var body: some View {
    if isOverrun {
      Text(timerInterval: state.endDate...state.endDate.addingTimeInterval(60 * 60), countsDown: false)
        .foregroundStyle(Color.red)
    } else {
      Text(timerInterval: state.startDate...state.endDate, countsDown: true)
        .foregroundStyle(Color.white)
    }
  }
}

private extension ActivityViewContext where Attributes == ForgeRestTimerAttributes {
  var forgeIsOverrun: Bool { state.isOverrun || isStale }
}

struct ForgeRestTimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: ForgeRestTimerAttributes.self) { context in
      HStack(spacing: 12) {
        Label("Rest", systemImage: "timer")
          .font(.title2.weight(.semibold))
          .foregroundStyle(context.forgeIsOverrun ? Color.red : Color.white)
        Spacer()
        RestCount(state: context.state, isOverrun: context.forgeIsOverrun)
          .font(.system(size: 42, weight: .semibold).monospacedDigit())
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
            Image(systemName: "timer")
              .font(.title2)
              .foregroundStyle(context.forgeIsOverrun ? Color.red : Color.secondary)
            RestCount(state: context.state, isOverrun: context.forgeIsOverrun)
              .font(.largeTitle.monospacedDigit())
              .multilineTextAlignment(.center)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          ProgressView(timerInterval: context.state.startDate...context.state.endDate, countsDown: true) {
            EmptyView()
          } currentValueLabel: {
            EmptyView()
          }
          .tint(context.forgeIsOverrun ? Color.red : Color.white)
        }
      } compactLeading: {
        Image(systemName: "timer")
          .foregroundStyle(context.forgeIsOverrun ? Color.red : Color.white)
      } compactTrailing: {
        RestCount(state: context.state, isOverrun: context.forgeIsOverrun)
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.6)
          .multilineTextAlignment(.trailing)
          .frame(width: 48)
      } minimal: {
        RestCount(state: context.state, isOverrun: context.forgeIsOverrun)
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.6)
          .frame(width: 32)
      }
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

function widgetInfoPlist(version, buildNumber) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict>
  <key>CFBundleShortVersionString</key><string>${version}</string>
  <key>CFBundleVersion</key><string>${buildNumber}</string>
</dict></plist>`;
}

function findBuildPhase(project, targetUuid, isa, name) {
  const target = project.pbxNativeTargetSection()[targetUuid];
  const phases = project.hash.project.objects[isa] || {};
  return target?.buildPhases?.find((entry) => phases[entry.value]?.name === name || (!name && phases[entry.value]))?.value;
}

function addTarget(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    let targetUuid = project.findTargetKey(TARGET_NAME);
    if (!targetUuid) {
      const target = project.addTarget(
        TARGET_NAME,
        'app_extension',
        TARGET_NAME,
        `${config.ios?.bundleIdentifier}.${'resttimer'}`,
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
        PRODUCT_BUNDLE_IDENTIFIER: `"${config.ios?.bundleIdentifier}.resttimer"`,
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
    return config;
  });
}

module.exports = function withForgeRestTimerLiveActivity(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.NSSupportsLiveActivities = true;
    return config;
  });
  config = withDangerousMod(config, ['ios', async (config) => {
    const directory = path.join(config.modRequest.platformProjectRoot, TARGET_NAME);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'ForgeRestTimerLiveActivity.swift'), WIDGET_SOURCE);
    fs.writeFileSync(
      path.join(directory, 'Info.plist'),
      widgetInfoPlist(config.ios?.version ?? config.version ?? '1.0', config.ios?.buildNumber ?? '1'),
    );
    return config;
  }]);
  return addTarget(config);
};
