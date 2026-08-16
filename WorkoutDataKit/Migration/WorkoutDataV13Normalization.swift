//
//  WorkoutDataV13Normalization.swift
//  WorkoutDataKit
//

import CoreData
import os.log

public enum WorkoutDataV13Normalization {
    public static func run(context: NSManagedObjectContext) throws {
        var caughtError: Error?
        context.performAndWait {
            do {
                try backfillCustomExerciseMovementMetadata(context: context)
                try seedExerciseDefinitions(context: context)
                try linkExerciseDefinitions(entityName: "WorkoutExercise", context: context)
                try linkExerciseDefinitions(entityName: "WorkoutRoutineExercise", context: context)
                try migrateWorkoutSetMeasurements(context: context)
                try migrateRoutineSetTargets(context: context)
                if context.hasChanges {
                    try context.save()
                }
            } catch {
                context.rollback()
                caughtError = error
            }
        }
        if let caughtError { throw caughtError }
    }

    private static func seedExerciseDefinitions(context: NSManagedObjectContext) throws {
        let exerciseStore = ExerciseStore(context: context)
        let existingDefinitions = try fetchObjects(entityName: "ExerciseDefinition", context: context)
        var definitionsByUUID = Dictionary(existingDefinitions.compactMap { object -> (UUID, NSManagedObject)? in
            guard let uuid = object.value(forKey: "uuid") as? UUID else { return nil }
            return (uuid, object)
        }, uniquingKeysWith: { first, _ in first })

        for exercise in exerciseStore.exercises {
            let definition = definitionsByUUID[exercise.uuid] ?? insert(entityName: "ExerciseDefinition", context: context)
            definitionsByUUID[exercise.uuid] = definition
            definition.setValue(exercise.uuid, forKey: "uuid")
            definition.setValue(exercise.title, forKey: "title")
            definition.setValue(exercise.isCustom, forKey: "isCustom")
            definition.setValue(false, forKey: "isArchived")
            definition.setValue(exercise.isCustom ? "custom" : "built_in", forKey: "source")
            definition.setValue(exercise.defaultMetric.rawValue, forKey: "defaultMetric")
            definition.setValue(exercise.description, forKey: "exerciseDescription")
            definition.setValue(encode(exercise.primaryMuscle), forKey: "primaryMusclesJSON")
            definition.setValue(encode(exercise.secondaryMuscle), forKey: "secondaryMusclesJSON")
            definition.setValue(encode(exercise.equipment), forKey: "equipmentJSON")
            definition.setValue(encode(exercise.activityCategoryIDs), forKey: "activityCategoriesJSON")
            if definition.entity.attributesByName["movementID"] != nil {
                definition.setValue(exercise.movementID, forKey: "movementID")
                definition.setValue(exercise.movementTitle, forKey: "movementTitle")
                definition.setValue(exercise.variationTitle, forKey: "variationTitle")
                definition.setValue(encode(exercise.variationTags), forKey: "variationTagsJSON")
            }
            setStructuredVariationFields(from: exercise, on: definition)
        }

        let categoriesByID = try seedExerciseCategories(context: context)
        try seedCategoryMemberships(exercises: exerciseStore.exercises, definitionsByUUID: definitionsByUUID, categoriesByID: categoriesByID, context: context)
    }

