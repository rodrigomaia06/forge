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
    
    var body: some View {
        List {
            ForEach(exerciseGroups) { exerciseGroup in
                Section(header: Text(exerciseGroup.title.capitalized)) {
                    if exerciseGroup.title == "Selected" || showsExactResults {
                        ForEach(exerciseGroup.exercises, id: \.self) { exercise in
                            exactSelectionRow(exercise: exercise, title: exercise.variationSummaryTitle)
                        }
                    } else {
                        ForEach(ExerciseStore.splitIntoMovements(exercises: exerciseGroup.exercises)) { movement in
                            movementRow(movement)
                        }
                    }
                }
            }
        }
        .listStyleCompat_InsetGroupedListStyle()
    }

    private func movementRow(_ movement: ExerciseMovement) -> some View {
        if movement.variations.count == 1, let variation = movement.variations.first {
            return AnyView(
                Button {
                    toggle(variation.exercise)
                } label: {
                    movementRowContent(
                        title: movement.title,
                        subtitle: variation.exercise.variationSummaryTitle == variation.exercise.title ? nil : variation.exercise.variationSummaryTitle,
                        selectedCount: selection.contains(variation.exercise) ? 1 : 0,
                        showsDisclosure: false
                    )
                }
                .buttonStyle(.plain)
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
                    .foregroundColor(.forgeAccent)
                    .accessibilityHidden(true)
            } else if showsDisclosure {
                Image(systemName: "chevron.right")
                    .foregroundColor(.forgeSecondaryLabel)
                    .accessibilityHidden(true)
            } else {
                Image(systemName: "plus.circle")
                    .foregroundColor(.forgeSecondaryLabel)
                    .accessibilityHidden(true)
            }
        }
        .contentShape(Rectangle())
    }

    private func exactSelectionRow(exercise: Exercise, title: String) -> some View {
        Button {
            toggle(exercise)
        } label: {
            HStack(spacing: Theme.Spacing.m) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .foregroundColor(.forgeLabel)
                    if title != exercise.title {
                        Text(exercise.title)
                            .font(.forgeCaption)
                            .foregroundColor(.forgeSecondaryLabel)
                    }
                }
                Spacer()
                Image(systemName: selection.contains(exercise) ? "checkmark.circle.fill" : "plus.circle")
                    .foregroundColor(selection.contains(exercise) ? .forgeAccent : .forgeSecondaryLabel)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(exercise.title)
        .accessibilityValue(selection.contains(exercise) ? "Selected" : "Not selected")
    }

    private func toggle(_ exercise: Exercise) {
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

private struct ExerciseMovementSelectionView: View {
    let movement: ExerciseMovement
    @Binding var selection: Set<Exercise>

    var body: some View {
        List {
            Section {
                ForEach(movement.variations) { variation in
                    variationRow(variation.exercise)
                }
            }
        }
        .listStyleCompat_InsetGroupedListStyle()
        .navigationTitle(movement.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func variationRow(_ exercise: Exercise) -> some View {
        Button {
            toggle(exercise)
        } label: {
            HStack(spacing: Theme.Spacing.m) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(exercise.variationSummaryTitle)
                        .foregroundColor(.forgeLabel)
                    if exercise.variationSummaryTitle != exercise.title {
                        Text(exercise.title)
                            .font(.forgeCaption)
                            .foregroundColor(.forgeSecondaryLabel)
                    }
                }
                Spacer()
                Image(systemName: selection.contains(exercise) ? "checkmark.circle.fill" : "plus.circle")
                    .foregroundColor(selection.contains(exercise) ? .forgeAccent : .forgeSecondaryLabel)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(exercise.title)
        .accessibilityValue(selection.contains(exercise) ? "Selected" : "Not selected")
    }

    private func toggle(_ exercise: Exercise) {
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
