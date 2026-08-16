//
//  ExerciseMultiSelectionView.swift
//  Sunrise Fit
//
//  Created by Karim Abou Zeid on 20.07.19.
//  Copyright © 2019 Karim Abou Zeid Software. All rights reserved.
//

import SwiftUI
import WorkoutDataKit

struct ExerciseMultiSelectionView: View {
    var exerciseGroups: [ExerciseGroup]
    var showsExactResults = false
    @Binding var selection: Set<Exercise>

    private let compactRowInsets = EdgeInsets(
        top: Theme.Spacing.s,
        leading: Theme.Spacing.l,
        bottom: Theme.Spacing.s,
        trailing: Theme.Spacing.m
    )
    
    var body: some View {
        Group {
            if exerciseGroups.isEmpty {
                ContentUnavailableView("No exercises found", systemImage: "magnifyingglass")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.forgeBackground)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        ForEach(exerciseGroups) { exerciseGroup in
                            exerciseSection(exerciseGroup)
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.l)
                    .padding(.top, Theme.Spacing.m)
                    .padding(.bottom, Theme.Spacing.xl)
                }
                .background(Color.forgeBackground)
            }
        }
    }

    private func exerciseSection(_ exerciseGroup: ExerciseGroup) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s) {
            Text(exerciseGroup.title.capitalized)
                .font(.forgeHeadline)
                .foregroundColor(.forgeSecondaryLabel)
                .padding(.horizontal, Theme.Spacing.m)

            VStack(spacing: 0) {
                if exerciseGroup.title == "Selected" || showsExactResults {
                    let exercises = exerciseGroup.exercises
                    ForEach(Array(exercises.enumerated()), id: \.element) { index, exercise in
                        exactSelectionRow(exercise: exercise)
                        rowDivider(isLast: index == exercises.count - 1)
                    }
                } else {
                    let movements = ExerciseStore.splitIntoMovements(exercises: exerciseGroup.exercises)
                    ForEach(Array(movements.enumerated()), id: \.element.id) { index, movement in
                        movementRow(movement)
                        rowDivider(isLast: index == movements.count - 1)
                    }
                }
            }
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous)
                    .fill(Color.forgeSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous)
                    .strokeBorder(Color.forgeSeparator, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous))
        }
    }

    @ViewBuilder
    private func rowDivider(isLast: Bool) -> some View {
        if !isLast {
            Divider()
                .padding(.leading, Theme.Spacing.l)
        }
    }

    private func movementRow(_ movement: ExerciseMovement) -> some View {
        if movement.variations.count == 1, let variation = movement.variations.first {
            return AnyView(
                Button {
                    toggle(variation.exercise)
                } label: {
                    movementRowContent(
                        title: movement.title,
                        subtitle: variation.exercise.browsingVariationTitle == variation.exercise.movementTitle ? nil : variation.exercise.browsingVariationTitle,
                        selectedCount: selection.contains(variation.exercise) ? 1 : 0,
                        showsDisclosure: false
                    )
                }
                .buttonStyle(.plain)
                .padding(compactRowInsets)
                .accessibilityLabel(movement.title)
                .accessibilityValue(selection.contains(variation.exercise) ? "Selected" : "Not selected")
            )
        }

        let selectedCount = movement.variations.filter { selection.contains($0.exercise) }.count
        return AnyView(
            NavigationLink {
                ExerciseMovementSelectionView(movement: movement, selection: $selection)
            } label: {
                movementRowContent(
                    title: movement.title,
                    subtitle: movementSubtitle(movement, selectedCount: selectedCount),
                    selectedCount: selectedCount,
                    showsDisclosure: true
                )
            }
            .padding(compactRowInsets)
        )
    }

    private func movementSubtitle(_ movement: ExerciseMovement, selectedCount: Int) -> String {
        let count = movement.variations.count
        let base = count == 1 ? "1 variation" : "\(count) variations"
        guard selectedCount > 0 else { return base }
        return "\(base) · \(selectedCount) selected"
    }

    private func movementRowContent(title: String, subtitle: String?, selectedCount: Int, showsDisclosure: Bool) -> some View {
        HStack(spacing: Theme.Spacing.m) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.forgeHeadline)
                    .foregroundColor(.forgeLabel)
                if let subtitle {
                    Text(subtitle)
                        .font(.forgeCaption)
                        .foregroundColor(.forgeSecondaryLabel)
                }
            }
            Spacer()
            if selectedCount > 0 {
                Image(systemName: "checkmark.circle.fill")
                    .font(.body)
                    .foregroundColor(.forgeAccent)
                    .accessibilityHidden(true)
            }
            if showsDisclosure {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .foregroundColor(.forgeSecondaryLabel)
                    .accessibilityHidden(true)
            } else if !showsDisclosure {
                Image(systemName: "plus.circle")
                    .font(.body)
                    .foregroundColor(.forgeSecondaryLabel)
                    .accessibilityHidden(true)
            }
        }
        .contentShape(Rectangle())
    }

    private func exactSelectionRow(exercise: Exercise) -> some View {
        Button {
            toggle(exercise)
        } label: {
            HStack(spacing: Theme.Spacing.m) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(exercise.browsingExerciseTitle)
                        .font(.forgeHeadline)
                        .foregroundColor(.forgeLabel)
                }
                Spacer()
                Image(systemName: selection.contains(exercise) ? "checkmark.circle.fill" : "plus.circle")
                    .font(.body)
                    .foregroundColor(selection.contains(exercise) ? .forgeAccent : .forgeSecondaryLabel)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(compactRowInsets)
        .accessibilityLabel(exercise.title)
        .accessibilityValue(selection.contains(exercise) ? "Selected" : "Not selected")
    }

    private func toggle(_ exercise: Exercise) {
        Haptics.selection()
        var transaction = Transaction()
        transaction.animation = nil
        withTransaction(transaction) {
            if selection.contains(exercise) {
                selection.remove(exercise)
            } else {
                selection.insert(exercise)
            }
        }
    }
}