    private static func backfillCustomExerciseMovementMetadata(context: NSManagedObjectContext) throws {
        let request = NSFetchRequest<NSManagedObject>(entityName: "CustomExercise")
        let exercises = try context.fetch(request)
        for exercise in exercises where exercise.entity.attributesByName["movementID"] != nil {
            let uuid = exercise.value(forKey: "uuid") as? UUID
            let title = exercise.value(forKey: "title") as? String ?? ""
            let equipment = decodeStrings(exercise.value(forKey: "equipmentJSON") as? String)
            if (exercise.value(forKey: "movementID") as? String)?.isEmpty ?? true {
                exercise.setValue(uuid?.uuidString.lowercased(), forKey: "movementID")
            }
            if (exercise.value(forKey: "movementTitle") as? String)?.isEmpty ?? true {
                exercise.setValue(Exercise.defaultMovementTitle(for: title), forKey: "movementTitle")
            }
            if exercise.value(forKey: "variationTitle") == nil, let variationTitle = variationTitle(for: equipment) {
                exercise.setValue(variationTitle, forKey: "variationTitle")
            }
            let variationTitle = exercise.value(forKey: "variationTitle") as? String
            let structured = Exercise.structuredVariationFields(
                title: title,
                variationTitle: variationTitle,
                equipment: equipment
            )
            setIfAttributeExists("equipmentTitle", structured.equipmentTitle, on: exercise)
            setIfAttributeExists("attachmentTitle", structured.attachmentTitle, on: exercise)
            setIfAttributeExists("setupTitle", structured.setupTitle, on: exercise)
            setIfAttributeExists("gripTitle", structured.gripTitle, on: exercise)
            setIfAttributeExists("sideTitle", structured.sideTitle, on: exercise)
            setIfAttributeExists("loadModeTitle", structured.loadModeTitle, on: exercise)
            if (exercise.value(forKey: "variationTagsJSON") as? String)?.isEmpty ?? true {
                exercise.setValue(encode(Exercise.normalizedVariationTags(structured.tags + equipment)), forKey: "variationTagsJSON")
            }
        }
    }

    private static func setStructuredVariationFields(from exercise: Exercise, on object: NSManagedObject) {
        setIfAttributeExists("equipmentTitle", exercise.equipmentTitle, on: object)
        setIfAttributeExists("attachmentTitle", exercise.attachmentTitle, on: object)
        setIfAttributeExists("setupTitle", exercise.setupTitle, on: object)
        setIfAttributeExists("gripTitle", exercise.gripTitle, on: object)
        setIfAttributeExists("sideTitle", exercise.sideTitle, on: object)
        setIfAttributeExists("loadModeTitle", exercise.loadModeTitle, on: object)
    }

    private static func setIfAttributeExists(_ key: String, _ value: Any?, on object: NSManagedObject) {
        guard object.entity.attributesByName[key] != nil else { return }
        object.setValue(value, forKey: key)
    }

    private static func seedExerciseCategories(context: NSManagedObjectContext) throws -> [String: NSManagedObject] {
        let existingCategories = try fetchObjects(entityName: "ExerciseCategory", context: context)
        var categoriesByID: [String: NSManagedObject] = [:]
        for category in existingCategories {
            if let workoutType = category.value(forKey: "workoutType") as? WorkoutType {
                categoriesByID[workoutType.exerciseCategoryID] = category
            } else if let title = category.value(forKey: "title") as? String {
                categoriesByID[title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()] = category
            }
        }

        let workoutTypes = try context.fetch(WorkoutType.fetchRequestSorted())
        for type in workoutTypes {
            let id = type.exerciseCategoryID
            let category = categoriesByID[id] ?? insert(entityName: "ExerciseCategory", context: context)
            categoriesByID[id] = category
            category.setValue(type.uuid ?? UUID(), forKey: "uuid")
            category.setValue(type.displayTitle, forKey: "title")
            category.setValue(type.sortIndex, forKey: "sortIndex")
            category.setValue(type.isDefaultPreset, forKey: "isDefault")
            category.setValue(type, forKey: "workoutType")
        }

        for fallback in ExerciseActivityCategory.allCases {
            if categoriesByID[fallback.rawValue] == nil {
                let category = insert(entityName: "ExerciseCategory", context: context)
                category.setValue(UUID(), forKey: "uuid")
                category.setValue(fallback.title, forKey: "title")
                category.setValue(Int32(categoriesByID.count), forKey: "sortIndex")
                category.setValue(true, forKey: "isDefault")
                categoriesByID[fallback.rawValue] = category
            }
        }

        return categoriesByID
    }

