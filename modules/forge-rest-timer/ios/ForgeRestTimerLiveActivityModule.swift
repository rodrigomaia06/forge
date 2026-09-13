import ActivityKit
import ExpoModulesCore
import Foundation
import os.log

struct ForgeRestTimerAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var startDate: Date
    var endDate: Date
    var isOverrun: Bool = false
  }
}

/**
 * ActivityKit talks to a system daemon and can block. Keep all interaction off
 * the React Native/UI thread; SwiftUI owns the visible countdown from dates.
 */
final class ForgeRestTimerLiveActivityController {
  static let shared = ForgeRestTimerLiveActivityController()

  private let queue = DispatchQueue(label: "com.forge.training.rest-timer-live-activity")
  private var activity: Activity<ForgeRestTimerAttributes>?
  private var overrunTask: Task<Void, Never>?

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

    let isOverrun = end <= Date()
    let state = ForgeRestTimerAttributes.ContentState(
      startDate: start,
      endDate: end,
      isOverrun: isOverrun
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
      overrunTask?.cancel()
      overrunTask = nil
    } else {
      scheduleOverrun(start: start, end: end)
    }
  }

  private func scheduleOverrun(start: Date, end: Date) {
    overrunTask?.cancel()
    overrunTask = Task { [weak self] in
      let delay = end.timeIntervalSinceNow
      if delay > 0 {
        try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
      }
      guard !Task.isCancelled else { return }
      self?.queue.async { self?.pushOverrun(start: start, end: end) }
    }
  }

  private func pushOverrun(start: Date, end: Date) {
    guard let activity else { return }
    let state = ForgeRestTimerAttributes.ContentState(startDate: start, endDate: end, isOverrun: true)
    Task { await activity.update(ActivityContent(state: state, staleDate: end)) }
  }

  private func endAll() {
    overrunTask?.cancel()
    overrunTask = nil
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
