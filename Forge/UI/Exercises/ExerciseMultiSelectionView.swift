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
    @Binding var selection: Set<Exercise>
    @State private var expandedMovementIDs = Set<String>()
    
    var body: some View {
        List {
            ForEach(exerciseGroups) { exerciseGroup in
                Section(header: Text(exerciseGroup.title.capitalized)) {
                    if exerciseGroup.title == "Selected" {
                        ForEach(exerciseGroup.exercises, id: \.self) { exercise in
                            selectionRow(exercise: exercise, title: exercise.title)
                        }
                    } else {
                        ForEach(ExerciseStore.splitIntoMovements(exercises: exerciseGroup.exercises)) { movement in
                            if movement.variations.count == 1, let variation = movement.variations.first {
                                selectionRow(exercise: variation.exercise, title: variation.exercise.title)
                            } else {
                                DisclosureGroup(isExpanded: Binding(
                                    get: { expandedMovementIDs.contains(movement.id) },
                                    set: { isExpanded in
                                        if isExpanded {
                                            expandedMovementIDs.insert(movement.id)
                                        } else {
                                            expandedMovementIDs.remove(movement.id)
                                        }
                                    }
                                )) {
                                    ForEach(movement.variations) { variation in
                                        selectionRow(exercise: variation.exercise, title: variation.exercise.variationDisplayTitle)
                                    }
                                } label: {
                                    Text(movement.title)
                                }
                            }
                        }
                    }
                }
            }
        }
        .listStyleCompat_InsetGroupedListStyle()
    }

    private func selectionRow(exercise: Exercise, title: String) -> some View {
        Button {
            if selection.contains(exercise) {
                selection.remove(exercise)
            } else {
                selection.insert(exercise)
            }
        } label: {
            HStack(spacing: Theme.Spacing.m) {
                Image(systemName: selection.contains(exercise) ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(selection.contains(exercise) ? .forgeAccent : .forgeSecondaryLabel)
                    .accessibilityHidden(true)
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
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(exercise.title)
        .accessibilityValue(selection.contains(exercise) ? "Selected" : "Not selected")
    }
}

#if DEBUG
struct ExerciseMultiSelectionView_Previews: PreviewProvider {
    static var previews: some View {
        ExerciseMultiSelectionView(exerciseGroups: ExerciseStore.splitIntoMuscleGroups(exercises: ExerciseStore.shared.shownExercises), selection: .constant(Set()))
    }
}
#endif