    private static func seedCategoryMemberships(exercises: [Exercise], definitionsByUUID: [UUID: NSManagedObject], categoriesByID: [String: NSManagedObject], context: NSManagedObjectContext) throws {
        let existingMemberships = try fetchObjects(entityName: "ExerciseCategoryMembership", context: context)
        var existingKeys = Set<String>()
        for membership in existingMemberships {
            guard let exercise = membership.value(forKey: "exercise") as? NSManagedObject,
                  let category = membership.value(forKey: "category") as? NSManagedObject else { continue }
            existingKeys.insert("\(exercise.objectID.uriRepresentation().absoluteString)|\(category.objectID.uriRepresentation().absoluteString)")
        }

        for exercise in exercises {
            guard let definition = definitionsByUUID[exercise.uuid] else { continue }
            for (index, categoryID) in exercise.activityCategoryIDs.enumerated() {
                guard let category = categoriesByID[categoryID] else { continue }
                let key = "\(definition.objectID.uriRepresentation().absoluteString)|\(category.objectID.uriRepresentation().absoluteString)"
                guard !existingKeys.contains(key) else { continue }
                let membership = insert(entityName: "ExerciseCategoryMembership", context: context)
                membership.setValue(UUID(), forKey: "uuid")
                membership.setValue(Int32(index), forKey: "sortIndex")
                membership.setValue(definition, forKey: "exercise")
                membership.setValue(category, forKey: "category")
                existingKeys.insert(key)
            }
        }
    }

    private static func linkExerciseDefinitions(entityName: String, context: NSManagedObjectContext) throws {
        let definitions = try fetchObjects(entityName: "ExerciseDefinition", context: context)
        let definitionsByUUID = Dictionary(definitions.compactMap { object -> (UUID, NSManagedObject)? in
            guard let uuid = object.value(forKey: "uuid") as? UUID else { return nil }
            return (uuid, object)
        }, uniquingKeysWith: { first, _ in first })
        for object in try fetchObjects(entityName: entityName, context: context) {
            guard object.value(forKey: "exerciseDefinition") == nil,
                  let uuid = object.value(forKey: "exerciseUuid") as? UUID,
                  let definition = definitionsByUUID[uuid] else { continue }
            object.setValue(definition, forKey: "exerciseDefinition")
        }
    }

    private static func migrateWorkoutSetMeasurements(context: NSManagedObjectContext) throws {
        for set in try fetchObjects(entityName: "WorkoutSet", context: context) {
            if relationshipCount(set, key: "measurements") == 0 {
                addMeasurement(to: set, kind: .reps, unit: .count, value: number(set, "repetitions"), context: context)
                addMeasurement(to: set, kind: .weight, unit: .kg, value: number(set, "weight"), context: context)
                addMeasurement(to: set, kind: .addedWeight, unit: .kg, value: number(set, "addedWeight"), context: context)
                addMeasurement(to: set, kind: .duration, unit: .sec, value: number(set, "duration"), context: context)
                addMeasurement(to: set, kind: .distance, unit: .km, value: number(set, "distance"), context: context)
                if let rpe = number(set, "rpe"), rpe > 0 {
                    addMeasurement(to: set, kind: .rpe, unit: .rpe, value: rpe, context: context)
                }
            }

            if relationshipCount(set, key: "setTargets") == 0 {
                addTarget(to: set, relationshipKey: "workoutSet", entityName: "SetTarget", kind: .reps, unit: .count, min: number(set, "minTargetRepetitions"), max: number(set, "maxTargetRepetitions"), context: context)
                addTarget(to: set, relationshipKey: "workoutSet", entityName: "SetTarget", kind: .duration, unit: .sec, min: number(set, "minTargetDuration"), max: number(set, "maxTargetDuration"), context: context)
                addTarget(to: set, relationshipKey: "workoutSet", entityName: "SetTarget", kind: .distance, unit: .km, min: number(set, "targetDistance"), max: nil, context: context)
                addTarget(to: set, relationshipKey: "workoutSet", entityName: "SetTarget", kind: .weight, unit: .kg, min: number(set, "targetWeight"), max: nil, context: context)
                addTarget(to: set, relationshipKey: "workoutSet", entityName: "SetTarget", kind: .rpe, unit: .rpe, min: number(set, "targetRpe"), max: nil, context: context)
            }
        }
    }

