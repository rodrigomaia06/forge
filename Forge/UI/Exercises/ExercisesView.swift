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
                    ForEach(ExerciseStore.splitIntoMovements(exercises: filteredExercises)) { movement in
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
