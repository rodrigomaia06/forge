//
//  ExerciseStore.swift
//  Forge
//
//  Created by Karim Abou Zeid on 17.09.19.
//  Copyright © 2019 Karim Abou Zeid Software. All rights reserved.
//

import Foundation
import CoreData
import os.log

public enum ExerciseVariationResolutionError: LocalizedError {
    case unavailableStore
    case missingMovement
    case saveFailed

    public var errorDescription: String? {
        switch self {
        case .unavailableStore, .missingMovement, .saveFailed:
            return "The variation could not be created. Your exercise selection was not changed."
        }
    }
}

public class ExerciseStore: ObservableObject {
    public static var defaultBuiltInExercisesResourceURL: URL {
        Bundle(for: Self.self).bundleURL.appendingPathComponent("everkinetic-data")
    }

    public static var defaultBuiltInExercisesURL: URL {
        defaultBuiltInExercisesResourceURL.appendingPathComponent("exercises.json")
    }

    public let builtInExercises: [Exercise]

    @Published private(set) public var customExercises: [Exercise] {
        didSet { rebuildLists() }
    }

    // These four are stored rather than computed. `exercises` used to be `builtInExercises +
    // customExercises`, which allocated and copied the whole 217-entry catalog on every read, and
    // `shownExercises` ran isHidden over all of it. They are read from view bodies and from per-row
    // helpers at around fifty call sites, several of them once per exercise per render, so the
    // copying dominated the cost of drawing the dashboard and the live workout. The catalog only
    // changes when a custom exercise or a per-exercise setting changes, so it is rebuilt there.

    /// Every exercise, built-in and custom.
    public private(set) var exercises: [Exercise] = []

    /// Exercises the user has not hidden.
    public private(set) var shownExercises: [Exercise] = []

    /// Exercises the user has hidden.
    public private(set) var hiddenExercises: [Exercise] = []

    /// `exercises` indexed by UUID, for the lookups that happen per row.
    private var exercisesByUuid: [UUID: Exercise] = [:]

    /// Core Data context backing custom exercises. Custom exercises now live in the workout
    /// database (the CustomExercise entity), so a plain database export/import carries them.
    /// It's optional because some callers (tests, the v1 migration policy) don't need custom
    /// exercises; there the list is simply empty.
    private let context: NSManagedObjectContext?

    /// Cached per-exercise settings (rest time + hidden) keyed by exercise UUID, so the
    /// frequently-called isHidden/restTime reads don't fetch from Core Data per exercise.
    private var exerciseSettings: [UUID: (restTime: TimeInterval?, hidden: Bool)] {
        didSet { rebuildLists() }
    }

    public init(builtInExercisesURL: URL = ExerciseStore.defaultBuiltInExercisesURL, context: NSManagedObjectContext? = nil) {
        self.context = context
        builtInExercises = Self.loadBuiltInExercises(builtInExercisesURL: builtInExercisesURL)
        customExercises = Self.loadCustomExercises(context: context)
        exerciseSettings = Self.loadExerciseSettings(context: context)
        assert(!customExercises.contains { !$0.isCustom }, "Loaded custom exercise that is not custom.")
        // A property observer does not fire during init, so the first build is explicit.
        rebuildLists()
    }

    private func rebuildLists() {
        exercises = builtInExercises + customExercises
        exercisesByUuid = Dictionary(exercises.map { ($0.uuid, $0) }, uniquingKeysWith: { _, latest in latest })
        var shown = [Exercise]()
        var hidden = [Exercise]()
        for exercise in exercises {
            if exerciseSettings[exercise.uuid]?.hidden ?? false {
                hidden.append(exercise)
            } else {
                shown.append(exercise)
            }
        }
        shownExercises = Self.deduplicatedForBrowsing(shown)
        hiddenExercises = Self.deduplicatedForBrowsing(hidden)
    }

