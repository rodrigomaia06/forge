//
//  EditCustomExerciseSheet.swift
//  Iron
//
//  Created by Karim Abou Zeid on 23.09.19.
//  Copyright © 2019 Karim Abou Zeid Software. All rights reserved.
//

import SwiftUI
import WorkoutDataKit

struct EditCustomExerciseSheet: View {
    @Environment(\.presentationMode) var presentationMode
    @EnvironmentObject var exerciseStore: ExerciseStore
    @State private var exerciseValues: EditCustomExerciseView.ExerciseValues
    private let exercise: Exercise
    
    init(exercise: Exercise) {
        self.exercise = exercise
        let primaryMuscle = exercise.primaryMuscle.map { EditCustomExerciseView.ExerciseValues.ExerciseMuscle(type: .primary, muscle: $0) }
        let secondaryMuscle = exercise.secondaryMuscle.map { EditCustomExerciseView.ExerciseValues.ExerciseMuscle(type: .secondary, muscle: $0) }
        _exerciseValues = State(initialValue: .init(
            title: exercise.title,
            description: exercise.description ?? "",
            movementTitle: exercise.movementTitle,
            variationTitle: exercise.variationTitle ?? "",
            equipmentTitle: exercise.equipmentTitle ?? "",
            attachmentTitle: exercise.attachmentTitle ?? "",
            setupTitle: exercise.setupTitle ?? "",
            gripTitle: exercise.gripTitle ?? "",
            sideTitle: exercise.sideTitle ?? "",
            loadModeTitle: exercise.loadModeTitle ?? "",
            muscles: Set(primaryMuscle + secondaryMuscle),
            type: exercise.type,
            activityCategoryIDs: Set(exercise.activityCategoryIDs),
            restTime: ExerciseStore.shared.restTime(forExercise: exercise.uuid)
        ))
    }
    
    private var canSave: Bool {
        let title = exerciseValues.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return false }
        guard !exerciseStore.exercises.contains(where: {
            $0.uuid != exercise.uuid && $0.title.localizedCaseInsensitiveCompare(title) == .orderedSame
        }) else { return false }
        guard !exerciseValues.muscles.isEmpty else { return false }
        guard !exerciseValues.activityCategoryIDs.isEmpty else { return false }
        guard duplicateVariation == nil else { return false }
        return true
    }

    private var duplicateVariation: Exercise? {
        exerciseStore.duplicateVariation(
            movementTitle: exerciseValues.movementTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? exerciseValues.title : exerciseValues.movementTitle,
            equipmentTitle: exerciseValues.equipmentTitle,
            attachmentTitle: exerciseValues.attachmentTitle,
            setupTitle: exerciseValues.setupTitle,
            gripTitle: exerciseValues.gripTitle,
            sideTitle: exerciseValues.sideTitle,
            loadModeTitle: exerciseValues.loadModeTitle,
            excluding: exercise.uuid
        )
    }
    
    private var saveButton: some View {
        Button("Save") {
            let title = self.exerciseValues.title.trimmingCharacters(in: .whitespacesAndNewlines)
            let description = self.exerciseValues.description.trimmingCharacters(in: .whitespacesAndNewlines)
            let primaryMuscle = self.exerciseValues.muscles
                .map { $0 }
                .filter { $0.type == .primary }
                .sorted { $0.shortDisplayTitle < $1.shortDisplayTitle }
                .map { $0.muscle }
            let secondaryMuscle = self.exerciseValues.muscles
                .map { $0 }
                .filter { $0.type == .secondary }
                .sorted { $0.shortDisplayTitle < $1.shortDisplayTitle }
                .map { $0.muscle }
            self.exerciseStore.updateCustomExercise(
                with: self.exercise.uuid,
                title: title,
                description: description.isEmpty ? nil : description,
                primaryMuscle: primaryMuscle,
                secondaryMuscle: secondaryMuscle,
                type: self.exerciseValues.type,
                activityCategoryIDs: Array(self.exerciseValues.activityCategoryIDs).sorted(),
                movementTitle: self.exerciseValues.movementTitle,
                variationTitle: self.exerciseValues.variationTitle,
                equipmentTitle: self.exerciseValues.equipmentTitle,
                attachmentTitle: self.exerciseValues.attachmentTitle,
                setupTitle: self.exerciseValues.setupTitle,
                gripTitle: self.exerciseValues.gripTitle,
                sideTitle: self.exerciseValues.sideTitle,
                loadModeTitle: self.exerciseValues.loadModeTitle
            )
            ExerciseStore.shared.setRestTime(self.exerciseValues.restTime, forExercise: self.exercise.uuid)
            self.presentationMode.wrappedValue.dismiss()
        }.disabled(!canSave)
    }
    
    var body: some View {
        NavigationStack {
            EditCustomExerciseView(exerciseValues: $exerciseValues)
                .navigationBarTitle("Edit exercise", displayMode: .inline)
                .navigationBarItems(
                    leading:
                    Button("Cancel") {
                        self.presentationMode.wrappedValue.dismiss()
                    },
                    trailing: saveButton
                )
                .safeAreaInset(edge: .bottom) {
                    if let duplicateVariation {
                        Text("This matches \(duplicateVariation.title). Edit that variation instead.")
                            .font(.forgeCaption)
                            .foregroundColor(.forgeSecondaryLabel)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(Theme.Spacing.m)
                            .background(.bar)
                    }
                }
        }
    }
}
