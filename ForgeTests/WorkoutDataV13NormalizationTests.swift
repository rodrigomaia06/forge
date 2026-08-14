//
//  WorkoutDataV13NormalizationTests.swift
//  ForgeTests
//

import XCTest
import CoreData
import WorkoutDataKit

final class WorkoutDataV13NormalizationTests: XCTestCase {
    private var container: NSPersistentContainer!

    override func setUp() {
        super.setUp()
        container = setUpInMemoryNSPersistentContainer()
    }

    override func tearDown() {
        container.viewContext.reset()
        container = nil
        super.tearDown()
    }

    func testNormalizationSeedsExercisesAndWorkoutMeasurements() throws {
        let context = container.viewContext
        let exercise = try XCTUnwrap(ExerciseStore().exercises.first)
        let workout = Workout.create(context: context)
        workout.start = Date()
        workout.end = Date().addingTimeInterval(3_600)

        let workoutExercise = WorkoutExercise.create(context: context)
        workoutExercise.exerciseUuid = exercise.uuid
        workoutExercise.workout = workout

        let set = WorkoutSet.create(context: context)
        set.repetitionsValue = 8
        set.weightValue = 42.5
        set.rpeValue = 8
        set.targetWeightValue = 45
        set.workoutExercise = workoutExercise

        try WorkoutDataV13Normalization.run(context: context)

        let definitions = try fetchObjects("ExerciseDefinition", context: context)
        XCTAssertTrue(definitions.contains { $0.value(forKey: "uuid") as? UUID == exercise.uuid })
        XCTAssertNotNil(workoutExercise.value(forKey: "exerciseDefinition"))

        let measurements = try fetchObjects("SetMeasurement", context: context)
        XCTAssertTrue(measurements.contains { $0.value(forKey: "kind") as? String == SetMeasurementKind.reps.rawValue && $0.value(forKey: "value") as? Double == 8 })
        XCTAssertTrue(measurements.contains { $0.value(forKey: "kind") as? String == SetMeasurementKind.weight.rawValue && $0.value(forKey: "value") as? Double == 42.5 })
        XCTAssertTrue(measurements.contains { $0.value(forKey: "kind") as? String == SetMeasurementKind.rpe.rawValue && $0.value(forKey: "value") as? Double == 8 })

        let targets = try fetchObjects("SetTarget", context: context)
        XCTAssertTrue(targets.contains { $0.value(forKey: "kind") as? String == SetMeasurementKind.weight.rawValue && $0.value(forKey: "minValue") as? Double == 45 })

        try WorkoutDataV13Normalization.run(context: context)
        XCTAssertEqual(try fetchObjects("SetMeasurement", context: context).count, measurements.count)
        XCTAssertEqual(try fetchObjects("SetTarget", context: context).count, targets.count)
    }

    func testNormalizationCopiesRoutineTargets() throws {
        let context = container.viewContext
        let exercise = try XCTUnwrap(ExerciseStore().exercises.first)
        let routine = WorkoutRoutine.create(context: context)

        let routineExercise = WorkoutRoutineExercise.create(context: context)
        routineExercise.exerciseUuid = exercise.uuid
        routineExercise.workoutRoutine = routine

        let set = WorkoutRoutineSet.create(context: context)
        set.minRepetitionsValue = 8
        set.maxRepetitionsValue = 12
        set.minTargetDurationValue = 30
        set.maxTargetDurationValue = 60
        set.workoutRoutineExercise = routineExercise

        try WorkoutDataV13Normalization.run(context: context)

        XCTAssertNotNil(routineExercise.value(forKey: "exerciseDefinition"))
        let targets = try fetchObjects("RoutineSetTarget", context: context)
        XCTAssertTrue(targets.contains { $0.value(forKey: "kind") as? String == SetMeasurementKind.reps.rawValue && $0.value(forKey: "minValue") as? Double == 8 && $0.value(forKey: "maxValue") as? Double == 12 })
        XCTAssertTrue(targets.contains { $0.value(forKey: "kind") as? String == SetMeasurementKind.duration.rawValue && $0.value(forKey: "minValue") as? Double == 30 && $0.value(forKey: "maxValue") as? Double == 60 })
    }

    private func fetchObjects(_ entityName: String, context: NSManagedObjectContext) throws -> [NSManagedObject] {
        let request = NSFetchRequest<NSManagedObject>(entityName: entityName)
        return try context.fetch(request)
    }
}
