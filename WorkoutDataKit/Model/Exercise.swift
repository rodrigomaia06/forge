//
//  Exercise.swift
//  Rhino Fit
//
//  Created by Karim Abou Zeid on 15.01.18.
//  Copyright © 2018 Karim Abou Zeid Software. All rights reserved.
//

import Foundation

public struct Exercise: Hashable {
    public let uuid: UUID // we use this for actually identifying the exercise
    public let everkineticId: Int // this is the everkinetic exercise id or 10000 if it's a custom exercise
    public let title: String
    public let alias: [String]
    public let movementID: String
    public let movementTitle: String
    public let variationTitle: String?
    public let equipmentTitle: String?
    public let attachmentTitle: String?
    public let setupTitle: String?
    public let gripTitle: String?
    public let sideTitle: String?
    public let loadModeTitle: String?
    public let variationTags: [String]
    public let activityCategories: [ExerciseActivityCategory]
    public let activityCategoryIDs: [String]
    public let defaultMetric: ExerciseSetMetric
    public let description: String? // primer
    public let primaryMuscle: [String] // primary
    public let secondaryMuscle: [String] // secondary
    public let equipment: [String]
    public let steps: [String]
    public let tips: [String]
    public let references: [String]

    public init(
        uuid: UUID,
        everkineticId: Int,
        title: String,
        alias: [String],
        movementID: String? = nil,
        movementTitle: String? = nil,
        variationTitle: String? = nil,
        equipmentTitle: String? = nil,
        attachmentTitle: String? = nil,
        setupTitle: String? = nil,
        gripTitle: String? = nil,
        sideTitle: String? = nil,
        loadModeTitle: String? = nil,
        variationTags: [String] = [],
        activityCategories: [ExerciseActivityCategory] = [.strength],
        activityCategoryIDs: [String]? = nil,
        defaultMetric: ExerciseSetMetric = .reps,
        description: String?,
        primaryMuscle: [String],
        secondaryMuscle: [String],
        equipment: [String],
        steps: [String],
        tips: [String],
        references: [String]
    ) {
        self.uuid = uuid
        self.everkineticId = everkineticId
        self.title = title
        self.alias = alias
        let resolvedMovementTitle = (movementTitle ?? Self.defaultMovementTitle(for: title)).trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedMovementID = (movementID ?? Self.defaultMovementID(for: resolvedMovementTitle)).trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedVariationTitle = variationTitle?.trimmingCharacters(in: .whitespacesAndNewlines)
        let structured = Self.structuredVariationFields(
            title: title,
            variationTitle: resolvedVariationTitle,
            equipment: equipment,
            equipmentTitle: equipmentTitle,
            attachmentTitle: attachmentTitle,
            setupTitle: setupTitle,
            gripTitle: gripTitle,
            sideTitle: sideTitle,
            loadModeTitle: loadModeTitle
        )
        self.movementID = resolvedMovementID.isEmpty ? Self.defaultMovementID(for: resolvedMovementTitle) : resolvedMovementID
        self.movementTitle = resolvedMovementTitle.isEmpty ? title : resolvedMovementTitle
        self.variationTitle = resolvedVariationTitle?.isEmpty == true ? nil : resolvedVariationTitle
        self.equipmentTitle = structured.equipmentTitle
        self.attachmentTitle = structured.attachmentTitle
        self.setupTitle = structured.setupTitle
        self.gripTitle = structured.gripTitle
        self.sideTitle = structured.sideTitle
        self.loadModeTitle = structured.loadModeTitle
        let structuredTags = structured.tags + equipment
        self.variationTags = Self.normalizedVariationTags(variationTags.isEmpty ? structuredTags : variationTags)
        let resolvedCategories = activityCategories.isEmpty ? [ExerciseActivityCategory.strength] : activityCategories
        let resolvedCategoryIDs = activityCategoryIDs ?? resolvedCategories.map(\.rawValue)
        self.activityCategories = resolvedCategories
        self.activityCategoryIDs = resolvedCategoryIDs.isEmpty ? [ExerciseActivityCategory.strength.rawValue] : resolvedCategoryIDs
        self.defaultMetric = defaultMetric
        self.description = description
        self.primaryMuscle = primaryMuscle
        self.secondaryMuscle = secondaryMuscle
        self.equipment = equipment
        self.steps = steps
        self.tips = tips
        self.references = references
    }
}

