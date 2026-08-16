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
        attachmentTitle: String? = nil,
        setupTitle: String? = nil,
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
            attachmentTitle: attachmentTitle,
            setupTitle: setupTitle,
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

    func testImplicitJumpRopeAttachmentIsHiddenFromBrowsingLabels() {
        let exercise = exercise(
            title: "Jump Rope",
            movementID: "jump_rope",
            movementTitle: "Jump Rope",
            variationTitle: nil,
            attachmentTitle: "Rope",
            variationTags: ["rope", "other"],
            equipment: ["other"]
        )

        XCTAssertEqual(exercise.browsingVariationTitle, "Jump Rope")
        XCTAssertEqual(exercise.variationSummaryTitle, "Jump Rope")
        XCTAssertTrue(exercise.variationIdentityKey.contains("rope"))
    }

    func testImplicitMovementDetailsAreHiddenAcrossBrowsingLabels() {
        let walking = exercise(
            title: "Walking",
            movementID: "walking",
            movementTitle: "Walking",
            setupTitle: "Walking",
            equipment: ["body"]
        )
        let overhead = exercise(
            title: "Overhead Smash",
            movementID: "overhead_smash",
            movementTitle: "Overhead Smash",
            setupTitle: "Overhead",
            equipment: ["other"]
        )
        let lowPulley = exercise(
            title: "Triceps Extension: Cable (Low)",
            movementID: "triceps_extension",
            movementTitle: "Triceps Extension",
            setupTitle: "Low pulley",
            equipment: ["cable"]
        )

        XCTAssertEqual(walking.browsingVariationTitle, "Walking")
        XCTAssertEqual(overhead.browsingVariationTitle, "Overhead Smash")
        XCTAssertEqual(lowPulley.browsingVariationTitle, "Cable")
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

    func testBicepsCurlOptionsAllowInclineHammerCombination() throws {
        let store = ExerciseStore()
        let movement = try XCTUnwrap(
            ExerciseStore.splitIntoMovements(exercises: store.exercises)
                .first { $0.id == "biceps_curl" }
        )

        let equipment = ExerciseStore.variationOptions(for: movement)
        let dumbbell = ExerciseStore.variationOptions(for: movement, equipmentTitle: "Dumbbell")

        XCTAssertTrue(equipment.equipment.contains("Dumbbell"))
        XCTAssertTrue(dumbbell.setup.contains("Incline"))
        XCTAssertTrue(dumbbell.grip.contains("Hammer grip"))
    }

    func testBodyweightMovementOptionsIncludeApplicableLoadModes() throws {
        let store = ExerciseStore()
        let movements = ExerciseStore.splitIntoMovements(exercises: store.shownExercises)
        let chinUp = try XCTUnwrap(movements.first { $0.id == "chin_up" })
        let dips = try XCTUnwrap(movements.first { $0.id == "dips" })
        let crunch = try XCTUnwrap(movements.first { $0.id == "crunch" })

        XCTAssertEqual(
            ExerciseStore.variationOptions(for: chinUp, equipmentTitle: "Bodyweight").load,
            ["Assisted", "Weighted"]
        )
        XCTAssertEqual(
            ExerciseStore.variationOptions(for: dips, equipmentTitle: "Bodyweight").load,
            ["Assisted", "Weighted"]
        )
        XCTAssertTrue(ExerciseStore.variationOptions(for: crunch, equipmentTitle: "Bodyweight").load.isEmpty)
    }

    func testBrowsingDeduplicatesBuiltInIdentitiesWithoutRemovingUUIDLookup() throws {
        let store = ExerciseStore()
        let builtInIdentityKeys = store.shownExercises.filter { !$0.isCustom }.map(\.variationIdentityKey)
        let shownFacePull = try XCTUnwrap(store.shownExercises.first { $0.movementID == "face_pull" })
        let selection = ExerciseVariationSelection(movementID: "face_pull", equipmentTitle: "Cable")

        XCTAssertEqual(Set(builtInIdentityKeys).count, builtInIdentityKeys.count)
        XCTAssertLessThan(store.shownExercises.count, store.exercises.count)
        XCTAssertEqual(store.variation(matching: selection)?.uuid, shownFacePull.uuid)
        XCTAssertNotNil(store.find(with: UUID(uuidString: "802ECEC2-C361-5321-858D-3545251D61DF")!))
        XCTAssertNotNil(store.find(with: UUID(uuidString: "C4035736-EAF3-4DAD-8B74-BD1537E6B72D")!))
    }

    func testCatalogVariationsHaveDistinctStructuredIdentities() throws {
        let store = ExerciseStore()
        let crossBody = try XCTUnwrap(store.exercises.first { $0.title == "Crunch (Cross Body)" })
        let dips = store.exercises.filter { $0.movementID == "dips" && $0.equipmentTitle == "Bodyweight" }
        let tBarRow = try XCTUnwrap(store.exercises.first { $0.title == "Row: T-Bar" })

        XCTAssertEqual(crossBody.setupTitle, "Cross body")
        XCTAssertEqual(Set(dips.map(\.variationIdentityKey)).count, dips.count)
        XCTAssertEqual(tBarRow.equipmentTitle, "T-bar machine")
    }

    func testResolveExistingVariationKeepsBuiltInUUID() throws {
        let container = setUpInMemoryNSPersistentContainer()
        let store = ExerciseStore(context: container.viewContext)
        let expected = try XCTUnwrap(store.exercises.first { $0.title == "Bench Press: Barbell (Incline)" })
        let selection = ExerciseVariationSelection(
            movementID: expected.movementID,
            equipmentTitle: "Barbell",
            setupTitle: "Incline"
        )

        let resolved = try store.resolveOrCreateVariation(selection, movementTitle: expected.movementTitle)

        XCTAssertEqual(resolved.uuid, expected.uuid)
        XCTAssertFalse(resolved.isCustom)
        XCTAssertTrue(store.customExercises.isEmpty)
    }

    func testResolveMissingCombinationCreatesAndReusesExactVariation() throws {
        let container = setUpInMemoryNSPersistentContainer()
        let store = ExerciseStore(context: container.viewContext)
        let template = try XCTUnwrap(store.exercises.first { $0.title == "Biceps Curl: Dumbbell" })
        store.setRestTime(95, forExercise: template.uuid)
        let selection = ExerciseVariationSelection(
            movementID: "biceps_curl",
            equipmentTitle: "Dumbbell",
            setupTitle: "Incline",
            gripTitle: "Hammer grip"
        )

        let created = try store.resolveOrCreateVariation(selection, movementTitle: "Biceps Curl")
        let resolvedAgain = try store.resolveOrCreateVariation(selection, movementTitle: "Biceps Curl")

        XCTAssertTrue(created.isCustom)
        XCTAssertEqual(created.uuid, resolvedAgain.uuid)
        XCTAssertEqual(store.customExercises.count, 1)
        XCTAssertEqual(created.movementID, "biceps_curl")
        XCTAssertEqual(created.equipmentTitle, "Dumbbell")
        XCTAssertEqual(created.setupTitle, "Incline")
        XCTAssertEqual(created.gripTitle, "Hammer grip")
        XCTAssertEqual(created.primaryMuscle, template.primaryMuscle)
        XCTAssertEqual(created.secondaryMuscle, template.secondaryMuscle)
        XCTAssertEqual(created.defaultMetric, template.defaultMetric)
        XCTAssertEqual(created.activityCategoryIDs, template.activityCategoryIDs)
        XCTAssertEqual(store.restTime(forExercise: created.uuid), 95)
        let reloadedStore = ExerciseStore(context: container.viewContext)
        XCTAssertEqual(reloadedStore.find(with: created.uuid)?.variationIdentityKey, selection.identityKey)
    }

    func testMovementSearchMatchesTermsAcrossSeparateVariations() throws {
        let store = ExerciseStore()
        let movement = try XCTUnwrap(
            ExerciseStore.splitIntoMovements(exercises: store.exercises)
                .first { $0.id == "biceps_curl" }
        )

        let result = ExerciseStore.filter(movements: [movement], using: "incline hammer")

        XCTAssertEqual(result.map(\.id), ["biceps_curl"])
    }

    func testCustomManualValueDoesNotBecomeSuggestedOption() throws {
        let container = setUpInMemoryNSPersistentContainer()
        let store = ExerciseStore(context: container.viewContext)
        store.createCustomExercise(
            title: "Biceps Curl: Dumbbell (Fat Grip)",
            description: nil,
            primaryMuscle: ["biceps brachii"],
            secondaryMuscle: [],
            type: .dumbbell,
            movementTitle: "Biceps Curl",
            equipmentTitle: "Dumbbell",
            gripTitle: "Fat grip"
        )
        let movement = try XCTUnwrap(
            ExerciseStore.splitIntoMovements(exercises: store.exercises)
                .first { $0.id == "biceps_curl" }
        )

        let options = ExerciseStore.variationOptions(for: movement, equipmentTitle: "Dumbbell")

        XCTAssertFalse(options.grip.contains("Fat grip"))
        XCTAssertTrue(ExerciseStore.filter(exercises: store.exercises, using: "fat grip").contains { $0.isCustom })
    }

    func testResolverWithoutPersistentStoreDoesNotCreateVariation() {
        let store = ExerciseStore()
        let selection = ExerciseVariationSelection(
            movementID: "biceps_curl",
            equipmentTitle: "Dumbbell",
            setupTitle: "Incline",
            gripTitle: "Hammer grip"
        )

        XCTAssertThrowsError(try store.resolveOrCreateVariation(selection, movementTitle: "Biceps Curl"))
        XCTAssertTrue(store.customExercises.isEmpty)
    }

    private func encode<T: Encodable>(_ value: T) throws -> String {
        String(data: try JSONEncoder().encode(value), encoding: .utf8) ?? ""
    }
}
