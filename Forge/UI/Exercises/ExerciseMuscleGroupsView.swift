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
            ActivityExerciseListView(exercises: exerciseGroup.exercises)
                .navigationBarTitle(Text(exerciseGroup.title), displayMode: .inline)
        ) {
            HStack {
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
                    NavigationLink(destination: AllExercisesView(exerciseGroups: activityGroups.map(\.group).filter { !$0.exercises.isEmpty }), isActive: $allExercisesSelected) {
                        HStack {
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

private struct AllExercisesView: View {
    @ObservedObject private var filter: ExerciseGroupFilter
    
    init(exerciseGroups: [ExerciseGroup]) {
        self.filter = ExerciseGroupFilter(exerciseGroups: exerciseGroups)
    }
    
    var body: some View {
        VStack(spacing: 0) {
            TextField("Search", text: $filter.filter)
                .textFieldStyle(SearchTextFieldStyle(text: $filter.filter))
                .padding()
            
            Divider()
            
            MuscleGroupSectionedExercisesView(exerciseGroups: filter.exerciseGroups)
        }
        .navigationBarTitle(Text("All exercises"), displayMode: .inline)
    }
}

private struct ActivityExerciseListView: View {
    private let exerciseGroups: [ExerciseGroup]

    init(exercises: [Exercise]) {
        self.exerciseGroups = ExerciseStore.splitIntoMuscleGroups(exercises: exercises)
    }

    var body: some View {
        MuscleGroupSectionedExercisesView(exerciseGroups: exerciseGroups)
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
