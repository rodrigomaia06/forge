//
//  AddExercisesSheet.swift
//  Sunrise Fit
//
//  Created by Karim Abou Zeid on 03.09.19.
//  Copyright © 2019 Karim Abou Zeid Software. All rights reserved.
//

import SwiftUI
import WorkoutDataKit
import CoreData

struct AddExercisesSheet: View {
    @Environment(\.presentationMode) var presentationMode

    let onAdd: (Set<Exercise>) -> Void
    /// When provided, the sheet offers "Add as superset" once two or more exercises are selected, and
    /// hands them back in the order they appear in the list. Nil at call sites where a superset does not
    /// apply (editing a routine or a past workout), so those keep only the plain Add.
    let onAddSuperset: (([Exercise]) -> Void)?

    private let allExercises: [Exercise]
    private let recentExercises: [Exercise]

    @State private var exerciseSelectorSelection: Set<Exercise> = Set()
    @State private var filter: ExerciseBrowserFilter

    init(exercises: [Exercise], recentExercises: [Exercise], preferredCategory: ExerciseActivityCategory = .strength, onAdd: @escaping (Set<Exercise>) -> Void, onAddSuperset: (([Exercise]) -> Void)? = nil) {
        self.allExercises = exercises
        self.recentExercises = recentExercises
        self.onAdd = onAdd
        self.onAddSuperset = onAddSuperset
        _filter = State(initialValue: Self.initialFilter(preferredCategory: preferredCategory))
    }

    static func initialFilter(preferredCategory: ExerciseActivityCategory) -> ExerciseBrowserFilter {
        ExerciseBrowserFilter(category: preferredCategory)
    }

    /// The current selection in the order the exercises appear in the list (Recent counts once), so a
    /// superset is created in a sensible, stable order that the user can still change later in Edit.
    private var orderedSelection: [Exercise] {
        var seen = Set<Exercise>()
        var ordered: [Exercise] = []
        for exercise in exerciseGroups.flatMap({ $0.exercises }) where exerciseSelectorSelection.contains(exercise) {
            if seen.insert(exercise).inserted { ordered.append(exercise) }
        }
        return ordered
    }

    private var exerciseGroups: [ExerciseGroup] {
        let exercises = filter.filteredExercises(from: allExercises)
        // Selected exercises live only in the Selected section, so they are not duplicated in the lists
        // below when picked from Recent or a muscle group.
        let unselected = exercises.filter { !exerciseSelectorSelection.contains($0) }
        var groups = ExerciseStore.splitIntoMuscleGroups(exercises: unselected)
        // Recent is only meaningful with no search or filters applied.
        if !filter.isActive {
            let recent = recentExercises.filter { !exerciseSelectorSelection.contains($0) }
            if !recent.isEmpty {
                groups = [ExerciseGroup(title: "Recent", exercises: recent)] + groups
            }
        }
        // Selected first, so what you have picked stays visible at the top, even while searching.
        if !exerciseSelectorSelection.isEmpty {
            let selected = allExercises.filter { exerciseSelectorSelection.contains($0) }
            groups = [ExerciseGroup(title: "Selected", exercises: selected)] + groups
        }
        return groups
    }

    private func resetAndDismiss() {
        self.presentationMode.wrappedValue.dismiss()
        self.exerciseSelectorSelection.removeAll()
        self.filter.search = ""
    }
    
    static func loadRecentExercises(context: NSManagedObjectContext, exercises: [Exercise], maxCount: Int = 7) -> [Exercise] {
        guard maxCount > 0 else { return [] }
        let request: NSFetchRequest<Workout> = Workout.fetchRequest()
        request.predicate = NSPredicate(format: "\(#keyPath(Workout.isCurrentWorkout)) != %@", NSNumber(booleanLiteral: true))
        request.sortDescriptors = [NSSortDescriptor(keyPath: \Workout.start, ascending: false)]
        guard let workouts = try? context.fetch(request) else { return [] }
        var recentExercises = [Exercise]()
        for workout in workouts {
            if let workoutExercises = workout.workoutExercises?.array as? [WorkoutExercise] {
                for workoutExercise in workoutExercises {
                    if let exercise = workoutExercise.exercise(in: exercises) {
                        if !recentExercises.contains(exercise) {
                            recentExercises.append(exercise)
                            if recentExercises.count >= maxCount {
                                return recentExercises
                            }
                        }
                    }
                }
            }
        }
        return recentExercises
    }
    
    var body: some View {
        NavigationStack {
            content
            .background(Color.forgeBackground.ignoresSafeArea())
            .navigationTitle("Add exercises")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { self.resetAndDismiss() }
                }
            }
            // Add lives in a bottom bar, not the nav bar, so focusing the search field cannot hide it.
            .safeAreaInset(edge: .bottom) {
                if !exerciseSelectorSelection.isEmpty {
                    addBar
                }
            }
        }
    }

    private var content: some View {
        VStack(spacing: 0) {
            ExerciseBrowserFilterControls(filter: $filter, exercises: allExercises)
            ExerciseMultiSelectionView(exerciseGroups: exerciseGroups, selection: self.$exerciseSelectorSelection)
        }
    }

    private var addBar: some View {
        HStack(spacing: Theme.Spacing.m) {
            Text("\(exerciseSelectorSelection.count) selected")
                .font(.forgeCaption)
                .foregroundColor(.forgeSecondaryLabel)
            Spacer()
            if onAddSuperset != nil, exerciseSelectorSelection.count >= 2 {
                Button("Add as superset") {
                    onAddSuperset?(orderedSelection)
                    resetAndDismiss()
                }
                .font(.forgeHeadline)
                .foregroundColor(.forgeAccent)
            }
            Button {
                onAdd(exerciseSelectorSelection)
                resetAndDismiss()
            } label: {
                Text("Add")
                    .font(.forgeHeadline)
                    .foregroundColor(.forgeBackground)
                    .padding(.horizontal, Theme.Spacing.l)
                    .frame(minHeight: 44)
                    .background(Capsule().fill(Color.forgeAccent))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, Theme.Spacing.l)
        .padding(.vertical, Theme.Spacing.s)
        .background(.bar)
    }

}

struct AddExercisesSheet_Previews: PreviewProvider {
    static var previews: some View {
//        Color.clear.sheet(isPresented: .constant(true)) {
        AddExercisesSheet(
            exercises: ExerciseStore.shared.shownExercises,
            recentExercises: [],
            onAdd: { _ in }
        )
//        }
    }
}
