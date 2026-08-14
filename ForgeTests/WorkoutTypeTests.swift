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
        let courtSports = try XCTUnwrap(try WorkoutType.find(title: "Court sports", in: context))
        courtSports.isArchived = true
        try context.save()

        try WorkoutType.seedDefaultsIfNeeded(context: context)

        XCTAssertTrue(courtSports.isArchived)
    }

    func testDefaultTypeSeedingUpdatesOldPresetColorsOnly() throws {
        let strength = WorkoutType.create(context: context)
        strength.uuid = WorkoutType.defaultPresets[0].uuid
        strength.title = "Strength"
        strength.colorHex = "#3B82F6"
        let courtSports = WorkoutType.create(context: context)
        courtSports.uuid = WorkoutType.defaultPresets[1].uuid
        courtSports.title = "Tennis"
        courtSports.colorHex = "#123456"
        try context.save()

        try WorkoutType.seedDefaultsIfNeeded(context: context)

        XCTAssertEqual(strength.displayColorHex, WorkoutType.defaultPresets[0].colorHex)
        XCTAssertEqual(courtSports.displayTitle, "Court sports")
        XCTAssertEqual(courtSports.displayColorHex, "#123456")
    }

    func testDefaultTypeSeedingKeepsUserRenamedPresetTitle() throws {
        let type = WorkoutType.create(context: context)
        type.uuid = WorkoutType.defaultPresets[1].uuid
        type.title = "Padel"
        type.colorHex = WorkoutType.defaultPresets[1].colorHex
        try context.save()

        try WorkoutType.seedDefaultsIfNeeded(context: context)

        XCTAssertEqual(type.displayTitle, "Padel")
        XCTAssertEqual(type.exerciseCategoryID, "court_sports")
    }

    func testArchivedTypeStaysReadableOnOldWorkout() throws {
        try WorkoutType.seedDefaultsIfNeeded(context: context)
        let courtSports = try XCTUnwrap(try WorkoutType.find(title: "Court sports", in: context))
        courtSports.isArchived = true

        let workout = Workout.create(context: context)
        workout.start = Date(timeIntervalSince1970: 1_700_000_000)
        workout.end = Date(timeIntervalSince1970: 1_700_003_600)
        workout.workoutType = courtSports
        try context.save()

        XCTAssertTrue(workout.workoutType?.isArchived == true)
        XCTAssertEqual(workout.workoutType?.displayTitle, "Court sports")
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

    func testDeletingUnusedCustomTypeRemovesIt() throws {
        let type = try WorkoutType.findOrCreate(title: "Tennis drills", colorHex: "#22C55E", in: context)
        try context.save()

        type.deleteOrArchive(in: context)
        try context.save()

        XCTAssertNil(try WorkoutType.find(title: "Tennis drills", in: context))
    }

    func testDeletingReferencedTypeArchivesIt() throws {
        let type = try WorkoutType.findOrCreate(title: "Tennis drills", colorHex: "#22C55E", in: context)
        let workout = Workout.create(context: context)
        workout.title = "Serve practice"
        workout.start = Date(timeIntervalSince1970: 1_700_000_000)
        workout.end = Date(timeIntervalSince1970: 1_700_003_600)
        workout.workoutType = type
        try context.save()

        type.deleteOrArchive(in: context)
        try context.save()

        XCTAssertEqual(try WorkoutType.find(title: "Tennis drills", in: context)?.objectID, type.objectID)
        XCTAssertTrue(type.isArchived)
        XCTAssertEqual(workout.workoutType?.objectID, type.objectID)
    }
}
