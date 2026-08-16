//
//  ExerciseMovementRows.swift
//  Forge
//

import SwiftUI
import WorkoutDataKit

struct ExerciseMovementRows<RowContent: View>: View {
    let movements: [ExerciseMovement]
    @Binding var expandedMovementIDs: Set<String>
    @Binding var expandedEquipmentGroupIDs: Set<String>
    let rowContent: (Exercise, String) -> RowContent

    var body: some View {
        ForEach(movements) { movement in
            if movement.variations.count == 1, let variation = movement.variations.first {
                rowContent(variation.exercise, variation.exercise.title)
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
                    ForEach(ExerciseStore.splitIntoEquipmentGroups(variations: movement.variations)) { group in
                        let groupID = "\(movement.id)|\(group.title)"
                        if group.exercises.count == 1, let exercise = group.exercises.first {
                            rowContent(exercise, exercise.variationDisplayTitle)
                        } else {
                            DisclosureGroup(isExpanded: Binding(
                                get: { expandedEquipmentGroupIDs.contains(groupID) },
                                set: { isExpanded in
                                    if isExpanded {
                                        expandedEquipmentGroupIDs.insert(groupID)
                                    } else {
                                        expandedEquipmentGroupIDs.remove(groupID)
                                    }
                                }
                            )) {
                                ForEach(group.exercises, id: \.uuid) { exercise in
                                    rowContent(exercise, exercise.variationDisplayTitle)
                                }
                            } label: {
                                Text(group.title)
                            }
                        }
                    }
                } label: {
                    Text(movement.title)
                }
            }
        }
    }
}
