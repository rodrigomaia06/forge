//
//  ExerciseCategoryView.swift
//  Sunrise Fit
//
//  Created by Karim Abou Zeid on 04.07.19.
//  Copyright © 2019 Karim Abou Zeid Software. All rights reserved.
//

import SwiftUI
import CoreData
import WorkoutDataKit

struct ExerciseMuscleGroupsView : View {
    @EnvironmentObject var exerciseStore: ExerciseStore
    @FetchRequest(fetchRequest: WorkoutType.fetchRequestSorted(includeArchived: false)) private var workoutTypes
    
    private var activityGroups: [ActivityExerciseGroup] {
        let types = Array(workoutTypes)
        let groups = ExerciseStore.splitIntoWorkoutTypeGroups(exercises: exerciseStore.shownExercises, workoutTypes: types)
        return zip(types, groups).map { ActivityExerciseGroup(type: $0, group: $1) }
    }
    
    var body: some View {
        List {
            Section {
                catalogRow(
                    title: "All",
                    count: exerciseStore.shownExercises.count,
                    systemImage: "square.grid.2x2",
                    tint: .forgeSecondaryLabel,
                    destination: ExerciseBrowserGroupedListView(
                        exerciseGroups: activityGroups.map(\.group).filter { !$0.exercises.isEmpty }
                    )
                )
            }

            Section("Workout types") {
                ForEach(activityGroups) { item in
                    catalogRow(
                        title: item.group.title,
                        count: item.group.exercises.count,
                        systemImage: item.type.catalogSymbol,
                        tint: Color(workoutTypeHex: item.type.displayColorHex),
                        destination: ExerciseBrowserGroupedListView(
                            exercises: item.group.exercises,
                            showsCategoryPicker: false
                        )
                    )
                }
            }

            Section("My exercises") {
                catalogRow(
                    title: "Custom",
                    count: exerciseStore.customExercises.count,
                    systemImage: "person.badge.plus",
                    tint: .forgeSecondaryLabel,
                    destination: CustomExercisesView()
                )

                if !exerciseStore.hiddenExercises.isEmpty {
                    catalogRow(
                        title: "Hidden",
                        count: exerciseStore.hiddenExercises.count,
                        systemImage: "eye.slash",
                        tint: .forgeSecondaryLabel,
                        destination: ExercisesView(exercises: exerciseStore.hiddenExercises)
                    )
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Color.forgeBackground.ignoresSafeArea())
        .navigationTitle("Exercises")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func catalogRow<Destination: View>(
        title: String,
        count: Int,
        systemImage: String,
        tint: Color,
        destination: Destination
    ) -> some View {
        NavigationLink(destination: destination) {
            HStack(spacing: Theme.Spacing.m) {
                Image(systemName: systemImage)
                    .font(.body.weight(.semibold))
                    .foregroundColor(tint)
                    .frame(width: 28)
                    .accessibilityHidden(true)

                Text(title)
                    .foregroundColor(.forgeLabel)

                Spacer(minLength: Theme.Spacing.s)

                Text("\(count)")
                    .font(.forgeValue)
                    .foregroundColor(.forgeSecondaryLabel)
            }
            .frame(minHeight: Theme.Layout.minTapTarget)
            .contentShape(Rectangle())
        }
        .accessibilityLabel("\(title), \(count) exercises")
    }
}

private struct ActivityExerciseGroup: Identifiable {
    let type: WorkoutType
    let group: ExerciseGroup

    var id: NSManagedObjectID { type.objectID }
}

private extension WorkoutType {
    var catalogSymbol: String {
        switch displayTitle.lowercased() {
        case "strength": return "dumbbell"
        case "court sports": return "figure.tennis"
        case "martial arts": return "figure.martial.arts"
        case "cardio": return "figure.run"
        case "mobility": return "figure.cooldown"
        default: return "square.grid.2x2"
        }
    }
}

#if DEBUG
struct ExerciseCategoryView_Previews : PreviewProvider {
    static var previews: some View {
        ExerciseMuscleGroupsView()
            .mockEnvironment(weightUnit: .metric)
    }
}
#endif