private struct ExerciseMovementSelectionView: View {
    let movement: ExerciseMovement
    @Binding var selection: Set<Exercise>
    @State private var selectedValues: [VariationField: String] = [:]

    private let compactRowInsets = EdgeInsets(
        top: Theme.Spacing.s,
        leading: Theme.Spacing.l,
        bottom: Theme.Spacing.s,
        trailing: Theme.Spacing.m
    )

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                if !availableFields.isEmpty {
                    VStack(alignment: .leading, spacing: Theme.Spacing.m) {
                        ForEach(availableFields) { field in
                            fieldChooser(field)
                        }
                    }
                    .padding(Theme.Spacing.l)
                    .background(
                        RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous)
                            .fill(Color.forgeSurface)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous)
                            .strokeBorder(Color.forgeSeparator, lineWidth: 1)
                    )
                }

                VStack(alignment: .leading, spacing: Theme.Spacing.s) {
                    Text(matchSectionTitle)
                        .font(.forgeHeadline)
                        .foregroundColor(.forgeSecondaryLabel)
                        .padding(.horizontal, Theme.Spacing.m)

                    if shouldShowMatches {
                        if matchingVariations.isEmpty {
                            Text("No variations match these options.")
                                .font(.forgeCaption)
                                .foregroundColor(.forgeSecondaryLabel)
                                .padding(Theme.Spacing.l)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(
                                    RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous)
                                        .fill(Color.forgeSurface)
                                )
                        } else {
                            VStack(spacing: 0) {
                                ForEach(Array(matchingVariations.enumerated()), id: \.element.id) { index, variation in
                                    variationRow(variation.exercise)
                                    rowDivider(isLast: index == matchingVariations.count - 1)
                                }
                            }
                            .background(
                                RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous)
                                    .fill(Color.forgeSurface)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous)
                                    .strokeBorder(Color.forgeSeparator, lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous))
                        }
                    } else {
                        Text("Choose equipment, setup, grip, or another option to narrow the variations.")
                            .font(.forgeCaption)
                            .foregroundColor(.forgeSecondaryLabel)
                            .padding(Theme.Spacing.l)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous)
                                    .fill(Color.forgeSurface)
                            )
                    }
                }
            }
            .padding(.horizontal, Theme.Spacing.l)
            .padding(.top, Theme.Spacing.m)
            .padding(.bottom, Theme.Spacing.xl)
        }
        .background(Color.forgeBackground)
        .navigationTitle(movement.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var availableFields: [VariationField] {
        VariationField.allCases.filter { values(for: $0).count > 1 }
    }

    private var matchingVariations: [ExerciseVariation] {
        movement.variations.filter { variation in
            selectedValues.allSatisfy { field, value in
                field.value(for: variation.exercise) == value
            }
        }
    }

    private var shouldShowMatches: Bool {
        matchingVariations.count <= 8 || !selectedValues.isEmpty || availableFields.isEmpty
    }

    private var matchSectionTitle: String {
        let count = matchingVariations.count
        if count == 1 {
            return "1 match"
        }
        return "\(count) matches"
    }

    private func values(for field: VariationField) -> [String] {
        Array(Set(movement.variations.compactMap { variation in
            field.value(for: variation.exercise)
        }))
        .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    private func fieldChooser(_ field: VariationField) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s) {
            HStack {
                Text(field.title)
                    .font(.forgeCaption.weight(.semibold))
                    .foregroundColor(.forgeSecondaryLabel)
                Spacer()
                if selectedValues[field] != nil {
                    Button("Clear") {
                        Haptics.selection()
                        selectedValues[field] = nil
                    }
                    .font(.forgeCaption)
                    .foregroundColor(.forgeSecondaryLabel)
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.Spacing.s) {
                    ForEach(values(for: field), id: \.self) { value in
                        fieldChip(field: field, value: value)
                    }
                }
            }
        }
    }

    private func fieldChip(field: VariationField, value: String) -> some View {
        let isSelected = selectedValues[field] == value
        return Button {
            Haptics.selection()
            selectedValues[field] = isSelected ? nil : value
        } label: {
            Text(value)
                .font(.forgeCaption.weight(.semibold))
                .foregroundColor(isSelected ? .forgeBackground : .forgeLabel)
                .padding(.horizontal, Theme.Spacing.m)
                .frame(minHeight: 34)
                .background(Capsule().fill(isSelected ? Color.forgeAccent : Color.forgeBackground))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func rowDivider(isLast: Bool) -> some View {
        if !isLast {
            Divider()
                .padding(.leading, Theme.Spacing.l)
        }
    }

    private func variationRow(_ exercise: Exercise) -> some View {
        Button {
            toggle(exercise)
        } label: {
            HStack(spacing: Theme.Spacing.m) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(exercise.browsingVariationTitle)
                        .font(.forgeHeadline)
                        .foregroundColor(.forgeLabel)
                }
                Spacer()
                Image(systemName: selection.contains(exercise) ? "checkmark.circle.fill" : "plus.circle")
                    .font(.body)
                    .foregroundColor(selection.contains(exercise) ? .forgeAccent : .forgeSecondaryLabel)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(compactRowInsets)
        .accessibilityLabel(exercise.title)
        .accessibilityValue(selection.contains(exercise) ? "Selected" : "Not selected")
    }

    private func toggle(_ exercise: Exercise) {
        Haptics.selection()
        var transaction = Transaction()
        transaction.animation = nil
        withTransaction(transaction) {
            if selection.contains(exercise) {
                selection.remove(exercise)
            } else {
                selection.insert(exercise)
            }
        }
    }
}

private enum VariationField: String, CaseIterable, Identifiable {
    case equipment
    case attachment
    case setup
    case grip
    case side
    case load

    var id: String { rawValue }

    var title: String {
        switch self {
        case .equipment: return "Equipment"
        case .attachment: return "Attachment"
        case .setup: return "Setup"
        case .grip: return "Grip"
        case .side: return "Side"
        case .load: return "Load"
        }
    }

    func value(for exercise: Exercise) -> String? {
        let value: String?
        switch self {
        case .equipment: value = exercise.equipmentTitle
        case .attachment: value = exercise.attachmentTitle
        case .setup: value = exercise.setupTitle
        case .grip: value = exercise.gripTitle
        case .side: value = exercise.sideTitle
        case .load: value = exercise.loadModeTitle
        }
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        return value
    }
}

#if DEBUG
struct ExerciseMultiSelectionView_Previews: PreviewProvider {
    static var previews: some View {
        ExerciseMultiSelectionView(exerciseGroups: ExerciseStore.splitIntoMuscleGroups(exercises: ExerciseStore.shared.shownExercises), selection: .constant(Set()))
    }
}
#endif