    public static func deduplicatedForBrowsing(_ exercises: [Exercise]) -> [Exercise] {
        var canonicalExercises = [String: Exercise]()
        for exercise in exercises {
            let key = exercise.variationIdentityKey
            guard let current = canonicalExercises[key] else {
                canonicalExercises[key] = exercise
                continue
            }
            let customWins = exercise.isCustom && !current.isCustom
            let sameSourceHasBetterMetadata = exercise.isCustom == current.isCustom
                && browsingMetadataScore(exercise) > browsingMetadataScore(current)
            if customWins || sameSourceHasBetterMetadata {
                canonicalExercises[key] = exercise
            }
        }

        return exercises.filter { exercise in
            canonicalExercises[exercise.variationIdentityKey]?.uuid == exercise.uuid
        }
    }

    private static func browsingMetadataScore(_ exercise: Exercise) -> Int {
        let hasDescription = exercise.description?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
        return (hasDescription ? 100 : 0) + (exercise.steps.isEmpty ? 0 : 10) + exercise.alias.count
    }

    private static func loadBuiltInExercises(builtInExercisesURL: URL?) -> [Exercise] {
        guard let builtInExercisesURL = builtInExercisesURL else { fatalError("Built in exercises URL invalid") }
        do {
            return try JSONDecoder().decode([Exercise].self, from: Data(contentsOf: builtInExercisesURL))
        } catch {
            fatalError("Error decoding built in exercises: \(error.localizedDescription)")
        }
    }
}

// MARK: - Per-exercise settings: hidden + rest time (Core Data backed)
extension ExerciseStore {
    public func show(exercise: Exercise) {
        assert(!exercise.isCustom, "Makes no sense to show custom exercise.")
        guard let context = context, let entity = settingsEntity(for: exercise.uuid, in: context, createIfNeeded: false) else { return }
        entity.isHidden = false
        saveSettings(context)
    }

    public func hide(exercise: Exercise) {
        assert(!exercise.isCustom, "Makes no sense to hide custom exercise.")
        guard !isHidden(exercise: exercise), let context = context else { return }
        settingsEntity(for: exercise.uuid, in: context, createIfNeeded: true)?.isHidden = true
        saveSettings(context)
    }

    public func isHidden(exercise: Exercise) -> Bool {
        exerciseSettings[exercise.uuid]?.hidden ?? false
    }

    /// Per-exercise rest time override (nil = use the default rest time).
    public func restTime(forExercise uuid: UUID) -> TimeInterval? {
        exerciseSettings[uuid]?.restTime ?? nil
    }

    public func setRestTime(_ time: TimeInterval?, forExercise uuid: UUID) {
        guard let context = context else { return }
        settingsEntity(for: uuid, in: context, createIfNeeded: true)?.restTime = time.map { NSNumber(value: $0) }
        saveSettings(context)
    }

    private func settingsEntity(for uuid: UUID, in context: NSManagedObjectContext, createIfNeeded: Bool) -> ExerciseSettings? {
        let request = ExerciseSettings.fetchRequest()
        request.predicate = NSPredicate(format: "exerciseUuid == %@", uuid as CVarArg)
        request.fetchLimit = 1
        if let existing = (try? context.fetch(request))?.first { return existing }
        guard createIfNeeded else { return nil }
        let entity = ExerciseSettings(context: context)
        entity.exerciseUuid = uuid
        return entity
    }

    private func saveSettings(_ context: NSManagedObjectContext) {
        objectWillChange.send()
        do {
            try context.save()
        } catch {
            os_log("Could not save exercise settings: %@", log: .migration, type: .error, error.localizedDescription)
            context.rollback()
        }
        exerciseSettings = Self.loadExerciseSettings(context: context)
    }

    fileprivate static func loadExerciseSettings(context: NSManagedObjectContext?) -> [UUID: (restTime: TimeInterval?, hidden: Bool)] {
        guard let context = context else { return [:] }
        let request = ExerciseSettings.fetchRequest()
        let entities = (try? context.fetch(request)) ?? []
        var result: [UUID: (restTime: TimeInterval?, hidden: Bool)] = [:]
        for entity in entities {
            guard let uuid = entity.exerciseUuid else { continue }
            result[uuid] = (entity.restTime?.doubleValue, entity.isHidden)
        }
        return result
    }
}

