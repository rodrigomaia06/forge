import ActivityKit
import ExpoModulesCore
import Foundation
import os.log

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

/**
 * ActivityKit talks to a system daemon and can block. Keep all interaction off
 * the React Native/UI thread; SwiftUI owns the visible countdown from dates.
 */
final class ForgeRestTimerLiveActivityController {
  static let shared = ForgeRestTimerLiveActivityController()

  private let queue = DispatchQueue(label: "com.forge.training.rest-timer-live-activity")
  private var activity: Activity<ForgeRestTimerAttributes>?
  private var tintTask: Task<Void, Never>?

  private init() {}

  func sync(start: Date, end: Date) {
    queue.async { [self] in
      apply(start: start, end: end)
    }
  }

  func stop() {
    queue.async { [self] in
      endAll()
    }
  }

  private func apply(start: Date, end: Date) {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      endAll()
      return
    }

    let now = Date()
    let isOverrun = end <= now
    let state = ForgeRestTimerAttributes.ContentState(
      startDate: start,
      endDate: end,
      isOverrun: isOverrun,
      tint: timerTint(start: start, end: end, now: now)
    )
    let content = ActivityContent(state: state, staleDate: end)

    // Adopt a prior process' activity after a React Native/app relaunch so a
    // changed rest duration updates instead of creating a duplicate island.
    if activity == nil {
      activity = Activity<ForgeRestTimerAttributes>.activities.first
    }

    if let activity {
      Task { await activity.update(content) }
    } else {
      do {
        activity = try Activity.request(
          attributes: ForgeRestTimerAttributes(),
          content: content,
          pushType: nil
        )
      } catch {
        os_log("Could not start Forge rest Live Activity: %{public}@", type: .error, error.localizedDescription)
      }
    }

    if isOverrun {
      tintTask?.cancel()
      tintTask = nil
    } else {
      scheduleTintUpdate(start: start, end: end, now: now)
    }
  }

  private func timerTint(start: Date, end: Date, now: Date) -> ForgeRestTimerTint {
    guard end > now else { return .overdue }
    let totalDuration = max(1, end.timeIntervalSince(start))
    return end.timeIntervalSince(now) <= totalDuration * 0.2 ? .warning : .normal
  }

  private func scheduleTintUpdate(start: Date, end: Date, now: Date) {
    tintTask?.cancel()
    let warningAt = end.addingTimeInterval(-max(1, end.timeIntervalSince(start)) * 0.2)
    let nextTransition = now < warningAt ? warningAt : end
    tintTask = Task { [weak self] in
      let delay = nextTransition.timeIntervalSinceNow
      if delay > 0 {
        try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
      }
      guard !Task.isCancelled else { return }
      self?.queue.async { self?.apply(start: start, end: end) }
    }
  }

  private func endAll() {
    tintTask?.cancel()
    tintTask = nil
    activity = nil
    for activity in Activity<ForgeRestTimerAttributes>.activities {
      Task { await activity.end(nil, dismissalPolicy: .immediate) }
    }
  }
}

public final class ForgeRestTimerLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ForgeRestTimerLiveActivity")

    AsyncFunction("syncAsync") { (startAt: Double, endAt: Double) in
      ForgeRestTimerLiveActivityController.shared.sync(
        start: Date(timeIntervalSince1970: startAt / 1_000),
        end: Date(timeIntervalSince1970: endAt / 1_000)
      )
    }

    AsyncFunction("stopAsync") {
      ForgeRestTimerLiveActivityController.shared.stop()
    }
  }
}
