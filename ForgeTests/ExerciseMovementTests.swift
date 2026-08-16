//
//  ExerciseMovementTests.swift
//  ForgeTests
//

import XCTest
import CoreData
import WorkoutDataKit
@testable import Forge

final class ExerciseMovementTests: XCTestCase {
    private func exercise(
        title: String,
        movementID: String? = nil,
        movementTitle: String? = nil,
        variationTitle: String? = nil,
        variationTags: [String] = [],
        equipment: [String]
    ) -> Exercise {
        Exercise(
            uuid: UUID(),
            everkineticId: 30_000 + title.count,
            title: title,
            alias: [],
            movementID: movementID,
            movementTitle: movementTitle,
            variationTitle: variationTitle,
            variationTags: variationTags,
            description: nil,
            primaryMuscle: ["pectoralis major"],
            secondaryMuscle: [],
            equipment: equipment,
            steps: [],
            tips: [],
            references: []
        )
    }

    func testOldExerciseJSONDecodesWithDerivedMovementMetadata() throws {
        let json = """
        {
          "uuid": "AA3C081D-2A51-4E20-B112-3B5C265B0A28",
          "id": 3,
          "title": "Bench Press: Dumbbell (Incline)",
          "alias": [],
          "primary": ["pectoralis major"],
          "secondary": ["triceps brachii"],
          "equipment": ["dumbbell", "bench: incline"],
          "steps": [],
          "tips": [],
          "references": []
        }
        """

        let exercise = try JSONDecoder().decode(Exercise.self, from: Data(json.utf8))

        XCTAssertEqual(exercise.movementID, "bench_press")
        XCTAssertEqual(exercise.movementTitle, "Bench Press")
        XCTAssertNil(exercise.variationTitle)
        XCTAssertEqual(exercise.equipmentTitle, "Dumbbell")
        XCTAssertEqual(exercise.setupTitle, "Incline")
        XCTAssertTrue(exercise.variationTags.contains("dumbbell"))
    }

    func testMovementGroupingSortsMovementAndVariationTitles() {
        let dumbbell = exercise(title: "Bench Press: Dumbbell", movementID: "bench_press", movementTitle: "Bench press", variationTitle: "Dumbbell", equipment: ["dumbbell"])
        let barbell = exercise(title: "Bench Press: Barbell", movementID: "bench_press", movementTitle: "Bench press", variationTitle: "Barbell", equipment: ["barbell"])
        let row = exercise(title: "Row: Cable", movementID: "row", movementTitle: "Row", variationTitle: "Cable", equipment: ["cable"])

        let movements = ExerciseStore.splitIntoMovements(exercises: [dumbbell, row, barbell])

        XCTAssertEqual(movements.map(\.title), ["Bench press", "Row"])
        XCTAssertEqual(movements.first?.variations.map { $0.exercise.variationDisplayTitle }, ["Equipment: Barbell", "Equipment: Dumbbell"])
    }

    func testEquipmentGroupingSortsExactVariationsWithinEquipment() {
        let rope = exercise(title: "Biceps Curl: Cable (Rope)", movementID: "biceps_curl", movementTitle: "Biceps curl", variationTitle: "Cable, rope", equipment: ["cable"])
        let overhead = exercise(title: "Biceps Curl: Cable (Overhead)", movementID: "biceps_curl", movementTitle: "Biceps curl", variationTitle: "Cable, overhead", equipment: ["cable"])

        let groups = ExerciseStore.splitIntoEquipmentGroups(variations: [ExerciseVariation(exercise: rope), ExerciseVariation(exercise: overhead)])

        XCTAssertEqual(groups.map(\.title), ["Cable"])
        XCTAssertEqual(groups.first?.exercises.map(\.variationSummaryTitle), ["Cable, Overhead", "Cable, Rope"])
    }

    func testSearchMatchesMovementVariationAndTags() {
        let exercise = exercise(
            title: "Bench Press: Dumbbell (Incline)",
            movementID: "bench_press",
            movementTitle: "Bench press",
            variationTitle: "Dumbbell, incline",
            variationTags: ["dumbbell", "incline"],
            equipment: ["dumbbell", "bench: incline"]
        )

        XCTAssertTrue(ExerciseStore.filter(exercises: [exercise], using: "bench").contains(exercise))
        XCTAssertTrue(ExerciseStore.filter(exercises: [exercise], using: "incline").contains(exercise))
        XCTAssertTrue(ExerciseStore.filter(exercises: [exercise], using: "dumbbell").contains(exercise))
    }

