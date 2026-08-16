//
//  ExercisesView.swift
//  Sunrise Fit
//
//  Created by Karim Abou Zeid on 04.07.19.
//  Copyright © 2019 Karim Abou Zeid Software. All rights reserved.
//

import SwiftUI
import WorkoutDataKit

struct ExercisesView : View {
    var exercises: [Exercise]
    @State private var filter = ExerciseBrowserFilter()
    @State private var expandedMovementIDs = Set<String>()
    @State private var expandedEquipmentGroupIDs = Set<String>()

    private var filteredExercises: [Exercise] {
        filter.filteredExercises(from: exercises)
    }
    
    var body: some View {
        VStack(spacing: 0) {
            ExerciseBrowserFilterControls(filter: $filter, exercises: exercises)
            Divider()
            if filteredExercises.isEmpty {
                ContentUnavailableView("No exercises found", systemImage: "magnifyingglass")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ExerciseMovementRows(
                        movements: ExerciseStore.splitIntoMovements(exercises: filteredExercises),
                        expandedMovementIDs: $expandedMovementIDs,
                        expandedEquipmentGroupIDs: $expandedEquipmentGroupIDs
                    ) { exercise, title in
                        NavigationLink(destination: ExerciseDetailView(exercise: exercise)) {
                            if title == exercise.title {
                                ExerciseSourceRow(exercise: exercise)
                            } else {
                                ExerciseSourceRow(exercise: exercise, title: title)
                            }
                        }
                    }
                }
                .listStyleCompat_InsetGroupedListStyle()
            }
        }
    }
}

#if DEBUG
struct ExercisesView_Previews : PreviewProvider {
    static var previews: some View {
        NavigationStack {
            ExercisesView(exercises: ExerciseStore.shared.shownExercises)
                .mockEnvironment(weightUnit: .metric)
        }
    }
}
#endif
