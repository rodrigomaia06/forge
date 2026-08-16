//
//  ExerciseMultiSelectionView.swift
//  Sunrise Fit
//
//  Created by Karim Abou Zeid on 20.07.19.
//  Copyright © 2019 Karim Abou Zeid Software. All rights reserved.
//

import SwiftUI
import WorkoutDataKit

struct ExerciseMultiSelectionView: View {
    var exerciseGroups: [ExerciseGroup]
    var showsExactResults = false
    @Binding var selection: Set<Exercise>

    private let compactRowInsets = EdgeInsets(
        top: Theme.Spacing.s,
        leading: Theme.Spacing.l,
        bottom: Theme.Spacing.s,
        trailing: Theme.Spacing.m
    )
    
    var body: some View {
        List {
            if exerciseGroups.isEmpty {
                ContentUnavailableView("No exercises found", systemImage: "magnifyingglass")
            } else {
                ForEach(exerciseGroups) { exerciseGroup in
                    Section(header: Text(exerciseGroup.title.capitalized)) {
                        if exerciseGroup.title == "Selected" || showsExactResults {
                            ForEach(exerciseGroup.exercises, id: \.self) { exercise in
                                exactSelectionRow(exercise: exercise)
                            }
                        } else {
                            ForEach(ExerciseStore.splitIntoMovements(exercises: exerciseGroup.exercises)) { movement in
                                movementRow(movement)
                            }
                        }
                    }
                }
            }
        }
        .listStyleCompat_InsetGroupedListStyle()
        .environment(\.defaultMinListRowHeight, 54)
    }

    private func movementRow(_ movement: ExerciseMovement) -> some View {
        if movement.variations.count == 1, let variation = movement.variations.first {
            return AnyView(
                Button {
                    toggle(variation.exercise)
                } label: {
                    movementRowContent(
                        title: movement.title,
                        subtitle: variation.exercise.browsingVariationTitle == variation.exercise.movementTitle ? nil : variation.exercise.browsingVariationTitle,
                        selectedCount: selection.contains(variation.exercise) ? 1 : 0,
                        showsDisclosure: false
                    )
                }
                .buttonStyle(.plain)
                .listRowInsets(compactRowInsets)
                .accessibilityLabel(movement.title)
                .accessibilityValue(selection.contains(variation.exercise) ? "Selected" : "Not selected")
            )
        }

        let selectedCount = movement.variations.filter { selection.contains($0.exercise) }.count
        return AnyView(
            NavigationLink {
                ExerciseMovementSelectionView(movement: movement, selection: $selection)
            } label: {
                movementRowContent(
                    title: movement.title,
                    subtitle: movementSubtitle(movement, selectedCount: selectedCount),
                    selectedCount: selectedCount,
                    showsDisclosure: true
                )
            }
            .listRowInsets(compactRowInsets)
        )
    }

    private func movementSubtitle(_ movement: ExerciseMovement, selectedCount: Int) -> String {
        let count = movement.variations.count
        let base = count == 1 ? "1 variation" : "\(count) variations"
        guard selectedCount > 0 else { return base }
        return "\(base) · \(selectedCount) selected"
    }

    private func movementRowContent(title: String, subtitle: String?, selectedCount: Int, showsDisclosure: Bool) -> some View {
        HStack(spacing: Theme.Spacing.m) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.forgeHeadline)
                    .foregroundColor(.forgeLabel)
                if let subtitle {
                    Text(subtitle)
                        .font(.forgeCaption)
                        .foregroundColor(.forgeSecondaryLabel)
                }
            }
            Spacer()
            if selectedCount > 0 {
                Image(systemName: "checkmark.circle.fill")
                    .font(.body)
                    .foregroundColor(.forgeAccent)
                    .accessibilityHidden(true)
            }
            if showsDisclosure {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .foregroundColor(.forgeSecondaryLabel)
                    .accessibilityHidden(true)
            } else if !showsDisclosure {
                Image(systemName: "plus.circle")
                    .font(.body)
                    .foregroundColor(.forgeSecondaryLabel)
                    .accessibilityHidden(true)
            }
        }
        .contentShape(Rectangle())
    }

    private func exactSelectionRow(exercise: Exercise) -> some View {
        Button {
            toggle(exercise)
        } label: {
            HStack(spacing: Theme.Spacing.m) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(exercise.browsingExerciseTitle)
                        .font(.forgeHeadline)
                        .foregroundColor(.forgeLabel)
                }
                Spacer()
                Image(systemName: selection.contains(exercise) ? "checkmark.circle.fill" : "plus.circle")
                    .font(.body)
                    .foregroundColor(selection.contains(exercise) ? .forgeAccent : .forgeSecondaryLabel)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(compactRowInsets)
        .accessibilityLabel(exercise.title)
        .accessibilityValue(selection.contains(exercise) ? "Selected" : "Not selected")
    }

    private func toggle(_ exercise: Exercise) {
        Haptics.selection()
        var transaction = Transaction()
        transaction.animation = nil
        withTransaction(transaction) {
            if selection.contains(exercise) {
                selection.remove(exercise)
            } else {
                selection.insert(exercise)
            }
        }
    }
}