// MARK: - Split
extension ExerciseStore {
    public static func splitIntoMuscleGroups(exercises: [Exercise]) -> [ExerciseGroup] {
        var groups = [ExerciseGroup]()
        var nextIndex = 0
        let exercises = exercises.sorted { (a, b) -> Bool in
            a.muscleGroup < b.muscleGroup
        }
        while (exercises.count > nextIndex) {
            let groupName = exercises[nextIndex].muscleGroup
            var muscleGroup = exercises.filter({ (exercise) -> Bool in
                exercise.muscleGroup == groupName
            })

            nextIndex = exercises.firstIndex(where: { (exercise) -> Bool in
                exercise.uuid == muscleGroup.last!.uuid
            })! + 1

            // do this after nextIndex is set
            muscleGroup = muscleGroup.sorted(by: { (a, b) -> Bool in
                a.title < b.title
            })
            groups.append(ExerciseGroup(title: groupName, exercises: muscleGroup))
        }
        return groups
    }

    public static func splitIntoActivityGroups(exercises: [Exercise]) -> [ExerciseGroup] {
        ExerciseActivityCategory.allCases.compactMap { category in
            let groupExercises = exercises
                .filter { $0.activityCategories.contains(category) }
                .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
            return groupExercises.isEmpty ? nil : ExerciseGroup(title: category.title, exercises: groupExercises)
        }
    }

    public static func splitIntoWorkoutTypeGroups(exercises: [Exercise], workoutTypes: [WorkoutType]) -> [ExerciseGroup] {
        workoutTypes.map { type in
            let categoryID = type.exerciseCategoryID
            let groupExercises = exercises
                .filter { $0.activityCategoryIDs.contains(categoryID) }
                .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
            return ExerciseGroup(title: type.displayTitle, exercises: groupExercises)
        }
    }

    public static func splitIntoMovements(exercises: [Exercise]) -> [ExerciseMovement] {
        let grouped = Dictionary(grouping: exercises, by: \.movementID)
        return grouped.map { movementID, exercises in
            let sortedExercises = exercises.sorted {
                let titleCompare = $0.variationSummaryTitle.localizedCaseInsensitiveCompare($1.variationSummaryTitle)
                if titleCompare == .orderedSame {
                    return $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
                }
                return titleCompare == .orderedAscending
            }
            let movementTitle = sortedExercises.first?.movementTitle ?? movementID
            return ExerciseMovement(id: movementID, title: movementTitle, variations: sortedExercises.map(ExerciseVariation.init))
        }
        .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    public static func splitIntoEquipmentGroups(variations: [ExerciseVariation]) -> [ExerciseGroup] {
        let grouped = Dictionary(grouping: variations.map(\.exercise)) { exercise in
            exercise.equipmentTitle ?? "Other"
        }
        return grouped.map { title, exercises in
            ExerciseGroup(title: title, exercises: exercises.sorted {
                let titleCompare = $0.variationSummaryTitle.localizedCaseInsensitiveCompare($1.variationSummaryTitle)
                if titleCompare == .orderedSame {
                    return $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
                }
                return titleCompare == .orderedAscending
            })
        }
        .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    public static func variationOptions(for movement: ExerciseMovement, equipmentTitle: String? = nil) -> ExerciseVariationOptions {
        let builtIn = movement.variations.map(\.exercise).filter { !$0.isCustom }
        let normalizedEquipment = Exercise.cleanVariationField(equipmentTitle)?.normalizedVariationOptionToken
        let matchingEquipment = builtIn.filter {
            $0.equipmentTitle?.normalizedVariationOptionToken == normalizedEquipment
        }

        let loadValues = matchingEquipment.compactMap(\.loadModeTitle)
            + suggestedLoadModes(for: movement.id, equipmentToken: normalizedEquipment)

        return ExerciseVariationOptions(
            equipment: sortedVariationValues(builtIn.compactMap(\.equipmentTitle)),
            attachment: sortedVariationValues(matchingEquipment.compactMap(\.attachmentTitle)),
            setup: sortedVariationValues(matchingEquipment.compactMap(\.setupTitle)),
            grip: sortedVariationValues(matchingEquipment.compactMap(\.gripTitle)),
            side: sortedVariationValues(matchingEquipment.compactMap(\.sideTitle)),
            load: sortedVariationValues(loadValues)
        )
    }

    private static func suggestedLoadModes(for movementID: String, equipmentToken: String?) -> [String] {
        guard equipmentToken == "bodyweight" else { return [] }
        switch movementID {
        case "chin_up", "dips", "pull_up", "push_up":
            return ["Assisted", "Weighted"]
        case "handstand_push_up", "muscle_up", "nordic_curl", "pistol_squat":
            return ["Assisted"]
        case "inverted_row":
            return ["Weighted"]
        default:
            return []
        }
    }

    private static func sortedVariationValues(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
            .filter { seen.insert($0.normalizedVariationOptionToken).inserted }
    }
}

private extension String {
    var normalizedVariationOptionToken: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "-", with: "_")
            .replacingOccurrences(of: " ", with: "_")
    }
}

