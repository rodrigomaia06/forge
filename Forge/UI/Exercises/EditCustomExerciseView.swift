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
    
    @State private var showsAdvancedVariation = false
    
    private var visibleWorkoutTypes: [WorkoutType] {
        workoutTypes.filter { !$0.isArchived || exerciseValues.activityCategoryIDs.contains($0.exerciseCategoryID) }
    }

    private var existingMovements: [ExerciseMovement] {
        ExerciseStore.splitIntoMovements(exercises: exerciseStore.exercises)
    }

    private var movementOptions: [String] {
        existingMovements.map(\.title)
    }

    private var hasAdvancedVariationValue: Bool {
        [exerciseValues.attachmentTitle, exerciseValues.setupTitle, exerciseValues.gripTitle]
            .contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    private let equipmentOptions = ["Barbell", "Dumbbell", "Cable", "Machine", "Smith machine", "EZ curl bar", "Kettlebell", "Bodyweight"]
    private let attachmentOptions = ["Rope", "V-bar", "Straight bar", "D-handle", "Ankle strap"]
    private let setupOptions = ["Incline", "Decline", "Overhead", "Lying", "Seated", "Standing", "Kneeling", "Low pulley", "Bent over", "Chest supported"]
    private let gripOptions = ["Reverse grip", "Wide grip", "Close grip", "Hammer grip", "Parallel grip", "Overhand grip", "Underhand grip"]
    
    var body: some View {
        Form {
            Section {
                TextField("Title", text: $exerciseValues.title)
                TextField("Description (Optional)", text: $exerciseValues.description)
            }

            Section {
                VariationValueField(title: "Movement", placeholder: "Bench Press", text: $exerciseValues.movementTitle, options: movementOptions)
                VariationValueField(title: "Equipment", placeholder: "Dumbbell", text: $exerciseValues.equipmentTitle, options: equipmentOptions)

                DisclosureGroup("More variation details", isExpanded: $showsAdvancedVariation) {
                    VariationValueField(title: "Attachment", placeholder: "Rope", text: $exerciseValues.attachmentTitle, options: attachmentOptions)
                    VariationValueField(title: "Setup", placeholder: "Incline", text: $exerciseValues.setupTitle, options: setupOptions)
                    VariationValueField(title: "Grip", placeholder: "Hammer grip", text: $exerciseValues.gripTitle, options: gripOptions)
                }
            } header: {
                Text("Variation")
            } footer: {
                Text("Choose an existing movement to add a variation without creating another movement row.")
            }

            Section("Classification") {
                NavigationLink {
                    MuscleSelectionView(muscles: Exercise.muscleNames, selection: $exerciseValues.muscles)
                        .navigationTitle("Muscles")
                        .navigationBarTitleDisplayMode(.inline)
                } label: {
                    LabeledContent("Muscles", value: exerciseValues.muscles.isEmpty ? "None" : "\(exerciseValues.muscles.count) selected")
                }

                NavigationLink {
                    CustomExerciseWorkoutTypeSelectionView(
                        workoutTypes: visibleWorkoutTypes,
                        selection: $exerciseValues.activityCategoryIDs
                    )
                } label: {
                    LabeledContent("Workout types", value: "\(exerciseValues.activityCategoryIDs.count) selected")
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
        .onAppear {
            if hasAdvancedVariationValue {
                showsAdvancedVariation = true
            }
        }
    }
}

private struct CustomExerciseWorkoutTypeSelectionView: View {
    let workoutTypes: [WorkoutType]
    @Binding var selection: Set<String>

    var body: some View {
        List {
            ForEach(workoutTypes, id: \.objectID) { type in
                Button {
                    toggle(type.exerciseCategoryID)
                } label: {
                    HStack(spacing: Theme.Spacing.m) {
                        Circle()
                            .fill(Color(workoutTypeHex: type.displayColorHex))
                            .frame(width: 12, height: 12)
                            .accessibilityHidden(true)
                        Text(type.displayTitle)
                            .foregroundColor(.forgeLabel)
                        Spacer()
                        if selection.contains(type.exerciseCategoryID) {
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
        .listStyleCompat_InsetGroupedListStyle()
        .navigationTitle("Workout types")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func toggle(_ id: String) {
        Haptics.selection()
        if selection.contains(id), selection.count > 1 {
            selection.remove(id)
        } else {
            selection.insert(id)
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

private struct VariationValueField: View {
    let title: String
    let placeholder: String
    @Binding var text: String
    let options: [String]

    var body: some View {
        HStack(spacing: Theme.Spacing.s) {
            Text(title)
            Spacer(minLength: Theme.Spacing.m)
            TextField(placeholder, text: $text)
                .multilineTextAlignment(.trailing)
            Menu {
                Button("Clear") { text = "" }
                ForEach(options, id: \.self) { option in
                    Button(option) { text = option }
                }
            } label: {
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.forgeSecondaryLabel)
                    .frame(width: 32, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(title) options")
        }
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
