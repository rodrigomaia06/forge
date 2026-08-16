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
    
    func exerciseGroupCell(_ exerciseGroup: ExerciseGroup) -> some View {
        NavigationLink(destination:
            ExerciseBrowserGroupedListView(exercises: exerciseGroup.exercises, showsCategoryPicker: false)
                .navigationBarTitle(Text(exerciseGroup.title), displayMode: .inline)
        ) {
            HStack(spacing: Theme.Spacing.s) {
                Text(exerciseGroup.title)
                Spacer()
                Text("\(exerciseGroup.exercises.count)")
                    .font(.forgeCaption)
                    .foregroundColor(.forgeSecondaryLabel)
            }
            .foregroundColor(.forgeLabel)
            .frame(minHeight: Theme.Layout.minTapTarget)
        }
        .buttonStyle(.plain)
    }
    
    private var activityGroups: [ActivityExerciseGroup] {
        let types = Array(workoutTypes)
        let groups = ExerciseStore.splitIntoWorkoutTypeGroups(exercises: exerciseStore.shownExercises, workoutTypes: types)
        return zip(types, groups).map { ActivityExerciseGroup(type: $0, group: $1) }
    }
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                exerciseGroup {
                    NavigationLink(destination: ExerciseBrowserGroupedListView(exerciseGroups: activityGroups.map(\.group).filter { !$0.exercises.isEmpty })
                        .navigationBarTitle(Text("All exercises"), displayMode: .inline), isActive: $allExercisesSelected) {
                        categoryRow(title: "All", count: exerciseStore.shownExercises.count)
                    }
                    .buttonStyle(.plain)
                }

                if !activityGroups.isEmpty {
                    exerciseGroup {
                        ForEach(Array(activityGroups.enumerated()), id: \.element.id) { index, item in
                            if index > 0 { ForgeListSeparator().padding(.leading, Theme.Layout.insetGroupedRowInset) }
                            exerciseGroupCell(item.group)
                        }
                    }
                }

                exerciseGroup {
                    navigationRow(title: "Custom", count: exerciseStore.customExercises.count, destination: CustomExercisesView())
                    if !exerciseStore.hiddenExercises.isEmpty {
                        ForgeListSeparator().padding(.leading, Theme.Layout.insetGroupedRowInset)
                        navigationRow(title: "Hidden", count: exerciseStore.hiddenExercises.count, destination: ExercisesView(exercises: exerciseStore.hiddenExercises))
                    }
                }
            }
            .padding(.horizontal, Theme.Layout.insetGroupedRowInset)
            .padding(.top, Theme.Spacing.m)
            .padding(.bottom, Theme.Layout.bottomScrollClearance)
        }
        .background(Color.forgeBackground.ignoresSafeArea())
        .navigationBarTitle("Exercises")
    }

    @ViewBuilder
    private func exerciseGroup<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: 0, content: content)
    }

    private func categoryRow(title: String, count: Int) -> some View {
        HStack(spacing: Theme.Spacing.s) {
            Text(title)
            Spacer()
            Text("\(count)")
                .font(.forgeCaption)
                .foregroundColor(.forgeSecondaryLabel)
        }
        .foregroundColor(.forgeLabel)
        .padding(.horizontal, Theme.Layout.insetGroupedRowInset)
        .frame(minHeight: Theme.Layout.minTapTarget)
    }

    private func navigationRow<Destination: View>(title: String, count: Int, destination: Destination) -> some View {
        NavigationLink(destination: destination) {
            categoryRow(title: title, count: count)
        }
        .buttonStyle(.plain)
    }
}

private struct ActivityExerciseGroup: Identifiable {
    let type: WorkoutType
    let group: ExerciseGroup

    var id: NSManagedObjectID { type.objectID }
}

#if DEBUG
struct ExerciseCategoryView_Previews : PreviewProvider {
    static var previews: some View {
        ExerciseMuscleGroupsView()
            .mockEnvironment(weightUnit: .metric)
    }
}
#endif