    func testStructuredVariationDisplayTitleUsesCategoryLabels() {
        let exercise = exercise(
            title: "Triceps Extension: Cable (Overhead, Rope)",
            movementID: "triceps_extension",
            movementTitle: "Triceps extension",
            variationTitle: "Cable, overhead, rope",
            equipment: ["cable"]
        )

        XCTAssertEqual(exercise.variationDisplayTitle, "Equipment: Cable\nAttachment: Rope\nSetup: Overhead")
        XCTAssertEqual(exercise.variationIdentityKey, "triceps_extension|cable|rope|overhead")
    }

    func testBrowsingVariationTitleAvoidsRepeatingBodyweight() {
        let regular = exercise(
            title: "Crunch",
            movementID: "crunch",
            movementTitle: "Crunch",
            equipment: ["body"]
        )
        let decline = exercise(
            title: "Crunch (Decline)",
            movementID: "crunch",
            movementTitle: "Crunch",
            equipment: ["body", "bench: decline"]
        )
        let cable = exercise(
            title: "Crunch: Cable",
            movementID: "crunch",
            movementTitle: "Crunch",
            equipment: ["cable"]
        )

        XCTAssertEqual(regular.browsingVariationTitle, "Crunch")
        XCTAssertEqual(decline.browsingVariationTitle, "Decline")
        XCTAssertEqual(cable.browsingVariationTitle, "Cable")
        XCTAssertEqual(decline.browsingExerciseTitle, "Crunch, Decline")
    }

    func testBrowserFilterUsesNormalizedVariationTags() {
        let exercise = exercise(
            title: "Skull Crusher",
            movementID: "skull_crusher",
            movementTitle: "Skull crusher",
            variationTitle: "EZ curl bar",
            variationTags: ["ez-curl-bar"],
            equipment: ["ez-curl-bar"]
        )

        let filtered = ExerciseBrowserFilter(equipment: "ez-curl-bar").filteredExercises(from: [exercise])

        XCTAssertEqual(filtered, [exercise])
    }

    func testNormalizationSeedsMovementFieldsWhenSchemaSupportsThem() throws {
        let container = setUpInMemoryNSPersistentContainer()
        let context = container.viewContext
        let exercise = try XCTUnwrap(ExerciseStore().exercises.first)

        try WorkoutDataV13Normalization.run(context: context)

        let request = NSFetchRequest<NSManagedObject>(entityName: "ExerciseDefinition")
        request.predicate = NSPredicate(format: "uuid == %@", exercise.uuid as CVarArg)
        let definition = try XCTUnwrap(context.fetch(request).first)

        if definition.entity.attributesByName["movementID"] != nil {
            XCTAssertEqual(definition.value(forKey: "movementID") as? String, exercise.movementID)
            XCTAssertEqual(definition.value(forKey: "movementTitle") as? String, exercise.movementTitle)
            XCTAssertEqual(definition.value(forKey: "variationTagsJSON") as? String, try encode(exercise.variationTags))
            if definition.entity.attributesByName["equipmentTitle"] != nil {
                XCTAssertEqual(definition.value(forKey: "equipmentTitle") as? String, exercise.equipmentTitle)
            }
        }
    }

    func testNormalizationBackfillsCustomExerciseMovementFields() throws {
        let container = setUpInMemoryNSPersistentContainer()
        let context = container.viewContext
        let uuid = UUID()
        let custom = NSEntityDescription.insertNewObject(forEntityName: "CustomExercise", into: context)
        custom.setValue(uuid, forKey: "uuid")
        custom.setValue("Cable wrist thing", forKey: "title")
        custom.setValue("[\"dumbbell\"]", forKey: "equipmentJSON")

        try WorkoutDataV13Normalization.run(context: context)

        if custom.entity.attributesByName["movementID"] != nil {
            XCTAssertEqual(custom.value(forKey: "movementID") as? String, uuid.uuidString.lowercased())
            XCTAssertEqual(custom.value(forKey: "movementTitle") as? String, "Cable wrist thing")
            XCTAssertEqual(custom.value(forKey: "variationTitle") as? String, "Dumbbell")
            if custom.entity.attributesByName["equipmentTitle"] != nil {
                XCTAssertEqual(custom.value(forKey: "equipmentTitle") as? String, "Dumbbell")
            }
            XCTAssertEqual(custom.value(forKey: "variationTagsJSON") as? String, "[\"dumbbell\"]")
        }
    }

    func testDuplicateVariationMatchesStructuredIdentity() {
        let store = ExerciseStore()

        let duplicate = store.duplicateVariation(
            movementTitle: "Bench Press",
            equipmentTitle: "Barbell",
            attachmentTitle: nil,
            setupTitle: "Incline",
            gripTitle: nil,
            sideTitle: nil,
            loadModeTitle: nil
        )

        XCTAssertEqual(duplicate?.title, "Bench Press: Barbell (Incline)")
    }

    private func encode<T: Encodable>(_ value: T) throws -> String {
        String(data: try JSONEncoder().encode(value), encoding: .utf8) ?? ""
    }
}
