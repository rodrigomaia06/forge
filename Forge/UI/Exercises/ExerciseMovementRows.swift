//
//  ExerciseMovementRows.swift
//  Forge
//

import SwiftUI
import WorkoutDataKit

struct ExerciseMovementRows: View {
    let movements: [ExerciseMovement]
    var onDelete: ((Exercise) -> Void)? = nil

    var body: some View {
        ForEach(movements) { movement in
            if movement.variations.count == 1, let variation = movement.variations.first {
                exactExerciseLink(variation.exercise, movementTitle: movement.title)
            } else {
                NavigationLink {
                    ExerciseMovementDetailView(movement: movement, onDelete: onDelete)
                } label: {
                    MovementBrowserRow(movement: movement)
                }
            }
        }
    }

    @ViewBuilder
    private func exactExerciseLink(_ exercise: Exercise, movementTitle: String) -> some View {
        NavigationLink(destination: ExerciseDetailView(exercise: exercise)) {
            ExactExerciseBrowserRow(
                exercise: exercise,
                title: movementTitle,
                subtitle: compactSubtitle(for: exercise)
            )
        }
        .swipeActions {
            if let onDelete {
                Button(role: .destructive) {
                    onDelete(exercise)
                } label: {
                    Label("Delete", systemImage: "trash")
                }
                .tint(.forgeDestructive)
            }
        }
    }

    private func compactSubtitle(for exercise: Exercise) -> String? {
        let title = exercise.compactVariationTitle()
        return title == "Standard" ? nil : title
    }
}

private struct MovementBrowserRow: View {
    let movement: ExerciseMovement

    private var commonSource: Bool? {
        let values = Set(movement.variations.map { !$0.exercise.isCustom })
        return values.count == 1 ? values.first : nil
    }

    var body: some View {
        HStack(spacing: Theme.Spacing.s) {
            VStack(alignment: .leading, spacing: 2) {
                Text(movement.title)
                    .foregroundColor(.forgeLabel)
                if movement.variations.count > 1 {
                    Text("Choose variation")
                        .font(.forgeCaption)
                        .foregroundColor(.forgeSecondaryLabel)
                }
            }
            Spacer()
            if let commonSource {
                SourceSignalView(isAppProvided: commonSource)
            }
        }
    }
}

private struct ExerciseMovementDetailView: View {
    let movement: ExerciseMovement
    let onDelete: ((Exercise) -> Void)?

    var body: some View {
        List {
            ForEach(ExerciseStore.splitIntoEquipmentGroups(variations: movement.variations)) { group in
                Section(header: Text(group.title)) {
                    ForEach(group.exercises, id: \.self) { exercise in
                        NavigationLink(destination: ExerciseDetailView(exercise: exercise)) {
                            ExactExerciseBrowserRow(
                                exercise: exercise,
                                title: exercise.compactVariationTitle(omittingEquipment: group.title),
                                subtitle: nil
                            )
                        }
                        .swipeActions {
                            if let onDelete {
                                Button(role: .destructive) {
                                    onDelete(exercise)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                                .tint(.forgeDestructive)
                            }
                        }
                    }
                }
            }
        }
        .listStyleCompat_InsetGroupedListStyle()
        .navigationTitle(movement.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct ExactExerciseBrowserRow: View {
    let exercise: Exercise
    let title: String
    let subtitle: String?

    var body: some View {
        HStack(spacing: Theme.Spacing.s) {
            Text(title)
                .foregroundColor(.forgeLabel)
                .lineLimit(2)
                .layoutPriority(1)
            Spacer(minLength: Theme.Spacing.s)
            if let subtitle {
                Text(subtitle)
                    .font(.forgeCaption)
                    .foregroundColor(.forgeSecondaryLabel)
                    .multilineTextAlignment(.trailing)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: 150, alignment: .trailing)
            }
            SourceSignalView(isAppProvided: !exercise.isCustom)
        }
        .accessibilityElement(children: .combine)
    }
}
