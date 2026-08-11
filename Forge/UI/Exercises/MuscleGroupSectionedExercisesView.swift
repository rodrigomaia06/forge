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

struct ExerciseSourceRow: View {
    let exercise: Exercise

    var body: some View {
        HStack {
            Text(exercise.title)
                .foregroundColor(.forgeLabel)
            Spacer()
            Text(exercise.isCustom ? "Custom" : "Built in")
                .font(.forgeCaption)
                .foregroundColor(.forgeSecondaryLabel)
        }
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
