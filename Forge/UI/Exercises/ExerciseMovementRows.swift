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
            Text(movement.title)
                .foregroundColor(.forgeLabel)
            Spacer()
            if let commonSource {
                SourceSignalView(isAppProvided: commonSource)
            }
            if movement.variations.count > 1 {
                Image(systemName: "square.stack.3d.up")
                    .font(.body.weight(.semibold))
                    .foregroundColor(.forgeSecondaryLabel)
                    .accessibilityLabel("Multiple variations")
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
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .listRowBackground(Color.clear)
        .background(Color.forgeBackground)
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