public struct ExerciseMovement: Hashable, Identifiable {
    public let id: String
    public let title: String
    public let variations: [ExerciseVariation]

    public init(id: String, title: String, variations: [ExerciseVariation]) {
        self.id = id
        self.title = title
        self.variations = variations
    }
}

public struct ExerciseVariation: Hashable, Identifiable {
    public var id: UUID { exercise.uuid }
    public let exercise: Exercise

    public init(exercise: Exercise) {
        self.exercise = exercise
    }
}

public enum ExerciseVariationAttribute: String, CaseIterable, Hashable, Identifiable {
    case attachment
    case setup
    case grip
    case side
    case load

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .attachment: return "Attachment"
        case .setup: return "Setup"
        case .grip: return "Grip"
        case .side: return "Side"
        case .load: return "Load"
        }
    }
}

public struct ExerciseVariationSelection: Hashable {
    public let movementID: String
    public let equipmentTitle: String?
    public let attachmentTitle: String?
    public let setupTitle: String?
    public let gripTitle: String?
    public let sideTitle: String?
    public let loadModeTitle: String?

    public init(
        movementID: String,
        equipmentTitle: String?,
        attachmentTitle: String? = nil,
        setupTitle: String? = nil,
        gripTitle: String? = nil,
        sideTitle: String? = nil,
        loadModeTitle: String? = nil
    ) {
        self.movementID = movementID.trimmingCharacters(in: .whitespacesAndNewlines)
        self.equipmentTitle = Exercise.cleanVariationField(equipmentTitle)
        self.attachmentTitle = Exercise.cleanVariationField(attachmentTitle)
        self.setupTitle = Exercise.cleanVariationField(setupTitle)
        self.gripTitle = Exercise.cleanVariationField(gripTitle)
        self.sideTitle = Exercise.cleanVariationField(sideTitle)
        self.loadModeTitle = Exercise.cleanVariationField(loadModeTitle)
    }

    public var identityKey: String {
        Exercise.variationIdentityKey(
            movementID: movementID,
            equipmentTitle: equipmentTitle,
            attachmentTitle: attachmentTitle,
            setupTitle: setupTitle,
            gripTitle: gripTitle,
            sideTitle: sideTitle,
            loadModeTitle: loadModeTitle
        )
    }

    public var summaryTitle: String {
        [equipmentTitle, setupTitle, gripTitle, attachmentTitle, sideTitle, loadModeTitle]
            .compactMap { $0 }
            .joined(separator: ", ")
    }

    public func value(for attribute: ExerciseVariationAttribute) -> String? {
        switch attribute {
        case .attachment: return attachmentTitle
        case .setup: return setupTitle
        case .grip: return gripTitle
        case .side: return sideTitle
        case .load: return loadModeTitle
        }
    }
}

public struct ExerciseVariationOptions: Equatable {
    public let equipment: [String]
    public let attachment: [String]
    public let setup: [String]
    public let grip: [String]
    public let side: [String]
    public let load: [String]

    public init(equipment: [String], attachment: [String], setup: [String], grip: [String], side: [String], load: [String]) {
        self.equipment = equipment
        self.attachment = attachment
        self.setup = setup
        self.grip = grip
        self.side = side
        self.load = load
    }

    public func values(for attribute: ExerciseVariationAttribute) -> [String] {
        switch attribute {
        case .attachment: return attachment
        case .setup: return setup
        case .grip: return grip
        case .side: return side
        case .load: return load
        }
    }
}

extension Exercise {
    public var variationDisplayTitle: String {
        let fields = displayVariationFields
        guard !fields.isEmpty else { return title }
        return fields.map { "\($0.label): \($0.value)" }.joined(separator: "\n")
    }

    public var variationSummaryTitle: String {
        let values = displayVariationFields.map(\.value)
        guard !values.isEmpty else { return variationTitle ?? title }
        return values.joined(separator: ", ")
    }

    public var browsingVariationTitle: String {
        let detailValues = displayVariationFields
            .filter { $0.label != "Equipment" }
            .map(\.value)
        let equipment = equipmentTitle?.trimmingCharacters(in: .whitespacesAndNewlines)
        let isBodyweight = equipment?
            .lowercased()
            .replacingOccurrences(of: "-", with: "_")
            .replacingOccurrences(of: " ", with: "_") == "bodyweight"

        if isBodyweight {
            return detailValues.isEmpty ? movementTitle : detailValues.joined(separator: ", ")
        }

        var values = [String]()
        if let equipment, !equipment.isEmpty {
            values.append(equipment)
        }
        values.append(contentsOf: detailValues)
        guard !values.isEmpty else { return variationTitle ?? title }
        return values.joined(separator: ", ")
    }

