//
//  ExerciseMovementRows.swift
//  Forge
//

import SwiftUI
import WorkoutDataKit

struct ExerciseMovementRows<RowContent: View>: View {
    let movements: [ExerciseMovement]
    @Binding var expandedMovementIDs: Set<String>
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
                    ForEach(movement.variations) { variation in
                        rowContent(variation.exercise, variation.exercise.compactVariationTitle())
                    }
                } label: {
                    Text(movement.title)
                }
            }
        }
    }
}
