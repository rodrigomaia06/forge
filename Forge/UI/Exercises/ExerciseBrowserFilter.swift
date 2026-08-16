//
//  ExerciseBrowserFilter.swift
//  Forge
//

import SwiftUI
import WorkoutDataKit

struct ExerciseBrowserFilter: Equatable {
    enum Source: String, CaseIterable {
        case native
        case custom

        var title: String {
            switch self {
            case .native: return "Native"
            case .custom: return "Custom"
            }
        }
    }

    var search = ""
    var equipment: String?
    var bodyPart: String?
    var category: ExerciseActivityCategory?
    var source: Source?

    var filtersActive: Bool {
        equipment != nil || bodyPart != nil || category != nil || source != nil
    }

    var isActive: Bool {
        !search.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || filtersActive
    }

    mutating func clearFilters() {
        equipment = nil
        bodyPart = nil
        category = nil
        source = nil
    }

    mutating func reset() {
        search = ""
        clearFilters()
    }

    func filteredExercises(from exercises: [Exercise]) -> [Exercise] {
        var result = exercises
        if let category {
            result = result.filter { $0.activityCategories.contains(category) }
        }
        if let source {
            result = result.filter { exercise in
                switch source {
                case .native: return !exercise.isCustom
                case .custom: return exercise.isCustom
                }
            }
        }
        if let equipment {
            result = result.filter { exercise in
                exercise.variationTags.contains(equipment.normalizedExerciseFilterToken)
                    || exercise.equipmentTitle?.normalizedExerciseFilterToken == equipment.normalizedExerciseFilterToken
                    || exercise.equipment.contains { $0.localizedCaseInsensitiveContains(equipment) }
            }
        }
        if let bodyPart {
            result = result.filter { $0.muscleGroup == bodyPart }
        }
        if !search.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            result = ExerciseStore.filter(exercises: result, using: search)
        }
        return result
    }

    func filteredGroups(_ groups: [ExerciseGroup]) -> [ExerciseGroup] {
        groups
            .map { group in
                ExerciseGroup(title: group.title, exercises: filteredExercises(from: group.exercises))
            }
            .filter { !$0.exercises.isEmpty }
    }

    static func bodyPartOptions(from exercises: [Exercise]) -> [String] {
        Array(Set(exercises.map(\.muscleGroup))).sorted()
    }

    static func equipmentOptions(from exercises: [Exercise]) -> [(label: String, token: String)] {
        let preferred: [(label: String, token: String)] = [
            ("Barbell", "barbell"),
            ("Dumbbell", "dumbbell"),
            ("Cable", "cable"),
            ("Machine", "machine"),
            ("Smith machine", "smith_machine"),
            ("EZ curl bar", "ez_curl_bar"),
            ("Kettlebell", "kettlebell"),
            ("Bodyweight", "bodyweight"),
        ]
        return preferred.filter { option in
            exercises.contains { exercise in
                exercise.variationTags.contains(option.token)
                    || exercise.equipmentTitle?.normalizedExerciseFilterToken == option.token
                    || exercise.equipment.contains {
                        $0.normalizedExerciseFilterToken == option.token
                            || (option.token == "bodyweight" && $0 == "body")
                    }
            }
        }
    }
}

extension String {
    var normalizedExerciseFilterToken: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "-", with: "_")
            .replacingOccurrences(of: " ", with: "_")
    }
}

struct ExerciseBrowserFilterControls: View {
    @Binding var filter: ExerciseBrowserFilter
    let exercises: [Exercise]
    var showsCategoryPicker = true
    var showsCategoryChips = true
    @State private var showingFilters = false

    private var bodyPartOptions: [String] {
        ExerciseBrowserFilter.bodyPartOptions(from: exercises)
    }

    private var equipmentOptions: [(label: String, token: String)] {
        ExerciseBrowserFilter.equipmentOptions(from: exercises)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: Theme.Spacing.s) {
                TextField("Search", text: $filter.search)
                    .textFieldStyle(SearchTextFieldStyle(text: $filter.search))
                filterButton
            }
            .padding(.horizontal, Theme.Spacing.l)
            .padding(.vertical, Theme.Spacing.s)