extension Exercise {
    func compactVariationTitle(omittingEquipment equipmentTitleToOmit: String? = nil) -> String {
        let omittedEquipment = equipmentTitleToOmit?.normalizedExerciseFilterToken
        let fields = variationDisplayFields.compactMap { field -> String? in
            if field.label == "Equipment", field.value.normalizedExerciseFilterToken == omittedEquipment {
                return nil
            }
            return field.value
        }
        if !fields.isEmpty {
            return fields.joined(separator: ", ")
        }

        if let variationTitle = variationTitle?.trimmingCharacters(in: .whitespacesAndNewlines),
           !variationTitle.isEmpty,
           variationTitle.localizedCaseInsensitiveCompare(movementTitle) != .orderedSame {
            if let equipmentTitleToOmit,
               variationTitle.normalizedExerciseFilterToken == equipmentTitleToOmit.normalizedExerciseFilterToken {
                return "Standard"
            }
            return variationTitle
        }

        if let equipmentTitle,
           equipmentTitle.normalizedExerciseFilterToken != omittedEquipment,
           !equipmentTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return equipmentTitle
        }

        return "Standard"
    }
}

private struct ExerciseMovementSelectionView: View {
    let movement: ExerciseMovement
    @Binding var selection: Set<Exercise>

    private let compactRowInsets = EdgeInsets(
        top: Theme.Spacing.s,
        leading: Theme.Spacing.l,
        bottom: Theme.Spacing.s,
        trailing: Theme.Spacing.m
    )

    var body: some View {
        List {
            ForEach(ExerciseStore.splitIntoEquipmentGroups(variations: movement.variations)) { group in
                Section(header: Text(group.title)) {
                    ForEach(group.exercises, id: \.self) { exercise in
                        variationRow(exercise, equipmentTitle: group.title)
                    }
                }
            }
        }
        .listStyleCompat_InsetGroupedListStyle()
        .environment(\.defaultMinListRowHeight, 54)
        .navigationTitle(movement.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func variationRow(_ exercise: Exercise, equipmentTitle: String) -> some View {
        Button {
            toggle(exercise)
        } label: {
            HStack(spacing: Theme.Spacing.m) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(exercise.compactVariationTitle(omittingEquipment: equipmentTitle))
                        .font(.forgeHeadline)
                        .foregroundColor(.forgeLabel)
                }
                Spacer()
                Image(systemName: selection.contains(exercise) ? "checkmark.circle.fill" : "plus.circle")
                    .font(.body)
                    .foregroundColor(selection.contains(exercise) ? .forgeAccent : .forgeSecondaryLabel)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(compactRowInsets)
        .accessibilityLabel(exercise.title)
        .accessibilityValue(selection.contains(exercise) ? "Selected" : "Not selected")
    }

    private func toggle(_ exercise: Exercise) {
        Haptics.selection()
        var transaction = Transaction()
        transaction.animation = nil
        withTransaction(transaction) {
            if selection.contains(exercise) {
                selection.remove(exercise)
            } else {
                selection.insert(exercise)
            }
        }
    }
}

#if DEBUG
struct ExerciseMultiSelectionView_Previews: PreviewProvider {
    static var previews: some View {
        ExerciseMultiSelectionView(exerciseGroups: ExerciseStore.splitIntoMuscleGroups(exercises: ExerciseStore.shared.shownExercises), selection: .constant(Set()))
    }
}
#endif