    public var browsingExerciseTitle: String {
        let variation = browsingVariationTitle
        guard variation != movementTitle else { return movementTitle }
        return "\(movementTitle), \(variation)"
    }

    public var variationDisplayFields: [(label: String, value: String)] {
        [
            ("Equipment", equipmentTitle),
            ("Attachment", attachmentTitle),
            ("Setup", setupTitle),
            ("Grip", gripTitle),
            ("Side", sideTitle),
            ("Load", loadModeTitle)
        ].compactMap { label, value in
            guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
            return (label, value)
        }
    }

    /// Presentation-only projection. Structured fields remain intact for identity, search and
    /// generated combinations, but details that are already part of the movement name add noise.
    public var displayVariationFields: [(label: String, value: String)] {
        variationDisplayFields.filter { field in
            !isImplicitDisplayField(field.value)
        }
    }

    private func isImplicitDisplayField(_ value: String) -> Bool {
        let normalizedMovement = movementTitle.normalizedDisplayText
        let normalizedValue = value.normalizedDisplayText
        guard normalizedValue.count >= 4 else { return false }
        return normalizedMovement.contains(normalizedValue) || normalizedValue == "lowpulley"
    }

    public var variationIdentityKey: String {
        Self.variationIdentityKey(
            movementID: movementID,
            equipmentTitle: equipmentTitle,
            attachmentTitle: attachmentTitle,
            setupTitle: setupTitle,
            gripTitle: gripTitle,
            sideTitle: sideTitle,
            loadModeTitle: loadModeTitle
        )
    }

    public static func defaultMovementTitle(for title: String) -> String {
        var result = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if let colon = result.firstIndex(of: ":") {
            result = String(result[..<colon])
        }
        result = result.replacingOccurrences(of: #" \([^)]*\)"#, with: "", options: .regularExpression)
        result = result.replacingOccurrences(of: "Skullcrusher", with: "Skull Crusher")
        result = result.replacingOccurrences(of: "Face Pulls", with: "Face Pull")
        result = result.replacingOccurrences(of: "Shrugs", with: "Shrug")
        result = result.replacingOccurrences(of: "Lunges", with: "Lunge")
        return result.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public static func defaultMovementID(for title: String) -> String {
        let allowed = CharacterSet.alphanumerics
        var result = ""
        var lastWasSeparator = false
        for scalar in title.lowercased().unicodeScalars {
            if allowed.contains(scalar) {
                result.unicodeScalars.append(scalar)
                lastWasSeparator = false
            } else if !lastWasSeparator {
                result.append("_")
                lastWasSeparator = true
            }
        }
        return result.trimmingCharacters(in: CharacterSet(charactersIn: "_"))
    }

    public static func normalizedVariationTags(_ tags: [String]) -> [String] {
        tags
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().replacingOccurrences(of: " ", with: "_") }
            .filter { !$0.isEmpty }
            .uniqed()
    }

    public static func variationIdentityKey(
        movementID: String?,
        equipmentTitle: String?,
        attachmentTitle: String?,
        setupTitle: String?,
        gripTitle: String?,
        sideTitle: String?,
        loadModeTitle: String?
    ) -> String {
        [
            movementID,
            equipmentTitle,
            attachmentTitle,
            setupTitle,
            gripTitle,
            sideTitle,
            loadModeTitle
        ]
            .compactMap { $0?.normalizedVariationIdentityToken }
            .joined(separator: "|")
    }

    public static func structuredVariationFields(
        title: String,
        variationTitle: String?,
        equipment: [String],
        equipmentTitle: String? = nil,
        attachmentTitle: String? = nil,
        setupTitle: String? = nil,
        gripTitle: String? = nil,
        sideTitle: String? = nil,
        loadModeTitle: String? = nil
    ) -> (equipmentTitle: String?, attachmentTitle: String?, setupTitle: String?, gripTitle: String?, sideTitle: String?, loadModeTitle: String?, tags: [String]) {
        var resolvedEquipment = cleanVariationField(equipmentTitle) ?? equipmentDisplayTitle(for: equipment)
        var resolvedAttachment = cleanVariationField(attachmentTitle)
        var resolvedSetup = cleanVariationField(setupTitle)
        var resolvedGrip = cleanVariationField(gripTitle)
        var resolvedSide = cleanVariationField(sideTitle)
        var resolvedLoadMode = cleanVariationField(loadModeTitle)

        let source = [title, variationTitle].compactMap { $0 }.joined(separator: " ").lowercased()
        let parts = variationTitle?
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) } ?? []

