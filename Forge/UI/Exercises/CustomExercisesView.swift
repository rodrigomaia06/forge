//
//  CustomExercisesView.swift
//  Iron
//
//  Created by Karim Abou Zeid on 17.09.19.
//  Copyright © 2019 Karim Abou Zeid Software. All rights reserved.
//

import SwiftUI
import CoreData
import WorkoutDataKit

struct CustomExercisesView: View {
    @Environment(\.managedObjectContext) var managedObjectContext
    @EnvironmentObject var settingsStore: SettingsStore
    @EnvironmentObject var exerciseStore: ExerciseStore
    
    @State private var activeSheet: SheetType?
    @State private var filter = ExerciseBrowserFilter()
    @State private var expandedMovementIDs = Set<String>()
    
    private enum SheetType: Identifiable {
        case createCustomExercise
        
        var id: Self { self }
    }
    
    private func sheetView(type: SheetType) -> AnyView {
        switch type {
        case .createCustomExercise:
            return CreateCustomExerciseSheet()
                .environmentObject(exerciseStore)
                .typeErased
        }
    }
    
    @State private var exercisesToDelete: [Exercise]?

    private var filteredExercises: [Exercise] {
        filter.filteredExercises(from: exerciseStore.customExercises)
    }
    
    private func delete(_ exercises: [Exercise]) {
        for exercise in exercises {
            assert(exercise.isCustom)
            let uuid = exercise.uuid
            self.deleteWorkoutExercises(with: uuid)
            self.exerciseStore.deleteCustomExercise(with: uuid)
        }
        self.managedObjectContext.saveOrCrash()
    }
    
    var body: some View {
        VStack(spacing: 0) {
            ExerciseBrowserFilterControls(filter: $filter, exercises: exerciseStore.customExercises)
            Divider()
            List {
                if filteredExercises.isEmpty, filter.isActive {
                    ContentUnavailableView("No exercises found", systemImage: "magnifyingglass")
                }
                ForEach(ExerciseStore.splitIntoMovements(exercises: filteredExercises)) { movement in
                    if movement.variations.count == 1, let variation = movement.variations.first {
                        exerciseRow(variation.exercise)
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
                                exerciseRow(variation.exercise, title: variation.exercise.variationDisplayTitle)
                            }
                        } label: {
                            Text(movement.title)
                        }
                    }
                }
                Button(action: {
                    self.activeSheet = .createCustomExercise
                }) {
                    HStack {
                        Image(systemName: "plus")
                        Text("Create exercise")
                    }
                }
            }
            .listStyleCompat_InsetGroupedListStyle()
        }
        .sheet(item: $activeSheet, content: { type in
            self.sheetView(type: type)
        })
        .alert("Delete exercise?", isPresented: Binding(get: { exercisesToDelete != nil }, set: { if !$0 { exercisesToDelete = nil } })) {
            Button("Delete", role: .destructive) {
                self.delete(exercisesToDelete ?? [])
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("This cannot be undone. Any workout or routine entry using this exercise will be removed.")
        }
    }

    private func exerciseRow(_ exercise: Exercise, title: String? = nil) -> some View {
        NavigationLink(destination: ExerciseDetailView(exercise: exercise)
            .environmentObject(self.settingsStore)) {
            ExerciseSourceRow(exercise: exercise, title: title)
        }
        .swipeActions {
            Button("Delete", role: .destructive) {
                guard UIDevice.current.userInterfaceIdiom != .pad else {
                    self.delete([exercise])
                    return
                }
                self.exercisesToDelete = [exercise]
            }
        }
    }
    
    private func deleteWorkoutExercises(with uuid: UUID) {
        let request: NSFetchRequest<WorkoutExercise> = WorkoutExercise.fetchRequest()
        request.predicate = NSPredicate(format: "\(#keyPath(WorkoutExercise.exerciseUuid)) == %@", uuid as CVarArg)
        guard let workoutExercises = try? managedObjectContext.fetch(request) else { return }
        workoutExercises.forEach { managedObjectContext.delete($0) }
    }

}

#if DEBUG
struct CustomExercisesView_Previews: PreviewProvider {
    static var previews: some View {
        CustomExercisesView()
            .mockEnvironment(weightUnit: .metric)
    }
}
#endif
