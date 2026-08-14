//
//  ExerciseDefinition.swift
//  WorkoutDataKit
//

import CoreData

public enum SetMeasurementKind: String {
    case reps
    case weight
    case addedWeight
    case duration
    case distance
    case rpe
}

public enum SetMeasurementUnit: String {
    case count
    case kg
    case sec
    case km
    case rpe
}

public class ExerciseDefinition: NSManagedObject {
    public var id: String { (value(forKey: "uuid") as? UUID)?.uuidString ?? objectID.uriRepresentation().absoluteString }
}

public class ExerciseCategory: NSManagedObject {
    public var id: String { (value(forKey: "uuid") as? UUID)?.uuidString ?? objectID.uriRepresentation().absoluteString }
}

public class ExerciseCategoryMembership: NSManagedObject {
    public var id: String { (value(forKey: "uuid") as? UUID)?.uuidString ?? objectID.uriRepresentation().absoluteString }
}

public class SetMeasurement: NSManagedObject {
    public var id: String { (value(forKey: "uuid") as? UUID)?.uuidString ?? objectID.uriRepresentation().absoluteString }
}

public class SetTarget: NSManagedObject {
    public var id: String { (value(forKey: "uuid") as? UUID)?.uuidString ?? objectID.uriRepresentation().absoluteString }
}

public class RoutineSetTarget: NSManagedObject {
    public var id: String { (value(forKey: "uuid") as? UUID)?.uuidString ?? objectID.uriRepresentation().absoluteString }
}