// MARK: - Find
extension ExerciseStore {
    public func variation(matching selection: ExerciseVariationSelection) -> Exercise? {
        guard !selection.identityKey.isEmpty else { return nil }
        let matches = exercises.filter { $0.variationIdentityKey == selection.identityKey }
        if let custom = matches.first(where: \.isCustom) {
            return custom
        }
        return Self.deduplicatedForBrowsing(matches).first
    }

    public func resolveOrCreateVariation(_ selection: ExerciseVariationSelection, movementTitle: String) throws -> Exercise {
        if let existing = variation(matching: selection) {
            return existing
        }
        guard let context else { throw ExerciseVariationResolutionError.unavailableStore }

        let movementExercises = exercises.filter { $0.movementID == selection.movementID }
        guard let template = closestTemplate(to: selection, in: movementExercises) else {
            throw ExerciseVariationResolutionError.missingMovement
        }

        // Recheck immediately before insertion so a repeated action reuses the first record.
        if let existing = variation(matching: selection) {
            return existing
        }

        let uuid = UUID()
        let entity = CustomExercise(context: context)
        entity.uuid = uuid
        let title = uniqueVariationTitle(for: selection, movementTitle: movementTitle)
        let equipment = rawEquipment(for: selection.equipmentTitle)
        let variationTitle = selection.summaryTitle
        apply(
            title: title,
            description: template.description,
            primaryMuscle: template.primaryMuscle,
            secondaryMuscle: template.secondaryMuscle,
            type: template.type,
            activityCategoryIDs: template.activityCategoryIDs,
            movementTitle: movementTitle,
            variationTitle: variationTitle.isEmpty ? nil : variationTitle,
            equipmentTitle: selection.equipmentTitle,
            attachmentTitle: selection.attachmentTitle,
            setupTitle: selection.setupTitle,
            gripTitle: selection.gripTitle,
            sideTitle: selection.sideTitle,
            loadModeTitle: selection.loadModeTitle,
            variationTags: [],
            to: entity,
            movementID: selection.movementID,
            defaultMetric: template.defaultMetric,
            equipmentOverride: equipment
        )

        var inheritedSettings: ExerciseSettings?
        if let restTime = restTime(forExercise: template.uuid) {
            inheritedSettings = settingsEntity(for: uuid, in: context, createIfNeeded: true)
            inheritedSettings?.restTime = NSNumber(value: restTime)
        }

        do {
            try context.save()
        } catch {
            if let inheritedSettings {
                context.delete(inheritedSettings)
            }
            context.delete(entity)
            context.processPendingChanges()
            throw ExerciseVariationResolutionError.saveFailed
        }

        customExercises = Self.loadCustomExercises(context: context)
        exerciseSettings = Self.loadExerciseSettings(context: context)
        guard let created = find(with: uuid) else {
            throw ExerciseVariationResolutionError.saveFailed
        }
        return created
    }

