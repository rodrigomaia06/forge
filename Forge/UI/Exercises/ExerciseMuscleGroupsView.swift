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
    @EnvironmentObject var settingsStore: SettingsStore
    @EnvironmentObject var exerciseStore: ExerciseStore
    @FetchRequest(fetchRequest: WorkoutType.fetchRequestSorted(includeArchived: false)) private var workoutTypes

    // select the all exercises tab by default on iPad
    @State private var allExercisesSelected = UIDevice.current.userInterfaceIdiom == .pad ? true : false

    func exerciseGroupCell(_ exerciseGroup: ExerciseGroup, type: WorkoutType) -> some View {
        NavigationLink(destination:
            ExerciseBrowserGroupedListView(exercises: exerciseGroup.exercises, showsCategoryPicker: false)
                .navigationBarTitle(Text(exerciseGroup.title), displayMode: .inline)
        ) {
            HStack {
                Image(systemName: type.catalogSymbol)
                    .foregroundColor(Color(workoutTypeHex: type.displayColorHex))
                    .frame(width: 28)
                    .accessibilityHidden(true)
                HStack(spacing: Theme.Spacing.s) {
                    Text(exerciseGroup.title)
                    SourceSignalView(isAppProvided: type.isDefaultPreset)
                }
                Spacer()
                Text("(\(exerciseGroup.exercises.count))")
                    .foregroundColor(.secondary)
            }
        }
    }

    private var activityGroups: [ActivityExerciseGroup] {
        let types = Array(workoutTypes)
        let groups = ExerciseStore.splitIntoWorkoutTypeGroups(exercises: exerciseStore.shownExercises, workoutTypes: types)
        return zip(types, groups).map { ActivityExerciseGroup(type: $0, group: $1) }
    }
    
    var body: some View {
        List {
                Section {
                    NavigationLink(destination: ExerciseBrowserGroupedListView(exerciseGroups: activityGroups.map(\.group).filter { !$0.exercises.isEmpty })
                        .navigationBarTitle(Text("All exercises"), displayMode: .inline), isActive: $allExercisesSelected) {
                        HStack {
                            Image(systemName: "square.grid.2x2")
                                .foregroundColor(.secondary)
                                .frame(width: 28)
                                .accessibilityHidden(true)
                            Text("All")
                            Spacer()
                            Text("(\(exerciseStore.shownExercises.count))")
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Section {
                    ForEach(activityGroups) { item in
                        self.exerciseGroupCell(item.group, type: item.type)
                    }
                }

                Section {
                    NavigationLink(destination:
                        CustomExercisesView()
                            .navigationBarTitle(Text("Custom"), displayMode: .inline)
                    ) {
                        HStack {
                            Image(systemName: "person.badge.plus")
                                .foregroundColor(.secondary)
                                .frame(width: 28)
                                .accessibilityHidden(true)
                            Text("Custom")
                            Spacer()
                            Text("(\(exerciseStore.customExercises.count))")
                                .foregroundColor(.secondary)
                        }
                    }

                    if !exerciseStore.hiddenExercises.isEmpty {
                        NavigationLink(destination:
                            ExercisesView(exercises: exerciseStore.hiddenExercises)
                                .navigationBarTitle(Text("Hidden"), displayMode: .inline)
                        ) {
                            HStack {
                                Image(systemName: "eye.slash")
                                    .foregroundColor(.secondary)
                                    .frame(width: 28)
                                    .accessibilityHidden(true)
                                Text("Hidden")
                                Spacer()
                                Text("(\(exerciseStore.hiddenExercises.count))")
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        .listStyleCompat_InsetGroupedListStyle()
        .navigationBarTitle("Exercises")
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
