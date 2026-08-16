//
//  MuscleGroupSectionedExercisesView.swift
//  Sunrise Fit
//
//  Created by Karim Abou Zeid on 04.07.19.
//  Copyright © 2019 Karim Abou Zeid Software. All rights reserved.
//

import SwiftUI
import WorkoutDataKit

struct MuscleGroupSectionedExercisesView : View {
    var exerciseGroups: [ExerciseGroup]
    @State private var expandedMovementIDs = Set<String>()
    
    var body: some View {
        Group {
            if exerciseGroups.isEmpty {
                ContentUnavailableView("No exercises found", systemImage: "magnifyingglass")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(exerciseGroups) { exerciseGroup in
                        Section(header: Text(exerciseGroup.title.capitalized)) {
                            ForEach(ExerciseStore.splitIntoMovements(exercises: exerciseGroup.exercises)) { movement in
                                if movement.variations.count == 1, let variation = movement.variations.first {
                                    NavigationLink(destination: ExerciseDetailView(exercise: variation.exercise)) {
                                        ExerciseSourceRow(exercise: variation.exercise)
                                    }
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
                                            NavigationLink(destination: ExerciseDetailView(exercise: variation.exercise)) {
                                                ExerciseSourceRow(exercise: variation.exercise, title: variation.exercise.variationDisplayTitle)
                                            }
                                        }
                                    } label: {
                                        Text(movement.title)
                                    }
                                }
                            }
                        }
                    }
                }
                .listStyleCompat_InsetGroupedListStyle()
            }
        }
    }
}

struct ExerciseSourceRow: View {
    let exercise: Exercise
    var title: String? = nil

    var body: some View {
        HStack(spacing: Theme.Spacing.s) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title ?? exercise.title)
                    .foregroundColor(.forgeLabel)
                if let title, title != exercise.title {
                    Text(exercise.title)
                        .font(.forgeCaption)
                        .foregroundColor(.forgeSecondaryLabel)
                }
            }
            Spacer()
            SourceSignalView(isAppProvided: !exercise.isCustom)
        }
    }
}

struct SourceSignalView: View {
    let isAppProvided: Bool

    var body: some View {
        Image(systemName: isAppProvided ? "checkmark.seal" : "pencil")
            .font(.forgeCaption)
            .foregroundColor(.forgeSecondaryLabel)
            .accessibilityLabel(isAppProvided ? "Provided by Forge" : "Created by you")
    }
}

#if DEBUG
struct MuscleGroupSectionedExercisesView_Previews : PreviewProvider {
    static var previews: some View {
        NavigationStack {
            MuscleGroupSectionedExercisesView(exerciseGroups: ExerciseStore.splitIntoMuscleGroups(exercises: ExerciseStore.shared.shownExercises))
                .mockEnvironment(weightUnit: .metric)
        }
    }
}
#endif