    private func closestTemplate(to selection: ExerciseVariationSelection, in exercises: [Exercise]) -> Exercise? {
        exercises.sorted { lhs, rhs in
            let lhsEquipment = lhs.equipmentTitle?.normalizedVariationOptionToken == selection.equipmentTitle?.normalizedVariationOptionToken
            let rhsEquipment = rhs.equipmentTitle?.normalizedVariationOptionToken == selection.equipmentTitle?.normalizedVariationOptionToken
            if lhsEquipment != rhsEquipment { return lhsEquipment }
            if lhs.isCustom != rhs.isCustom { return !lhs.isCustom }
            let lhsDetails = lhs.variationDisplayFields.count
            let rhsDetails = rhs.variationDisplayFields.count
            if lhsDetails != rhsDetails { return lhsDetails < rhsDetails }
            return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
        }.first
    }

    private func uniqueVariationTitle(for selection: ExerciseVariationSelection, movementTitle: String) -> String {
        var title = movementTitle
        if let equipment = selection.equipmentTitle, equipment.normalizedVariationOptionToken != "bodyweight" {
            title += ": \(equipment)"
        }
        let details = [selection.setupTitle, selection.gripTitle, selection.attachmentTitle, selection.sideTitle, selection.loadModeTitle]
            .compactMap { $0 }
        if !details.isEmpty {
            title += " (\(details.joined(separator: ", ")))"
        }
        guard exercises.contains(where: { $0.title.localizedCaseInsensitiveCompare(title) == .orderedSame }) else {
            return title
        }

        let customTitle = "\(title) (Custom)"
        guard exercises.contains(where: { $0.title.localizedCaseInsensitiveCompare(customTitle) == .orderedSame }) else {
            return customTitle
        }
        var index = 2
        while exercises.contains(where: { $0.title.localizedCaseInsensitiveCompare("\(customTitle) \(index)") == .orderedSame }) {
            index += 1
        }
        return "\(customTitle) \(index)"
    }

    private func rawEquipment(for equipmentTitle: String?) -> [String] {
        guard let equipmentTitle else { return [] }
        let token = equipmentTitle.normalizedVariationOptionToken
        if token == "bodyweight" { return ["body"] }
        return [token.replacingOccurrences(of: "_", with: "-")]
    }

    public func find(with uuid: UUID) -> Exercise? {
        exercisesByUuid[uuid]
    }

    public static func find(in exercises: [Exercise], with uuid: UUID?) -> Exercise? {
        guard let uuid = uuid else { return nil }
        return exercises.first { $0.uuid == uuid }
    }
}

// MARK: - Filter
extension ExerciseStore {
    private static func titleMatchesFilter(title: String, filter: String) -> Bool {
        for s in filter.split(separator: " ") {
            if !title.lowercased().contains(s) {
                return false
            }
        }
        return true
    }

    public static func filter(exercises: [Exercise], using filter: String) -> [Exercise] {
        let filter = filter.lowercased().trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
        guard !filter.isEmpty else { return exercises }

        return exercises.filter { exercise in
            let searchableTitles = [exercise.title, exercise.movementTitle, exercise.variationTitle, exercise.equipmentTitle, exercise.attachmentTitle, exercise.setupTitle, exercise.gripTitle, exercise.sideTitle, exercise.loadModeTitle]
                .compactMap { $0 }
                + exercise.alias
                + exercise.equipment
                + exercise.variationTags
            for title in searchableTitles {
                if titleMatchesFilter(title: title, filter: filter) {
                    return true
                }
            }
            return false
        }
    }

    public static func filter(movements: [ExerciseMovement], using filter: String) -> [ExerciseMovement] {
        let terms = filter
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(whereSeparator: \.isWhitespace)
        guard !terms.isEmpty else { return movements }

        return movements.filter { movement in
            let searchable = movement.variations.flatMap { variation -> [String] in
                let exercise = variation.exercise
                return [
                    exercise.title,
                    exercise.movementTitle,
                    exercise.variationTitle,
                    exercise.equipmentTitle,
                    exercise.attachmentTitle,
                    exercise.setupTitle,
                    exercise.gripTitle,
                    exercise.sideTitle,
                    exercise.loadModeTitle
                ].compactMap { $0 } + exercise.alias + exercise.equipment + exercise.variationTags
            }
            .joined(separator: " ")
            .lowercased()
            return terms.allSatisfy { searchable.contains($0) }
        }
    }

