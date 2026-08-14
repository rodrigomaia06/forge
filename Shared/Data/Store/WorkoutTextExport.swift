//
//  WorkoutTextExport.swift
//  Forge
//

import Foundation
import WorkoutDataKit

enum WorkoutTextExport {
    static func export(
        workouts: [Workout],
        exercises: [Exercise],
        weightUnit: WeightUnit,
        fallbackBodyweight: Double,
        showPlanInWorkoutTitle: Bool
    ) -> String {
        workouts
            .compactMap {
                format(
                    workout: $0,
                    exercises: exercises,
                    weightUnit: weightUnit,
                    fallbackBodyweight: fallbackBodyweight,
                    showPlanInWorkoutTitle: showPlanInWorkoutTitle
                )
            }
            .joined(separator: "\n\n")
    }

    private static func format(
        workout: Workout,
        exercises: [Exercise],
        weightUnit: WeightUnit,
        fallbackBodyweight: Double,
        showPlanInWorkoutTitle: Bool
    ) -> String? {
        guard workout.start != nil || workout.end != nil else { return nil }

        let workoutExercises = visibleWorkoutExercises(workout)
        let completedSets = workoutExercises.flatMap { visibleWorkoutSets($0) }
        let title = workout.displayTitle(in: exercises, showPlan: showPlanInWorkoutTitle)
        let type = workout.workoutType?.displayTitle ?? WorkoutType.fallbackTitle
        let totalWeight = workout.totalCompletedWeight(fallbackBodyweight: fallbackBodyweight)

        var lines: [String] = [
            title,
            "Type: \(type)"
        ]

        if let dateLine = dateRangeLine(for: workout) {
            lines.append(dateLine)
        }
        if let duration = workout.duration {
            lines.append("Duration: \(Workout.durationFormatter.string(from: duration) ?? WorkoutSet.durationString(from: duration))")
        }

        var summary: [String] = [
            quantity(workoutExercises.count, singular: "exercise", plural: "exercises"),
            quantity(completedSets.count, singular: "set", plural: "sets")
        ]
        if let totalWeight, totalWeight > 0 {
            summary.append("Volume: \(WeightUnit.format(weight: totalWeight, from: .metric, to: weightUnit))")
        }
        lines.append("Summary: \(summary.joined(separator: ", "))")

        if !workout.customAttributes.isEmpty {
            lines.append("")
            lines.append("Fields:")
            for key in workout.customAttributes.keys.sorted() {
                guard let value = workout.customAttributes[key], !value.isBlank else { continue }
                lines.append("\(key): \(value)")
            }
        }

        if let comment = workout.comment, !comment.isBlank {
            lines.append("")
            lines.append("Comment:")
            lines.append(comment)
        }

        if workoutExercises.isEmpty {
            return lines.joined(separator: "\n")
        }

        lines.append("")
        lines.append("Exercises:")

        for workoutExercise in workoutExercises {
            let exerciseTitle = workoutExercise.exercise(in: exercises)?.title ?? "Unknown exercise"
            let metric = workoutExercise.metricValue(in: exercises)
            let sets = visibleWorkoutSets(workoutExercise)

            lines.append("")
            lines.append(exerciseTitle)

            if let comment = workoutExercise.comment, !comment.isBlank {
                lines.append("Note: \(comment)")
            }
            if let supersetComment = workoutExercise.supersetComment, !supersetComment.isBlank {
                lines.append("Superset note: \(supersetComment)")
            }

            if sets.isEmpty {
                lines.append("No completed sets")
            } else {
                for (index, set) in sets.enumerated() {
                    lines.append("\(index + 1). \(setLine(set, metric: metric, weightUnit: weightUnit))")
                    if let comment = set.comment, !comment.isBlank {
                        lines.append("   Set note: \(comment)")
                    }
                }
            }
        }

        return lines.joined(separator: "\n")
    }

    private static func dateRangeLine(for workout: Workout) -> String? {
        switch (workout.start, workout.end) {
        case let (start?, end?):
            if Calendar.current.isDate(start, inSameDayAs: end) {
                return "Time: \(dateFormatter.string(from: start)) to \(timeFormatter.string(from: end))"
            }
            return "Time: \(dateFormatter.string(from: start)) to \(dateFormatter.string(from: end))"
        case let (start?, nil):
            return "Started: \(dateFormatter.string(from: start))"
        case let (nil, end?):
            return "Ended: \(dateFormatter.string(from: end))"
        default:
            return nil
        }
    }

    private static func visibleWorkoutExercises(_ workout: Workout) -> [WorkoutExercise] {
        workout.workoutExercises?.array
            .compactMap { $0 as? WorkoutExercise }
            .filter { !visibleWorkoutSets($0).isEmpty }
        ?? []
    }

    private static func visibleWorkoutSets(_ workoutExercise: WorkoutExercise) -> [WorkoutSet] {
        workoutExercise.workoutSets?.array
            .compactMap { $0 as? WorkoutSet }
            .filter { $0.isCompleted }
        ?? []
    }

    private static func setLine(_ set: WorkoutSet, metric: ExerciseSetMetric, weightUnit: WeightUnit) -> String {
        var parts = [set.logTitle(metric: metric, weightUnit: weightUnit)]

        if let rpe = set.rpeValue {
            parts.append("RPE \(rpeFormatter.string(from: NSNumber(value: rpe)) ?? "\(rpe)")")
        }
        if let minReps = set.minTargetRepetitionsValue, let maxReps = set.maxTargetRepetitionsValue {
            parts.append(minReps == maxReps ? "target \(minReps)" : "target \(minReps)-\(maxReps)")
        }
        if let targetDuration = WorkoutSet.durationIntervalString(minDuration: set.minTargetDurationValue, maxDuration: set.maxTargetDurationValue) {
            parts.append("target \(targetDuration)")
        }
        if let distance = set.targetDistanceValue {
            parts.append("target \(WorkoutSet.distanceString(from: distance))")
        }

        return parts.joined(separator: " | ")
    }

    private static func quantity(_ count: Int, singular: String, plural: String) -> String {
        count == 1 ? "1 \(singular)" : "\(count) \(plural)"
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    private static let rpeFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 1
        return formatter
    }()
}

private extension String {
    var isBlank: Bool {
        trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