        for part in parts {
            let normalized = part.lowercased()
            if resolvedEquipment == nil, let value = equipmentField(for: normalized) {
                resolvedEquipment = value
            } else if resolvedAttachment == nil, let value = attachmentField(for: normalized) {
                resolvedAttachment = value
            } else if resolvedSetup == nil, let value = setupField(for: normalized) {
                resolvedSetup = value
            } else if resolvedGrip == nil, let value = gripField(for: normalized) {
                resolvedGrip = value
            } else if resolvedSide == nil, let value = sideField(for: normalized) {
                resolvedSide = value
            } else if let value = loadModeField(for: normalized), resolvedLoadMode == nil || (resolvedLoadMode == "Bodyweight" && value != "Bodyweight") {
                resolvedLoadMode = value
            }
        }

        if resolvedAttachment == nil { resolvedAttachment = attachmentField(in: source) }
        if resolvedSetup == nil { resolvedSetup = setupField(in: source) }
        if resolvedGrip == nil { resolvedGrip = gripField(in: source) }
        if resolvedSide == nil { resolvedSide = sideField(in: source) }
        if source.contains("weighted") {
            resolvedLoadMode = "Weighted"
        } else if source.contains("assisted") {
            resolvedLoadMode = "Assisted"
        } else if resolvedLoadMode == nil {
            resolvedLoadMode = loadModeField(in: source)
        }