    public static func filter(exerciseGroups: [ExerciseGroup], using filter: String) -> [ExerciseGroup] {
        exerciseGroups
            .map { ExerciseGroup(title: $0.title, exercises: Self.filter(exercises: $0.exercises, using: filter)) }
            .filter { !$0.exercises.isEmpty }
    }
}

// MARK: - Custom Exercises (Core Data backed)
extension ExerciseStore {
    public func createCustomExercise(title: String, description: String?, primaryMuscle: [String], secondaryMuscle: [String], type: Exercise.ExerciseType, activityCategoryIDs: [String] = [ExerciseActivityCategory.strength.rawValue], movementTitle: String? = nil, variationTitle: String? = nil, equipmentTitle: String? = nil, attachmentTitle: String? = nil, setupTitle: String? = nil, gripTitle: String? = nil, sideTitle: String? = nil, loadModeTitle: String? = nil, variationTags: [String] = []) {
        let title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        guard !exercises.contains(where: { $0.title == title }) else { return }
        guard let context = context else { return }

        let entity = CustomExercise(context: context)
        entity.uuid = UUID()
        apply(title: title, description: description, primaryMuscle: primaryMuscle, secondaryMuscle: secondaryMuscle, type: type, activityCategoryIDs: activityCategoryIDs, movementTitle: movementTitle, variationTitle: variationTitle, equipmentTitle: equipmentTitle, attachmentTitle: attachmentTitle, setupTitle: setupTitle, gripTitle: gripTitle, sideTitle: sideTitle, loadModeTitle: loadModeTitle, variationTags: variationTags, to: entity)
        saveAndReload(context)
    }

    public func updateCustomExercise(with uuid: UUID, title: String, description: String?, primaryMuscle: [String], secondaryMuscle: [String], type: Exercise.ExerciseType, activityCategoryIDs: [String] = [ExerciseActivityCategory.strength.rawValue], movementTitle: String? = nil, variationTitle: String? = nil, equipmentTitle: String? = nil, attachmentTitle: String? = nil, setupTitle: String? = nil, gripTitle: String? = nil, sideTitle: String? = nil, loadModeTitle: String? = nil, variationTags: [String] = []) {
        let title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        guard !exercises.contains(where: { $0.title == title && $0.uuid != uuid }) else { return }
        guard let context = context, let entity = customExerciseEntity(with: uuid, in: context) else { return }

        apply(title: title, description: description, primaryMuscle: primaryMuscle, secondaryMuscle: secondaryMuscle, type: type, activityCategoryIDs: activityCategoryIDs, movementTitle: movementTitle, variationTitle: variationTitle, equipmentTitle: equipmentTitle, attachmentTitle: attachmentTitle, setupTitle: setupTitle, gripTitle: gripTitle, sideTitle: sideTitle, loadModeTitle: loadModeTitle, variationTags: variationTags, to: entity)
        saveAndReload(context)
    }

    public func deleteCustomExercise(with uuid: UUID) {
        guard let context = context, let entity = customExerciseEntity(with: uuid, in: context) else { return }
        deleteRoutineExercises(with: uuid, in: context)
        context.delete(entity)
        saveAndReload(context)
    }

    public func duplicateVariation(movementTitle: String?, equipmentTitle: String?, attachmentTitle: String?, setupTitle: String?, gripTitle: String?, sideTitle: String?, loadModeTitle: String?, excluding uuid: UUID? = nil) -> Exercise? {
        let movement = Exercise.cleanVariationField(movementTitle)
        let movementID = movement.map { Exercise.defaultMovementID(for: $0) }
        let probe = Exercise.variationIdentityKey(
            movementID: movementID,
            equipmentTitle: equipmentTitle,
            attachmentTitle: attachmentTitle,
            setupTitle: setupTitle,
            gripTitle: gripTitle,
            sideTitle: sideTitle,
            loadModeTitle: loadModeTitle
        )
        guard !probe.isEmpty else { return nil }
        return exercises.first { exercise in
            exercise.uuid != uuid && exercise.variationIdentityKey == probe
        }
    }

