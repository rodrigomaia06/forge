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
    
    var body: some View {
        Group {
            if exerciseGroups.isEmpty {
                ContentUnavailableView("No exercises found", systemImage: "magnifyingglass")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(exerciseGroups) { exerciseGroup in
                        Section(header: Text(exerciseGroup.title.capitalized)) {
                            ForEach(exerciseGroup.exercises) { exercise in
                                NavigationLink(destination: ExerciseDetailView(exercise: exercise)) {
                                    ExerciseSourceRow(exercise: exercise)
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

    var body: some View {
        HStack(spacing: Theme.Spacing.s) {
            Text(exercise.title)
                .foregroundColor(.forgeLabel)
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