        let tags = [resolvedEquipment, resolvedAttachment, resolvedSetup, resolvedGrip, resolvedSide, resolvedLoadMode]
            .compactMap { $0?.normalizedVariationIdentityToken }
        return (resolvedEquipment, resolvedAttachment, resolvedSetup, resolvedGrip, resolvedSide, resolvedLoadMode, tags)
    }

    public static func cleanVariationField(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed?.isEmpty == false ? trimmed : nil
    }

    private static func equipmentDisplayTitle(for equipment: [String]) -> String? {
        let tokens = equipment.map { $0.lowercased() }
        if tokens.contains("cable") { return "Cable" }
        if tokens.contains("barbell") { return "Barbell" }
        if tokens.contains("dumbbell") { return "Dumbbell" }
        if tokens.contains("ez-curl-bar") { return "EZ curl bar" }
        if tokens.contains("smith machine") { return "Smith machine" }
        if tokens.contains("kettlebell") { return "Kettlebell" }
        if tokens.contains(where: { $0.contains("machine") || $0.contains("chest machine") }) { return "Machine" }
        if tokens.contains("body") { return "Bodyweight" }
        return nil
    }

    private static func equipmentField(for value: String) -> String? {
        switch value {
        case "cable": return "Cable"
        case "barbell": return "Barbell"
        case "dumbbell": return "Dumbbell"
        case "ez curl bar", "ez-curl-bar": return "EZ curl bar"
        case "smith machine": return "Smith machine"
        case "machine", "leg press", "t-bar": return value == "leg press" ? "Leg press" : value == "t-bar" ? "T-bar" : "Machine"
        case "kettlebell": return "Kettlebell"
        case "bodyweight": return "Bodyweight"
        default: return nil
        }
    }

    private static func attachmentField(for value: String) -> String? {
        switch value {
        case "rope": return "Rope"
        case "v-bar", "v bar": return "V-bar"
        case "straight bar": return "Straight bar"
        case "d-handle", "d handle": return "D-handle"
        case "ankle strap": return "Ankle strap"
        default: return nil
        }
    }

    private static func attachmentField(in source: String) -> String? {
        for token in ["rope", "v-bar", "v bar", "straight bar", "d-handle", "d handle", "ankle strap"] {
            if source.contains(token) { return attachmentField(for: token) }
        }
        return nil
    }

    private static func setupField(for value: String) -> String? {
        switch value {
        case "incline": return "Incline"
        case "decline": return "Decline"
        case "overhead", "behind the head": return "Overhead"
        case "lying": return "Lying"
        case "seated": return "Seated"
        case "standing": return "Standing"
        case "kneeling": return "Kneeling"
        case "low", "low-pulley", "low pulley": return "Low pulley"
        case "bent over": return "Bent over"
        case "chest supported": return "Chest supported"
        case "wide stance": return "Wide stance"
        case "narrow stance", "narrow": return "Narrow stance"
        case "walking": return "Walking"
        default: return nil
        }
    }

    private static func setupField(in source: String) -> String? {
        for token in ["incline", "decline", "behind the head", "overhead", "lying", "seated", "standing", "kneeling", "low-pulley", "low pulley", "bent over", "chest supported", "wide stance", "narrow stance", "walking"] {
            if source.contains(token) { return setupField(for: token) }
        }
        return nil
    }

    private static func gripField(for value: String) -> String? {
        switch value {
        case "reverse", "reverse grip": return "Reverse grip"
        case "wide", "wide grip": return "Wide grip"
        case "close", "close grip": return "Close grip"
        case "hammer", "hammer grip": return "Hammer grip"
        case "parallel grip", "narrow parallel grip": return "Parallel grip"
        case "overhand": return "Overhand grip"
        case "underhand": return "Underhand grip"
        default: return nil
        }
    }

    private static func gripField(in source: String) -> String? {
        for token in ["narrow parallel grip", "parallel grip", "reverse grip", "reverse", "wide grip", "close grip", "hammer grip", "hammer", "overhand", "underhand"] {
            if source.contains(token) { return gripField(for: token) }
        }
        return nil
    }

    private static func sideField(for value: String) -> String? {
        switch value {
        case "one arm", "one-arm": return "One arm"
        case "two arm", "two-arm": return "Two arm"
        case "single leg", "single-leg": return "Single leg"
        default: return nil
        }
    }

    private static func sideField(in source: String) -> String? {
        for token in ["one arm", "one-arm", "two arm", "two-arm", "single leg", "single-leg"] {
            if source.contains(token) { return sideField(for: token) }
        }
        return nil
    }

    private static func loadModeField(for value: String) -> String? {
        switch value {
        case "weighted": return "Weighted"
        case "assisted": return "Assisted"
        case "bodyweight": return "Bodyweight"
        default: return nil
        }
    }

    private static func loadModeField(in source: String) -> String? {
        for token in ["weighted", "assisted", "bodyweight"] {
            if source.contains(token) { return loadModeField(for: token) }
        }
        return nil
    }
}

private extension String {
    var normalizedDisplayText: String {
        lowercased().unicodeScalars
            .filter { CharacterSet.alphanumerics.contains($0) }
            .map(String.init)
            .joined()
    }
}

private extension String {
    var normalizedVariationIdentityToken: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "-", with: " ")
            .replacingOccurrences(of: "_", with: " ")
            .split(separator: " ")
            .joined(separator: "_")
    }
}

public enum ExerciseActivityCategory: String, CaseIterable, Codable, Hashable {
    case strength
    case cardio
    case courtSports = "court_sports"
    case martialArts = "martial_arts"
    case mobility
    case other

    public var title: String {
        switch self {
        case .strength: return "Strength"
        case .cardio: return "Cardio"
        case .courtSports: return "Court sports"
        case .martialArts: return "Martial arts"
        case .mobility: return "Mobility"
        case .other: return "Other"
        }
    }

    public static func category(forWorkoutTypeTitle title: String?) -> ExerciseActivityCategory {
        switch (title ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "cardio": return .cardio
        case "court sports", "racket sports", "tennis": return .courtSports
        case "martial arts": return .martialArts
        case "mobility": return .mobility
        case "other": return .other
        default: return .strength
        }
    }

    public static func categoryID(forWorkoutTypeTitle title: String?) -> String {
        category(forWorkoutTypeTitle: title).rawValue
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        if rawValue == "tennis" {
            self = .courtSports
            return
        }
        guard let value = Self(rawValue: rawValue) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unknown exercise activity category: \(rawValue)")
        }
        self = value
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

public enum ExerciseSetMetric: String, CaseIterable, Codable, Hashable {
    case reps
    case repRange = "rep_range"
    case time
    case timeRange = "time_range"
    case distance