    private func apply(title: String, description: String?, primaryMuscle: [String], secondaryMuscle: [String], type: Exercise.ExerciseType, activityCategoryIDs: [String], movementTitle: String?, variationTitle: String?, equipmentTitle: String?, attachmentTitle: String?, setupTitle: String?, gripTitle: String?, sideTitle: String?, loadModeTitle: String?, variationTags: [String], to entity: CustomExercise, movementID: String? = nil, defaultMetric: ExerciseSetMetric? = nil, equipmentOverride: [String]? = nil) {
        var description = description?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let d = description, d.isEmpty { description = nil }
        let cleanMovementTitle = movementTitle?.trimmingCharacters(in: .whitespacesAndNewlines)
        let hasCustomMovementTitle = cleanMovementTitle?.isEmpty == false
        let resolvedMovementTitle = hasCustomMovementTitle ? cleanMovementTitle! : Exercise.defaultMovementTitle(for: title)
        let cleanVariationTitle = variationTitle?.trimmingCharacters(in: .whitespacesAndNewlines)
        let equipment = equipmentOverride ?? type.equipment.map { [$0] } ?? []
        let structured = Exercise.structuredVariationFields(
            title: title,
            variationTitle: cleanVariationTitle,
            equipment: equipment,
            equipmentTitle: equipmentTitle,
            attachmentTitle: attachmentTitle,
            setupTitle: setupTitle,
            gripTitle: gripTitle,
            sideTitle: sideTitle,
            loadModeTitle: loadModeTitle
        )
        let resolvedVariationTags = Exercise.normalizedVariationTags(variationTags.isEmpty ? structured.tags + equipment : variationTags)
        entity.title = title
        entity.exerciseDescription = description
        entity.primaryMusclesJSON = Self.encodeStrings(primaryMuscle)
        entity.secondaryMusclesJSON = Self.encodeStrings(secondaryMuscle)
        entity.equipmentJSON = Self.encodeStrings(equipment)
        entity.activityCategoriesJSON = Self.encodeCategoryIDs(activityCategoryIDs)
        entity.movementID = movementID ?? (hasCustomMovementTitle ? Exercise.defaultMovementID(for: resolvedMovementTitle) : entity.uuid?.uuidString.lowercased())
        entity.movementTitle = resolvedMovementTitle
        entity.variationTitle = cleanVariationTitle?.isEmpty == true ? nil : cleanVariationTitle
        entity.equipmentTitle = structured.equipmentTitle
        entity.attachmentTitle = structured.attachmentTitle
        entity.setupTitle = structured.setupTitle
        entity.gripTitle = structured.gripTitle
        entity.sideTitle = structured.sideTitle
        entity.loadModeTitle = structured.loadModeTitle
        entity.variationTagsJSON = Self.encodeStrings(resolvedVariationTags)
        if let defaultMetric {
            entity.defaultMetric = defaultMetric.rawValue
        } else if entity.defaultMetric == nil {
            entity.defaultMetric = ExerciseSetMetric.reps.rawValue
        }
    }

    private func customExerciseEntity(with uuid: UUID, in context: NSManagedObjectContext) -> CustomExercise? {
        let request = CustomExercise.fetchRequest()
        request.predicate = NSPredicate(format: "uuid == %@", uuid as CVarArg)
        request.fetchLimit = 1
        return (try? context.fetch(request))?.first
    }

    private func deleteRoutineExercises(with uuid: UUID, in context: NSManagedObjectContext) {
        let request: NSFetchRequest<WorkoutRoutineExercise> = WorkoutRoutineExercise.fetchRequest()
        request.predicate = NSPredicate(format: "\(#keyPath(WorkoutRoutineExercise.exerciseUuid)) == %@", uuid as CVarArg)
        guard let routineExercises = try? context.fetch(request) else { return }
        for routineExercise in routineExercises {
            let routine = routineExercise.workoutRoutine
            context.delete(routineExercise)
            routine?.removeFromWorkoutRoutineExercises(routineExercise)
            routine?.normalizeSupersets()
        }
    }

