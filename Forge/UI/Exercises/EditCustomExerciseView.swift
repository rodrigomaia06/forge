//
//  CreateCustomExerciseView.swift
//  Iron
//
//  Created by Karim Abou Zeid on 17.09.19.
//  Copyright © 2019 Karim Abou Zeid Software. All rights reserved.
//

import SwiftUI
import CoreData
import WorkoutDataKit

struct EditCustomExerciseView: View {
    struct ExerciseValues {
        var title: String
        var description: String
        var movementTitle: String = ""
        var variationTitle: String = ""
        var equipmentTitle: String = ""
        var attachmentTitle: String = ""
        var setupTitle: String = ""
        var gripTitle: String = ""
        var sideTitle: String = ""
        var loadModeTitle: String = ""
        var muscles: Set<ExerciseMuscle>
        var type: Exercise.ExerciseType
        var activityCategoryIDs: Set<String> = [ExerciseActivityCategory.strength.rawValue]
        var restTime: TimeInterval? = nil

        struct ExerciseMuscle: Hashable {
            enum MuscleType {
                case primary
                case secondary
            }
            
            let type: MuscleType
            let muscle: String
        }
    }
    
    @Binding var exerciseValues: ExerciseValues
    @EnvironmentObject var exerciseStore: ExerciseStore
    @FetchRequest(fetchRequest: WorkoutType.fetchRequestSorted()) private var workoutTypes
    
    @State private var showingMuscleSelectionSheet = false
    
    private var primaryMuscles: [ExerciseValues.ExerciseMuscle] {
        exerciseValues.muscles
            .map { $0 }
            .sorted { $0.shortDisplayTitle < $1.shortDisplayTitle }
            .filter { $0.type == .primary }
    }
    
    private var secondaryMuscles: [ExerciseValues.ExerciseMuscle] {
        exerciseValues.muscles
            .map { $0 }
            .sorted { $0.shortDisplayTitle < $1.shortDisplayTitle }
            .filter { $0.type == .secondary }
    }

    private var visibleWorkoutTypes: [WorkoutType] {
        workoutTypes.filter { !$0.isArchived || exerciseValues.activityCategoryIDs.contains($0.exerciseCategoryID) }
    }

    private var existingMovements: [ExerciseMovement] {
        ExerciseStore.splitIntoMovements(exercises: exerciseStore.exercises)
    }
    
