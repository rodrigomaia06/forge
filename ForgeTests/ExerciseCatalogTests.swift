//
//  ExerciseCatalogTests.swift
//  ForgeTests
//

import XCTest
import Foundation
import WorkoutDataKit
@testable import Forge

final class ExerciseCatalogTests: XCTestCase {
    private let forearmExercises: [(title: String, alias: String, id: Int, uuid: UUID)] = [
        ("Wrist Curl: Dumbbell", "Forearm Curl: Dumbbell", 9018, UUID(uuidString: "6C96A29A-1AD0-47BF-9F67-8976987C5309")!),
        ("Wrist Curl: Barbell", "Forearm Curl: Barbell", 9019, UUID(uuidString: "918EDDBA-FB24-4AD2-962C-C3E07218E96C")!),
        ("Reverse Wrist Curl: Dumbbell", "Reverse Forearm Curl: Dumbbell", 9020, UUID(uuidString: "DD67B0B5-0F56-451A-9CB1-7D1997CCFBC0")!),
        ("Reverse Wrist Curl: Barbell", "Reverse Forearm Curl: Barbell", 9021, UUID(uuidString: "24526C9E-BDDC-487B-BA1A-E479C34D2261")!),
        ("Wrist Roller", "Forearm Roller", 9022, UUID(uuidString: "B5B02CC4-431D-4B04-9F5D-C01746C26381")!),
        ("Farmer's Hold: Dumbbell", "Farmer Hold: Dumbbell", 9023, UUID(uuidString: "07A98987-D490-41E8-BD7D-8361C0A62F9A")!)
    ]

    private func loadExercises() throws -> [Exercise] {
        let data = try Data(contentsOf: ExerciseStore.defaultBuiltInExercisesURL)
        return try JSONDecoder().decode([Exercise].self, from: data)
    }

    func testBuiltInCatalogHasUniqueStableIdentifiers() throws {
        let exercises = try loadExercises()

        XCTAssertEqual(Set(exercises.map(\.uuid)).count, exercises.count)
        XCTAssertEqual(Set(exercises.map(\.everkineticId)).count, exercises.count)

        for expected in forearmExercises {
            let exercise = try XCTUnwrap(exercises.first { $0.title == expected.title })
            XCTAssertEqual(exercise.everkineticId, expected.id)
            XCTAssertEqual(exercise.uuid, expected.uuid)
            XCTAssertLessThan(exercise.everkineticId, 10000)
        }
    }

    func testForearmExercisesAreSearchableByTitleAndAlias() throws {
        let exercises = try loadExercises()

        for expected in forearmExercises {
            XCTAssertTrue(ExerciseStore.filter(exercises: exercises, using: expected.title).contains { $0.title == expected.title })
            XCTAssertTrue(ExerciseStore.filter(exercises: exercises, using: expected.alias).contains { $0.title == expected.title })
        }
    }

    func testForearmMuscleGroupsUnderArms() throws {
        XCTAssertEqual(Exercise.commonMuscleName(for: "forearm"), "forearms")
        XCTAssertEqual(Exercise.muscleGroup(for: "forearm"), "arms")

        let exercises = try loadExercises()
        for title in forearmExercises.map(\.title) {
            let exercise = try XCTUnwrap(exercises.first { $0.title == title })
            XCTAssertEqual(exercise.muscleGroup, "arms")
        }
    }

    func testActivityCatalogEntriesKeepSharedExerciseIdentityAcrossSections() throws {
        let exercises = try loadExercises()
        let jumpRope = try XCTUnwrap(exercises.first { $0.title == "Jump Rope" })

        XCTAssertEqual(exercises.filter { $0.title == "Jump Rope" }.count, 1)
        XCTAssertEqual(jumpRope.everkineticId, 9111)
        XCTAssertEqual(jumpRope.uuid, UUID(uuidString: "E95657DA-C588-4417-B7F4-7557E16A1EAA")!)
        XCTAssertTrue(jumpRope.activityCategories.contains(.cardio))
        XCTAssertTrue(jumpRope.activityCategories.contains(.martialArts))
        XCTAssertEqual(jumpRope.defaultMetric, .time)

        let groups = ExerciseStore.splitIntoActivityGroups(exercises: [jumpRope])
        XCTAssertTrue(groups.first { $0.title == ExerciseActivityCategory.cardio.title }?.exercises.contains(jumpRope) == true)
        XCTAssertTrue(groups.first { $0.title == ExerciseActivityCategory.martialArts.title }?.exercises.contains(jumpRope) == true)
        XCTAssertEqual(Set(groups.flatMap(\.exercises).map(\.uuid)).count, 1)
    }

    func testCourtSportsCategoryUsesStableIDAndDecodesOldTennisID() throws {
        let exercises = try loadExercises()
        let forehand = try XCTUnwrap(exercises.first { $0.title == "Forehand" })

        XCTAssertTrue(forehand.activityCategories.contains(.courtSports))
        XCTAssertTrue(forehand.activityCategoryIDs.contains("court_sports"))
        XCTAssertEqual(ExerciseActivityCategory.category(forWorkoutTypeTitle: "Court sports"), .courtSports)
        XCTAssertEqual(ExerciseActivityCategory.categoryID(forWorkoutTypeTitle: "Tennis"), "court_sports")

        let decoded = try JSONDecoder().decode([ExerciseActivityCategory].self, from: Data(#"["tennis"]"#.utf8))
        XCTAssertEqual(decoded, [.courtSports])
    }

    func testNewActivityCatalogEntriesAreSearchable() throws {
        let exercises = try loadExercises()
        for title in ["Treadmill", "Forehand", "Heavy Bag", "Hip Mobility"] {
            XCTAssertTrue(ExerciseStore.filter(exercises: exercises, using: title).contains { $0.title == title })
        }
    }

    func testBuiltInCatalogHasMovementMetadata() throws {
        let exercises = try loadExercises()

        for exercise in exercises {
            XCTAssertFalse(exercise.movementID.isEmpty, exercise.title)
            XCTAssertFalse(exercise.movementTitle.isEmpty, exercise.title)
            XCTAssertFalse(exercise.variationTags.isEmpty, exercise.title)
        }
    }

    func testCatalogCleanupGroupsKnownDuplicateTitles() throws {
        let exercises = try loadExercises()

        let shrugIDs = Set(exercises.filter { $0.title.contains("Shrug") }.map(\.movementID))
        XCTAssertEqual(shrugIDs, ["shrug"])

        let facePullIDs = Set(exercises.filter { $0.title.contains("Face Pull") }.map(\.movementID))
        XCTAssertEqual(facePullIDs, ["face_pull"])

        let skullCrusherIDs = Set(exercises.filter { $0.title.contains("Skull") }.map(\.movementID))
        XCTAssertEqual(skullCrusherIDs, ["skull_crusher"])
    }

    func testCatalogCleanupNormalizesEquipmentForGrouping() throws {
        let exercises = try loadExercises()

        let reverseFlyes = try XCTUnwrap(exercises.first { $0.title == "Reverse Flyes: Cable" })
        XCTAssertEqual(reverseFlyes.equipment, ["cable"])
        XCTAssertTrue(reverseFlyes.variationTags.contains("cable"))

        for exercise in exercises where exercise.title.contains("EZ Curl Bar") || exercise.title.contains("Skull Crusher") || exercise.title.contains("Skullcrusher") {
            XCTAssertTrue(exercise.equipment.contains("ez-curl-bar"), exercise.title)
            XCTAssertTrue(exercise.variationTags.contains("ez-curl-bar"), exercise.title)
        }
    }
}