    private static func migrateRoutineSetTargets(context: NSManagedObjectContext) throws {
        for set in try fetchObjects(entityName: "WorkoutRoutineSet", context: context) where relationshipCount(set, key: "routineSetTargets") == 0 {
            addTarget(to: set, relationshipKey: "workoutRoutineSet", entityName: "RoutineSetTarget", kind: .reps, unit: .count, min: number(set, "minRepetitions"), max: number(set, "maxRepetitions"), context: context)
            addTarget(to: set, relationshipKey: "workoutRoutineSet", entityName: "RoutineSetTarget", kind: .duration, unit: .sec, min: number(set, "minTargetDuration"), max: number(set, "maxTargetDuration"), context: context)
            addTarget(to: set, relationshipKey: "workoutRoutineSet", entityName: "RoutineSetTarget", kind: .distance, unit: .km, min: number(set, "targetDistance"), max: nil, context: context)
        }
    }

    private static func addMeasurement(to set: NSManagedObject, kind: SetMeasurementKind, unit: SetMeasurementUnit, value: Double?, context: NSManagedObjectContext) {
        guard let value else { return }
        let measurement = insert(entityName: "SetMeasurement", context: context)
        measurement.setValue(UUID(), forKey: "uuid")
        measurement.setValue(kind.rawValue, forKey: "kind")
        measurement.setValue(unit.rawValue, forKey: "unit")
        measurement.setValue(value, forKey: "value")
        measurement.setValue(set, forKey: "workoutSet")
    }

    private static func addTarget(to set: NSManagedObject, relationshipKey: String, entityName: String, kind: SetMeasurementKind, unit: SetMeasurementUnit, min: Double?, max: Double?, context: NSManagedObjectContext) {
        guard min != nil || max != nil else { return }
        let target = insert(entityName: entityName, context: context)
        target.setValue(UUID(), forKey: "uuid")
        target.setValue(kind.rawValue, forKey: "kind")
        target.setValue(unit.rawValue, forKey: "unit")
        target.setValue(min, forKey: "minValue")
        target.setValue(max, forKey: "maxValue")
        target.setValue(set, forKey: relationshipKey)
    }

    private static func number(_ object: NSManagedObject, _ key: String) -> Double? {
        guard let value = object.value(forKey: key) as? NSNumber else { return nil }
        return value.doubleValue
    }

    private static func relationshipCount(_ object: NSManagedObject, key: String) -> Int {
        if let ordered = object.value(forKey: key) as? NSOrderedSet {
            return ordered.count
        }
        if let set = object.value(forKey: key) as? Set<NSManagedObject> {
            return set.count
        }
        if let set = object.value(forKey: key) as? NSSet {
            return set.count
        }
        return 0
    }

    private static func fetchObjects(entityName: String, context: NSManagedObjectContext) throws -> [NSManagedObject] {
        let request = NSFetchRequest<NSManagedObject>(entityName: entityName)
        return try context.fetch(request)
    }

    private static func insert(entityName: String, context: NSManagedObjectContext) -> NSManagedObject {
        NSEntityDescription.insertNewObject(forEntityName: entityName, into: context)
    }

    private static func encode<T: Encodable>(_ value: T) -> String {
        guard let data = try? JSONEncoder().encode(value),
              let string = String(data: data, encoding: .utf8) else {
            return "[]"
        }
        return string
    }

    private static func decodeStrings(_ json: String?) -> [String] {
        guard let data = json?.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([String].self, from: data)) ?? []
    }

    private static func variationTitle(for equipment: [String]) -> String? {
        if equipment.contains("barbell") { return "Barbell" }
        if equipment.contains("dumbbell") { return "Dumbbell" }
        return nil
    }
}