    private func saveAndReload(_ context: NSManagedObjectContext) {
        do {
            try context.save()
        } catch {
            os_log("Could not save custom exercise: %@", log: .migration, type: .error, error.localizedDescription)
            context.rollback()
        }
        customExercises = Self.loadCustomExercises(context: context)
    }

    fileprivate static func loadCustomExercises(context: NSManagedObjectContext?) -> [Exercise] {
        guard let context = context else { return [] }
        let request = CustomExercise.fetchRequest()
        request.sortDescriptors = [NSSortDescriptor(key: "title", ascending: true)]
        let entities = (try? context.fetch(request)) ?? []
        return entities.compactMap { exercise(from: $0) }
    }

    private static func exercise(from entity: CustomExercise) -> Exercise? {
        guard let uuid = entity.uuid else { return nil }
        return Exercise(
            uuid: uuid,
            everkineticId: Exercise.customEverkineticId,
            title: entity.title ?? "",
            alias: [],
            movementID: entity.movementID ?? uuid.uuidString.lowercased(),
            movementTitle: entity.movementTitle ?? entity.title ?? "",
            variationTitle: entity.variationTitle,
            equipmentTitle: entity.equipmentTitle,
            attachmentTitle: entity.attachmentTitle,
            setupTitle: entity.setupTitle,
            gripTitle: entity.gripTitle,
            sideTitle: entity.sideTitle,
            loadModeTitle: entity.loadModeTitle,
            variationTags: decodeStrings(entity.variationTagsJSON),
            activityCategories: decodeCategories(entity.activityCategoriesJSON),
            activityCategoryIDs: decodeCategoryIDs(entity.activityCategoriesJSON),
            defaultMetric: ExerciseSetMetric(rawValue: entity.defaultMetric ?? "") ?? .reps,
            description: entity.exerciseDescription,
            primaryMuscle: decodeStrings(entity.primaryMusclesJSON),
            secondaryMuscle: decodeStrings(entity.secondaryMusclesJSON),
            equipment: decodeStrings(entity.equipmentJSON),
            steps: [], tips: [], references: []
        )
    }

    private static func decodeStrings(_ json: String?) -> [String] {
        guard let data = json?.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([String].self, from: data)) ?? []
    }

    private static func encodeStrings(_ strings: [String]) -> String {
        guard let data = try? JSONEncoder().encode(strings), let string = String(data: data, encoding: .utf8) else { return "[]" }
        return string
    }

    private static func decodeCategories(_ json: String?) -> [ExerciseActivityCategory] {
        let categories = decodeCategoryIDs(json).compactMap(ExerciseActivityCategory.init(rawValue:))
        return categories.isEmpty ? [.strength] : categories
    }

    private static func decodeCategoryIDs(_ json: String?) -> [String] {
        guard let data = json?.data(using: .utf8) else { return [ExerciseActivityCategory.strength.rawValue] }
        if let ids = try? JSONDecoder().decode([String].self, from: data) {
            let clean = ids.map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }.filter { !$0.isEmpty }
            return clean.isEmpty ? [ExerciseActivityCategory.strength.rawValue] : clean
        }
        if let categories = try? JSONDecoder().decode([ExerciseActivityCategory].self, from: data) {
            return categories.isEmpty ? [ExerciseActivityCategory.strength.rawValue] : categories.map(\.rawValue)
        }
        return [ExerciseActivityCategory.strength.rawValue]
    }

    private static func encodeCategoryIDs(_ categoryIDs: [String]) -> String {
        let categoryIDs = categoryIDs.map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }.filter { !$0.isEmpty }
        let ids = categoryIDs.isEmpty ? [ExerciseActivityCategory.strength.rawValue] : categoryIDs
        guard let data = try? JSONEncoder().encode(ids), let string = String(data: data, encoding: .utf8) else { return "[\"strength\"]" }
        return string
    }
}