    public var title: String {
        switch self {
        case .reps: return "Reps"
        case .repRange: return "Rep range"
        case .time: return "Time"
        case .timeRange: return "Time range"
        case .distance: return "Distance"
        }
    }

    public var valueLabel: String {
        switch self {
        case .reps, .repRange: return "reps"
        case .time, .timeRange: return "time"
        case .distance: return "km"
        }
    }

    public var usesReps: Bool { self == .reps || self == .repRange }
    public var usesTime: Bool { self == .time || self == .timeRange }
    public var usesDistance: Bool { self == .distance }

    public static let selectableCases: [ExerciseSetMetric] = [.reps, .time, .timeRange, .distance]

    public var selectableValue: ExerciseSetMetric {
        self == .repRange ? .reps : self
    }
}

extension Exercise {
    /// True when this is a bodyweight exercise: its equipment lists "body" (push-ups, dips, pull-ups, and
    /// so on). Its sets are logged as bodyweight with an added or assisted weight rather than an absolute
    /// one. Editing an exercise's equipment to add or remove "body" is how the flag is changed.
    public var isBodyweight: Bool { equipment.contains("body") }
}

// MARK: - Muscle Names
extension Exercise {
    public var primaryMuscleCommonName: [String] {
        primaryMuscle.map { Self.commonMuscleName(for: $0) ?? $0 }.uniqed()
    }
    
    public var secondaryMuscleCommonName: [String] {
        secondaryMuscle.map { Self.commonMuscleName(for: $0) ?? $0 }.uniqed()
    }
    
    public var muscleGroup: String {
        guard let muscle = primaryMuscle.first else { return "other" }
        return Self.muscleGroup(for: muscle) ?? "other"
    }
    
    public static var muscleNames: [String] {
        commonMuscleNames.keys.map { $0 }
    }
    
    public static func commonMuscleName(for muscle: String) -> String? {
        commonMuscleNames[muscle]
    }
    
    public static func muscleGroup(for muscle: String) -> String? {
        muscleGroupNames[muscle]
    }
    
    private static var commonMuscleNames: [String : String] = [
        "abdominals": "abdominals",
        "biceps brachii": "biceps",
        "deltoid": "shoulders",
        "erector spinae": "lower back",
        "forearm": "forearms",
        "gastrocnemius": "calves",
        "soleus": "calves",
        "glutaeus maximus": "glutes",
        "ischiocrural muscles": "hamstrings",
        "latissimus dorsi": "latissimus",
        "obliques": "obliques",
        "pectoralis major": "chest",
        "quadriceps": "quadriceps",
        "trapezius": "trapezius",
        "triceps brachii": "triceps"
    ]
    
    private static var muscleGroupNames: [String : String] = [
        // abs
        "abdominals": "abdominals",
        "obliques": "abdominals",
        // arms
        "biceps brachii": "arms",
        "forearm": "arms",
        "triceps brachii": "arms",
        // shoulders
        "deltoid": "shoulders",
        // back
        "erector spinae": "back",
        "latissimus dorsi": "back",
        "trapezius": "back",
        // legs
        "gastrocnemius": "legs",
        "soleus": "legs",
        "glutaeus maximus": "legs",
        "ischiocrural muscles": "legs",
        "quadriceps": "legs",
        // chest
        "pectoralis major": "chest"
    ]
}

// MARK: - Exercise Type
extension Exercise {
    public enum ExerciseType: CaseIterable {
        case barbell
        case dumbbell
        case other
        
        public var title: String {
            switch self {
            case .barbell:
                return "Barbell"
            case .dumbbell:
                return "Dumbbell"
            case .other:
                return "Other"
            }
        }
        
        var equipment: String? {
            switch self {
            case .barbell:
                return "barbell"
            case .dumbbell:
                return "dumbbell"
            case .other:
                return nil
            }
        }
    }
    
    public var type: ExerciseType {
        ExerciseType.allCases.first { $0.equipment.map { equipment.contains($0) } ?? false } ?? .other
    }
}

// MARK: - Custom Exercise
extension Exercise {
    static let customEverkineticId = 10000
    
    private static func isCustom(everkineticId: Int) -> Bool {
        everkineticId >= Exercise.customEverkineticId
    }
    
