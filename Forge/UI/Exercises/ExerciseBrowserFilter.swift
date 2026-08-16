//
//  ExerciseBrowserFilter.swift
//  Forge
//

import SwiftUI
import WorkoutDataKit

struct ExerciseBrowserFilter: Equatable {
    var search = ""
    var equipment: String?
    var bodyPart: String?
    var category: ExerciseActivityCategory?

    var filtersActive: Bool {
        equipment != nil || bodyPart != nil || category != nil
    }

    var isActive: Bool {
        !search.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || filtersActive
    }

    mutating func clearFilters() {
        equipment = nil
        bodyPart = nil
        category = nil
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
        if let equipment {
            result = result.filter { exercise in
                exercise.equipment.contains { $0.localizedCaseInsensitiveContains(equipment) }
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
        let tokens = Set(exercises.flatMap(\.equipment))
        let preferred = [
            ("Barbell", "barbell"),
            ("Dumbbell", "dumbbell"),
            ("Cable", "cable"),
            ("Machine", "machine"),
            ("Kettlebell", "kettlebell"),
            ("Bodyweight", "body"),
        ]
        var seen = Set<String>()
        var options: [(label: String, token: String)] = []
        for option in preferred where tokens.contains(where: { $0.localizedCaseInsensitiveContains(option.token) }) {
            options.append(option)
            seen.insert(option.token)
        }
        let remaining = tokens
            .filter { token in
                !seen.contains(where: { token.localizedCaseInsensitiveContains($0) })
            }
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
            .map { (label: $0.replacingOccurrences(of: "-", with: " ").capitalized, token: $0) }
        return options + remaining
    }
}

struct ExerciseBrowserFilterControls: View {
    @Binding var filter: ExerciseBrowserFilter
    let exercises: [Exercise]
    var showsCategoryPicker = true

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
                filterMenu
            }
            .padding(.horizontal, Theme.Spacing.l)
            .padding(.vertical, Theme.Spacing.s)

            if showsCategoryPicker {
                categoryPicker
            }
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
                .background(Capsule().fill(filter.category == option ? Color.forgeLabel : Color.forgeSurface))
        }
        .buttonStyle(.plain)
    }

    private var filterMenu: some View {
        Menu {
            Picker("Equipment", selection: $filter.equipment) {
                Text("Any equipment").tag(String?.none)
                ForEach(equipmentOptions, id: \.token) { option in
                    Text(option.label).tag(String?.some(option.token))
                }
            }
            Picker("Body part", selection: $filter.bodyPart) {
                Text("Any body part").tag(String?.none)
                ForEach(bodyPartOptions, id: \.self) { part in
                    Text(part.capitalized).tag(String?.some(part))
                }
            }
            if filter.filtersActive {
                Button(role: .destructive) { filter.clearFilters() } label: {
                    Label("Clear filters", systemImage: "xmark.circle")
                }
            }
        } label: {
            Image(systemName: filter.filtersActive ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .accessibilityLabel("Filter exercises")
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