    var body: some View {
        Form {
            Section {
                TextField("Title", text: $exerciseValues.title)
                TextField("Description (Optional)", text: $exerciseValues.description)
            }

            Section(header: Text("Variation".uppercased()), footer: Text("Use an existing movement to group related variations.")) {
                TextField("Movement", text: $exerciseValues.movementTitle)
                Menu {
                    ForEach(existingMovements) { movement in
                        Button(movement.title) {
                            exerciseValues.movementTitle = movement.title
                        }
                    }
                } label: {
                    Label("Use existing movement", systemImage: "list.bullet")
                }
                TextField("Equipment", text: $exerciseValues.equipmentTitle)
                TextField("Attachment", text: $exerciseValues.attachmentTitle)
                TextField("Setup", text: $exerciseValues.setupTitle)
                TextField("Grip", text: $exerciseValues.gripTitle)
                TextField("Side", text: $exerciseValues.sideTitle)
                TextField("Load", text: $exerciseValues.loadModeTitle)
            }
            
            Section(header: Text("Muscles".uppercased()), footer: Text("Select at least one muscle.")) {
                ForEach(primaryMuscles, id: \.self) { exerciseMuscle in
                    HStack {
                        Text(exerciseMuscle.shortDisplayTitle)
                        Spacer()
                        Text("Primary")
                            .foregroundColor(.secondary)
                    }
                }
                ForEach(secondaryMuscles, id: \.self) { exerciseMuscle in
                    HStack {
                        Text(exerciseMuscle.shortDisplayTitle)
                        Spacer()
                        Text("Secondary")
                            .foregroundColor(.secondary)
                    }
                }
                Button("Select muscles")  {
                    self.showingMuscleSelectionSheet = true
                }
            }
            
            Picker("Equipment", selection: $exerciseValues.type) {
                ForEach(Exercise.ExerciseType.allCases, id: \.self) {
                    Text($0.title).tag($0)
                }
            }

            Section(header: Text("Sections".uppercased()), footer: Text("Choose where this exercise appears on the Exercises page.")) {
                ForEach(visibleWorkoutTypes, id: \.objectID) { type in
                    Button {
                        toggleCategory(type.exerciseCategoryID)
                    } label: {
                        HStack(spacing: Theme.Spacing.m) {
                            Circle()
                                .fill(Color(workoutTypeHex: type.displayColorHex))
                                .frame(width: 12, height: 12)
                                .accessibilityHidden(true)
                            Text(type.displayTitle)
                                .foregroundColor(.forgeLabel)
                            SourceSignalView(isAppProvided: type.isDefaultPreset)
                            Spacer()
                            if exerciseValues.activityCategoryIDs.contains(type.exerciseCategoryID) {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.forgeAccent)
                                    .accessibilityLabel("Selected")
                            }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }

            Section(footer: Text("Rest timer for this exercise. \"Default\" uses the rest time set in General.")) {
                Picker("Rest Time", selection: $exerciseValues.restTime) {
                    Text("Default").tag(TimeInterval?.none)
                    ForEach(restTimerCustomTimes, id: \.self) { time in
                        Text(restTimerDurationFormatter.string(from: time) ?? "").tag(TimeInterval?.some(time))
                    }
                }
            }
        }
        .keyboardDoneToolbar()
        .sheet(isPresented: $showingMuscleSelectionSheet) {
            NavigationStack {
                MuscleSelectionView(muscles: Exercise.muscleNames, selection: self.$exerciseValues.muscles)
                    .navigationBarTitle("Select muscles", displayMode: .inline)
                    .navigationBarItems(trailing:
                        Button("Done") {
                            self.showingMuscleSelectionSheet = false
                        }
                    )
            }
        }
    }

    private func toggleCategory(_ id: String) {
        if exerciseValues.activityCategoryIDs.contains(id), exerciseValues.activityCategoryIDs.count > 1 {
            exerciseValues.activityCategoryIDs.remove(id)
        } else {
            exerciseValues.activityCategoryIDs.insert(id)
        }
    }
}

extension EditCustomExerciseView.ExerciseValues.ExerciseMuscle {
    var shortDisplayTitle: String {
        let title = Exercise.commonMuscleName(for: muscle) ?? "other"
        return title.capitalized
    }
    
    var displayTitle: String {
        var title = shortDisplayTitle
        if title.lowercased() != muscle.lowercased() {
            title.append(" (\(muscle))")
        }
        return title.capitalized
    }
}

struct MuscleSelectionView: View {
    var muscles: [String]
    @Binding var selection: Set<EditCustomExerciseView.ExerciseValues.ExerciseMuscle>
    
    private var primaryMuscles: [EditCustomExerciseView.ExerciseValues.ExerciseMuscle] {
        muscles
            .map { EditCustomExerciseView.ExerciseValues.ExerciseMuscle(type: .primary, muscle: $0) }
            .sorted { $0.displayTitle < $1.displayTitle }
    }
    
    private var secondaryMuscles: [EditCustomExerciseView.ExerciseValues.ExerciseMuscle] {
        muscles
            .map { EditCustomExerciseView.ExerciseValues.ExerciseMuscle(type: .secondary, muscle: $0) }
            .sorted { $0.displayTitle < $1.displayTitle }
    }
    
    var body: some View {
        List(selection: $selection) {
            Section(header: Text("Primary".uppercased())) {
                ForEach(primaryMuscles, id: \.self) { exerciseMuscle in
                    Text(exerciseMuscle.displayTitle)
                }
            }
            Section(header: Text("Secondary".uppercased())) {
                ForEach(secondaryMuscles, id: \.self) { exerciseMuscle in
                    Text(exerciseMuscle.displayTitle)
                }
            }
        }
        .listStyleCompat_InsetGroupedListStyle()
        .environment(\.editMode, .constant(.active))
    }
}

#if DEBUG
struct CreateCustomExerciseView_Previews: PreviewProvider {
    static var previews: some View {
        EditCustomExerciseView(exerciseValues: .constant(.init(title: "", description: "", muscles: Set(), type: .other)))
            .mockEnvironment(weightUnit: .metric)
    }
}
#endif
