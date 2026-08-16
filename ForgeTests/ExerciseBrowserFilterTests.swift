//
//  ExerciseBrowserFilterTests.swift
//  ForgeTests
//

import XCTest
import WorkoutDataKit
@testable import Forge

final class ExerciseBrowserFilterTests: XCTestCase {
    private func exercise(
        _ title: String,
        alias: [String] = [],
        categories: [ExerciseActivityCategory] = [.strength],
        primary: [String] = ["biceps brachii"],
        equipment: [String]
    ) -> Exercise {
        Exercise(
            uuid: UUID(),
            everkineticId: 20_000 + title.count,
            title: title,
            alias: alias,
            activityCategories: categories,
            description: nil,
            primaryMuscle: primary,
            secondaryMuscle: [],
            equipment: equipment,
            steps: [],
            tips: [],
            references: []
        )
    }

    func testFiltersBySearchEquipmentBodyPartAndCategory() {
        let pullUp = exercise("Pull Up", alias: ["Chin Up"], primary: ["latissimus dorsi"], equipment: ["body", "bar"])
        let curl = exercise("Biceps Curl: Dumbbell", equipment: ["dumbbell"])
        let forehand = exercise("Forehand", categories: [.courtSports], primary: ["forearm"], equipment: ["racket"])
        let exercises = [pullUp, curl, forehand]

        var filter = ExerciseBrowserFilter(search: "chin")
        XCTAssertEqual(filter.filteredExercises(from: exercises).map(\.title), ["Pull Up"])

        filter = ExerciseBrowserFilter(equipment: "dumbbell")
        XCTAssertEqual(filter.filteredExercises(from: exercises).map(\.title), ["Biceps Curl: Dumbbell"])

        filter = ExerciseBrowserFilter(bodyPart: "back")
        XCTAssertEqual(filter.filteredExercises(from: exercises).map(\.title), ["Pull Up"])

        filter = ExerciseBrowserFilter(search: "fore", equipment: "racket", category: .courtSports)
        XCTAssertEqual(filter.filteredExercises(from: exercises).map(\.title), ["Forehand"])
    }

    func testFilteredGroupsDropEmptySections() {
        let strength = exercise("Pull Up", primary: ["latissimus dorsi"], equipment: ["body"])
        let tennis = exercise("Forehand", categories: [.courtSports], primary: ["forearm"], equipment: ["racket"])
        let groups = [
            ExerciseGroup(title: "Strength", exercises: [strength]),
            ExerciseGroup(title: "Court sports", exercises: [tennis])
        ]

        let filter = ExerciseBrowserFilter(category: .courtSports)
        let result = filter.filteredGroups(groups)

        XCTAssertEqual(result.map(\.title), ["Court sports"])
        XCTAssertEqual(result.first?.exercises.map(\.title), ["Forehand"])
    }

    func testEquipmentOptionsUseCommonLabels() {
        let exercises = [
            exercise("Push Up", equipment: ["body"]),
            exercise("Cable Row", equipment: ["cable"]),
            exercise("Incline Press", equipment: ["bench: incline"])
        ]

        let options = ExerciseBrowserFilter.equipmentOptions(from: exercises)

        XCTAssertTrue(options.contains { $0.label == "Bodyweight" && $0.token == "body" })
        XCTAssertTrue(options.contains { $0.label == "Cable" && $0.token == "cable" })
        XCTAssertTrue(options.contains { $0.label == "Bench: Incline" && $0.token == "bench: incline" })
    }

    func testAddExerciseSheetUsesPreferredCategoryAsInitialFilter() {
        XCTAssertEqual(AddExercisesSheet.initialFilter(preferredCategory: .courtSports).category, .courtSports)
        XCTAssertEqual(AddExercisesSheet.initialFilter(preferredCategory: .martialArts).category, .martialArts)
    }
}
