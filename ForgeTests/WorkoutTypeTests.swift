//
//  WorkoutTypeTests.swift
//  ForgeTests
//

import XCTest
import CoreData
@testable import Forge
import WorkoutDataKit

final class WorkoutTypeTests: XCTestCase {
    var container: NSPersistentContainer!
    var context: NSManagedObjectContext { container.viewContext }

    override func setUp() {
        super.setUp()
        container = setUpInMemoryNSPersistentContainer()
    }

    override func tearDown() {
        context.reset()
        container = nil
        super.tearDown()
    }

    private func fetchTypes() throws -> [WorkoutType] {
        try context.fetch(WorkoutType.fetchRequestSorted())
    }

    func testDefaultTypeSeedingIsIdempotent() throws {
        try WorkoutType.seedDefaultsIfNeeded(context: context)
        try WorkoutType.seedDefaultsIfNeeded(context: context)

        let types = try fetchTypes()
        XCTAssertEqual(types.count, WorkoutType.defaultPresets.count)
        XCTAssertEqual(types.map(\.displayTitle), WorkoutType.defaultPresets.map(\.title))
        XCTAssertEqual(Set(types.compactMap(\.uuid)).count, WorkoutType.defaultPresets.count)
    }

    func testDefaultTypeSeedingDoesNotUnarchiveUserArchivedPreset() throws {
        try WorkoutType.seedDefaultsIfNeeded(context: context)
        let tennis = try XCTUnwrap(try WorkoutType.find(title: "Tennis", in: context))
        tennis.isArchived = true
        try context.save()

        try WorkoutType.seedDefaultsIfNeeded(context: context)

        XCTAssertTrue(tennis.isArchived)
    }

    func testArchivedTypeStaysReadableOnOldWorkout() throws {
        try WorkoutType.seedDefaultsIfNeeded(context: context)
        let tennis = try XCTUnwrap(try WorkoutType.find(title: "Tennis", in: context))
        tennis.isArchived = true

        let workout = Workout.create(context: context)
        workout.workoutType = tennis
        try context.save()

        XCTAssertTrue(workout.workoutType?.isArchived == true)
        XCTAssertEqual(workout.workoutType?.displayTitle, "Tennis")
    }

    func testRoutineDefaultTypeCopiesToStartedWorkout() throws {
        try WorkoutType.seedDefaultsIfNeeded(context: context)
        let cardio = try XCTUnwrap(try WorkoutType.find(title: "Cardio", in: context))
        let routine = WorkoutRoutine.create(context: context)
        routine.defaultWorkoutType = cardio

        let workout = routine.createWorkout(context: context)

        XCTAssertEqual(workout.workoutType, cardio)
    }

    func testWorkoutTypeRoundTripsThroughJSON() throws {
        let martialArts = try WorkoutType.findOrCreate(title: "Martial arts", colorHex: "#EF4444", in: context)
        let workout = Workout.create(context: context)
        workout.title = "Sparring"
        workout.start = Date(timeIntervalSince1970: 1_700_000_000)
        workout.end = Date(timeIntervalSince1970: 1_700_003_600)
        workout.workoutType = martialArts
        try context.save()

        let data = try WorkoutDataExchange.export(workouts: [workout])
        let other = setUpInMemoryNSPersistentContainer().viewContext
        _ = try WorkoutDataExchange.import(data, into: other, includeWorkouts: true)

        let importedWorkouts = try other.fetch(NSFetchRequest<Workout>(entityName: "Workout"))
        XCTAssertEqual(importedWorkouts.first?.workoutType?.displayTitle, "Martial arts")
        XCTAssertEqual(importedWorkouts.first?.workoutType?.displayColorHex, "#EF4444")
    }
}
