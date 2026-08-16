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
            Haptics.selection()
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
            Haptics.selection()
            showingFilters = true
        } label: {
            Image(systemName: filter.filtersActive ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                .frame(width: 44, height: 44)
                .overlay(alignment: .topTrailing) {
                    if filter.activeFilterCount > 0 {
                        Text("\(filter.activeFilterCount)")
                            .font(.caption2.weight(.bold))
                            .foregroundColor(.forgeBackground)
                            .frame(minWidth: 16, minHeight: 16)
                            .background(Circle().fill(Color.forgeAccent))
                            .accessibilityHidden(true)
                    }
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Filter exercises")
        .accessibilityValue(filter.activeFilterCount > 0 ? "\(filter.activeFilterCount) active" : "No active filters")
    }
}

private struct ExerciseBrowserFilterSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var filter: ExerciseBrowserFilter
    let equipmentOptions: [(label: String, token: String)]
    let bodyPartOptions: [String]
    let showsCategoryPicker: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if showsCategoryPicker {
                        Picker("Workout type", selection: categorySelection) {
                            Text("Any type").tag("")
                            ForEach(ExerciseActivityCategory.allCases, id: \.self) { category in
                                Text(category.title).tag(category.rawValue)
                            }
                        }
                        .pickerStyle(.menu)
                    }

                    Picker("Source", selection: sourceSelection) {
                        Text("All sources").tag("")
                        ForEach(ExerciseBrowserFilter.Source.allCases, id: \.self) { source in
                            Text(source.title).tag(source.rawValue)
                        }
                    }
                    .pickerStyle(.menu)

                    Picker("Equipment", selection: equipmentSelection) {
                        Text("Any equipment").tag("")
                        ForEach(equipmentOptions, id: \.token) { option in
                            Text(option.label).tag(option.token)
                        }
                    }
                    .pickerStyle(.menu)

                    Picker("Body part", selection: bodyPartSelection) {
                        Text("Any body part").tag("")
                        ForEach(bodyPartOptions, id: \.self) { part in
                            Text(part.capitalized).tag(part)
                        }
                    }
                    .pickerStyle(.menu)
                } footer: {
                    Text("Search still checks exercise names, movement names, variations, equipment, and setup tags.")
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Clear") { filter.clearFilters() }
                        .disabled(!filter.filtersActive)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private var categorySelection: Binding<String> {
        Binding {
            filter.category?.rawValue ?? ""
        } set: { value in
            Haptics.selection()
            filter.category = value.isEmpty ? nil : ExerciseActivityCategory(rawValue: value)
        }
    }

    private var sourceSelection: Binding<String> {
        Binding {
            filter.source?.rawValue ?? ""
        } set: { value in
            Haptics.selection()
            filter.source = value.isEmpty ? nil : ExerciseBrowserFilter.Source(rawValue: value)
        }
    }

    private var equipmentSelection: Binding<String> {
        Binding {
            filter.equipment ?? ""
        } set: { value in
            Haptics.selection()
            filter.equipment = value.isEmpty ? nil : value
        }
    }

    private var bodyPartSelection: Binding<String> {
        Binding {
            filter.bodyPart ?? ""
        } set: { value in
            Haptics.selection()
            filter.bodyPart = value.isEmpty ? nil : value
        }
    }
}

private extension ExerciseBrowserFilter {
    var activeFilterCount: Int {
        [equipment, bodyPart, category?.rawValue, source?.rawValue]
            .filter { value in
                guard let value else { return false }
                return !value.isEmpty
            }
            .count
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