    public var isCustom: Bool {
        Self.isCustom(everkineticId: everkineticId)
    }
}

// MARK: - Codable
extension Exercise: Codable {
    private enum CodingKeys: String, CodingKey {
        case uuid
        case id
//        case name
        case title
        case alias
        case movementID
        case movementTitle
        case variationTitle
        case equipmentTitle
        case attachmentTitle
        case setupTitle
        case gripTitle
        case sideTitle
        case loadModeTitle
        case variationTags
        case categories
        case metric
        case primer
//        case type
        case primary
        case secondary
        case equipment
        case steps
        case tips
        case references
//        case png
    }
    
    // MARK: Decodable
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let uuid = try container.decode(UUID.self, forKey: .uuid)
        let id = try container.decode(Int.self, forKey: .id)
        let title = try container.decode(String.self, forKey: .title)
        let alias = try container.decodeIfPresent([String].self, forKey: .alias) ?? []
        let movementID = try container.decodeIfPresent(String.self, forKey: .movementID)
        let movementTitle = try container.decodeIfPresent(String.self, forKey: .movementTitle)
        let variationTitle = try container.decodeIfPresent(String.self, forKey: .variationTitle)
        let equipmentTitle = try container.decodeIfPresent(String.self, forKey: .equipmentTitle)
        let attachmentTitle = try container.decodeIfPresent(String.self, forKey: .attachmentTitle)
        let setupTitle = try container.decodeIfPresent(String.self, forKey: .setupTitle)
        let gripTitle = try container.decodeIfPresent(String.self, forKey: .gripTitle)
        let sideTitle = try container.decodeIfPresent(String.self, forKey: .sideTitle)
        let loadModeTitle = try container.decodeIfPresent(String.self, forKey: .loadModeTitle)
        let variationTags = try container.decodeIfPresent([String].self, forKey: .variationTags) ?? []
        let categories = try container.decodeIfPresent([ExerciseActivityCategory].self, forKey: .categories) ?? [.strength]
        let metric = try container.decodeIfPresent(ExerciseSetMetric.self, forKey: .metric) ?? .reps
        let primer = try container.decodeIfPresent(String.self, forKey: .primer)
        let primary = try container.decode([String].self, forKey: .primary)
        let secondary = try container.decode([String].self, forKey: .secondary)
        let equipment = try container.decode([String].self, forKey: .equipment)
        let steps = try container.decodeIfPresent([String].self, forKey: .steps) ?? []
        let tips = try container.decodeIfPresent([String].self, forKey: .tips) ?? []
        let references = try container.decodeIfPresent([String].self, forKey: .references) ?? []

        self.init(uuid: uuid, everkineticId: id, title: title, alias: alias, movementID: movementID, movementTitle: movementTitle, variationTitle: variationTitle, equipmentTitle: equipmentTitle, attachmentTitle: attachmentTitle, setupTitle: setupTitle, gripTitle: gripTitle, sideTitle: sideTitle, loadModeTitle: loadModeTitle, variationTags: variationTags, activityCategories: categories, defaultMetric: metric, description: primer, primaryMuscle: primary, secondaryMuscle: secondary, equipment: equipment, steps: steps, tips: tips, references: references)
    }
    
    // MARK: Encodalbe
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(uuid, forKey: .uuid)
        try container.encode(everkineticId, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(alias, forKey: .alias)
        try container.encode(movementID, forKey: .movementID)
        try container.encode(movementTitle, forKey: .movementTitle)
        try container.encodeIfPresent(variationTitle, forKey: .variationTitle)
        try container.encodeIfPresent(equipmentTitle, forKey: .equipmentTitle)
        try container.encodeIfPresent(attachmentTitle, forKey: .attachmentTitle)
        try container.encodeIfPresent(setupTitle, forKey: .setupTitle)
        try container.encodeIfPresent(gripTitle, forKey: .gripTitle)
        try container.encodeIfPresent(sideTitle, forKey: .sideTitle)
        try container.encodeIfPresent(loadModeTitle, forKey: .loadModeTitle)
        try container.encode(variationTags, forKey: .variationTags)
        try container.encode(activityCategories, forKey: .categories)
        try container.encode(defaultMetric, forKey: .metric)
        try container.encodeIfPresent(description, forKey: .primer)
        try container.encode(primaryMuscle, forKey: .primary)
        try container.encode(secondaryMuscle, forKey: .secondary)
        try container.encode(equipment, forKey: .equipment)
        try container.encode(steps, forKey: .steps)
        try container.encode(tips, forKey: .tips)
        try container.encode(references, forKey: .references)
    }
}