            if showsCategoryPicker && showsCategoryChips {
                categoryPicker
            }
        }
        .sheet(isPresented: $showingFilters) {
            ExerciseBrowserFilterSheet(
                filter: $filter,
                equipmentOptions: equipmentOptions,
                bodyPartOptions: bodyPartOptions,
                showsCategoryPicker: showsCategoryPicker
            )
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
        }
    }

    private var categoryPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s) {
                categoryButton(nil)
                ForEach(ExerciseActivityCategory.allCases, id: \.self) { option in
                    categoryButton(option)
                }
            }
            .padding(.horizontal, Theme.Spacing.l)
        }
        .padding(.bottom, Theme.Spacing.s)
    }

    private func categoryButton(_ option: ExerciseActivityCategory?) -> some View {
        Button {
            filter.category = option
        } label: {
            Text(option?.title ?? "All")
                .font(.forgeCaption.weight(.semibold))
                .foregroundColor(filter.category == option ? .forgeBackground : .forgeLabel)
                .padding(.horizontal, Theme.Spacing.m)
                .frame(minHeight: 34)
                .background(Capsule().fill(categoryBackgroundColor(option)))
        }
        .buttonStyle(.plain)
    }

    private func categoryBackgroundColor(_ option: ExerciseActivityCategory?) -> Color {
        guard filter.category == option else { return .forgeSurface }
        return option?.color ?? .forgeLabel
    }

    private var filterButton: some View {
        Button {
            showingFilters = true
        } label: {
            Image(systemName: filter.filtersActive ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Filter exercises")
    }
}

private struct ExerciseBrowserFilterSheet: View {
    @Binding var filter: ExerciseBrowserFilter
    let equipmentOptions: [(label: String, token: String)]
    let bodyPartOptions: [String]
    let showsCategoryPicker: Bool

    var body: some View {
        NavigationStack {
            Form {
                if showsCategoryPicker {
                    Section("Workout type") {
                        filterOption("Any type", isSelected: filter.category == nil) {
                            filter.category = nil
                        }
                        ForEach(ExerciseActivityCategory.allCases, id: \.self) { category in
                            filterOption(category.title, color: category.color, isSelected: filter.category == category) {
                                filter.category = category
                            }
                        }
                    }
                }

                Section("Source") {
                    filterOption("All sources", isSelected: filter.source == nil) {
                        filter.source = nil
                    }
                    ForEach(ExerciseBrowserFilter.Source.allCases, id: \.self) { source in
                        filterOption(source.title, isSelected: filter.source == source) {
                            filter.source = source
                        }
                    }
                }

                Section("Equipment") {
                    filterOption("Any equipment", isSelected: filter.equipment == nil) {
                        filter.equipment = nil
                    }
                    ForEach(equipmentOptions, id: \.token) { option in
                        filterOption(option.label, isSelected: filter.equipment == option.token) {
                            filter.equipment = option.token
                        }
                    }
                }

                Section("Body part") {
                    filterOption("Any body part", isSelected: filter.bodyPart == nil) {
                        filter.bodyPart = nil
                    }
                    ForEach(bodyPartOptions, id: \.self) { part in
                        filterOption(part.capitalized, isSelected: filter.bodyPart == part) {
                            filter.bodyPart = part
                        }
                    }
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Clear") { filter.clearFilters() }
                        .disabled(!filter.filtersActive)
                }
            }
        }
    }

    private func filterOption(_ title: String, color: Color? = nil, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.m) {
                if let color {
                    Circle()
                        .fill(color)
                        .frame(width: 12, height: 12)
                        .accessibilityHidden(true)
                }
                Text(title)
                    .foregroundColor(.forgeLabel)
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark")
                        .foregroundColor(color ?? .forgeAccent)
                        .accessibilityLabel("Selected")
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

extension ExerciseActivityCategory {
    var color: Color {
        switch self {
        case .strength: return Color(workoutTypeHex: "#7C8CF8")
        case .courtSports: return Color(workoutTypeHex: "#6BD48F")
        case .martialArts: return Color(workoutTypeHex: "#F27D7D")
        case .cardio: return Color(workoutTypeHex: "#F4A261")
        case .mobility: return Color(workoutTypeHex: "#B78AF0")
        case .other: return Color(workoutTypeHex: "#9CA3AF")
        }
    }
}

struct ExerciseBrowserGroupedListView: View {
    let exercises: [Exercise]
    let groups: [ExerciseGroup]?
    var showsCategoryPicker = true

    @State private var filter = ExerciseBrowserFilter()

    init(exercises: [Exercise], showsCategoryPicker: Bool = true) {
        self.exercises = exercises
        self.groups = nil
        self.showsCategoryPicker = showsCategoryPicker
    }

    init(exerciseGroups: [ExerciseGroup], showsCategoryPicker: Bool = true) {
        self.exercises = exerciseGroups.flatMap(\.exercises)
        self.groups = exerciseGroups
        self.showsCategoryPicker = showsCategoryPicker
    }

    private var filteredGroups: [ExerciseGroup] {
        if let groups {
            return filter.filteredGroups(groups)
        }
        return ExerciseStore.splitIntoMuscleGroups(exercises: filter.filteredExercises(from: exercises))
    }

    var body: some View {
        VStack(spacing: 0) {
            ExerciseBrowserFilterControls(filter: $filter, exercises: exercises, showsCategoryPicker: showsCategoryPicker)
            Divider()
            MuscleGroupSectionedExercisesView(exerciseGroups: filteredGroups)
        }
    }
}
