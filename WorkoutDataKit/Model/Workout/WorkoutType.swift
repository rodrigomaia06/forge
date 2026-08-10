//
//  WorkoutType.swift
//  WorkoutDataKit
//

import CoreData

public class WorkoutType: NSManagedObject {
    public struct Preset {
        public let uuid: UUID
        public let title: String
        public let colorHex: String
        public let sortIndex: Int32
    }

    public static let defaultPresets: [Preset] = [
        Preset(uuid: UUID(uuidString: "98F95D3E-D4D2-4EF8-9F1E-7787894D5651")!, title: "Strength", colorHex: "#3B82F6", sortIndex: 0),
        Preset(uuid: UUID(uuidString: "6DDCA6ED-F11D-4F1A-8EE7-1D5BC7ED4876")!, title: "Tennis", colorHex: "#22C55E", sortIndex: 1),
        Preset(uuid: UUID(uuidString: "4C32F1E2-C3D9-48E9-9354-740C84062563")!, title: "Martial arts", colorHex: "#EF4444", sortIndex: 2),
        Preset(uuid: UUID(uuidString: "0BE58C8E-BAE4-4C02-B0C0-C11C81808F24")!, title: "Cardio", colorHex: "#F97316", sortIndex: 3),
        Preset(uuid: UUID(uuidString: "C3915711-95E9-4A8E-BF6A-562F1F04471E")!, title: "Mobility", colorHex: "#A855F7", sortIndex: 4),
        Preset(uuid: UUID(uuidString: "11688187-7CF6-4633-8CF2-F7A21FD2808E")!, title: "Other", colorHex: "#6B7280", sortIndex: 5)
    ]

    public static let fallbackTitle = "Strength"
    public static let fallbackColorHex = "#3B82F6"

    public var id: String { uuid?.uuidString ?? objectID.uriRepresentation().absoluteString }

    public class func create(context: NSManagedObjectContext) -> WorkoutType {
        let type = WorkoutType(context: context)
        type.uuid = UUID()
        type.title = ""
        type.colorHex = fallbackColorHex
        type.isArchived = false
        type.sortIndex = 0
        return type
    }

    public var displayTitle: String {
        let trimmed = (title ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? Self.fallbackTitle : trimmed
    }

    public var displayColorHex: String {
        let trimmed = (colorHex ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? Self.fallbackColorHex : trimmed
    }

    public var isDefaultPreset: Bool {
        guard let uuid else { return false }
        return Self.defaultPresets.contains { $0.uuid == uuid }
    }

    public var hasUserDataReferences: Bool {
        (workouts?.count ?? 0) > 0 || (defaultRoutines?.count ?? 0) > 0
    }

    public func deleteOrArchive(in context: NSManagedObjectContext) {
        if isDefaultPreset || hasUserDataReferences {
            isArchived = true
        } else {
            context.delete(self)
        }
    }

    public static func fetchRequestSorted(includeArchived: Bool = true) -> NSFetchRequest<WorkoutType> {
        let request: NSFetchRequest<WorkoutType> = WorkoutType.fetchRequest()
        if !includeArchived {
            request.predicate = NSPredicate(format: "\(#keyPath(WorkoutType.isArchived)) == %@", NSNumber(value: false))
        }
        request.sortDescriptors = [
            NSSortDescriptor(keyPath: \WorkoutType.sortIndex, ascending: true),
            NSSortDescriptor(keyPath: \WorkoutType.title, ascending: true)
        ]
        return request
    }

    public static func seedDefaultsIfNeeded(context: NSManagedObjectContext) throws {
        let existing = try context.fetch(fetchRequestSorted())
        var byUUID: [UUID: WorkoutType] = [:]
        var byTitle: [String: WorkoutType] = [:]
        for type in existing {
            if let uuid = type.uuid, byUUID[uuid] == nil {
                byUUID[uuid] = type
            }
            let title = type.displayTitle.lowercased()
            if byTitle[title] == nil {
                byTitle[title] = type
            }
        }

        for preset in defaultPresets {
            let key = preset.title.lowercased()
            let existingType = byUUID[preset.uuid] ?? byTitle[key]
            let type = existingType ?? WorkoutType.create(context: context)
            if existingType == nil {
                type.uuid = preset.uuid
                type.title = preset.title
                type.colorHex = preset.colorHex
                type.sortIndex = preset.sortIndex
            } else if byUUID[preset.uuid] == nil, byTitle[key]?.objectID == type.objectID {
                type.uuid = preset.uuid
            }
            if type.uuid == preset.uuid {
                type.title = type.title ?? preset.title
                type.colorHex = type.colorHex ?? preset.colorHex
                type.sortIndex = type.sortIndex == 0 ? preset.sortIndex : type.sortIndex
            }
            byUUID[preset.uuid] = type
            byTitle[key] = type
        }

        if context.hasChanges {
            try context.save()
        }
    }

    public static func defaultType(in context: NSManagedObjectContext) -> WorkoutType? {
        if let strength = try? find(title: fallbackTitle, in: context) {
            return strength
        }
        try? seedDefaultsIfNeeded(context: context)
        return try? find(title: fallbackTitle, in: context)
    }

    public static func find(title: String, in context: NSManagedObjectContext) throws -> WorkoutType? {
        let request: NSFetchRequest<WorkoutType> = WorkoutType.fetchRequest()
        request.fetchLimit = 1
        request.predicate = NSPredicate(format: "title =[c] %@", title)
        return try context.fetch(request).first
    }

    public static func findOrCreate(title: String, colorHex: String?, in context: NSManagedObjectContext) throws -> WorkoutType {
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let displayTitle = cleanTitle.isEmpty ? fallbackTitle : cleanTitle
        if let existing = try find(title: displayTitle, in: context) {
            return existing
        }
        let request = fetchRequestSorted()
        let nextIndex = ((try? context.fetch(request).map(\.sortIndex).max()) ?? -1) + 1
        let type = WorkoutType.create(context: context)
        type.title = displayTitle
        type.colorHex = colorHex ?? fallbackColorHex
        type.sortIndex = nextIndex
        type.isArchived = false
        return type
    }
}
