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
        List {
            if exerciseGroups.isEmpty {
                ContentUnavailableView("No exercises found", systemImage: "magnifyingglass")
            } else {
                ForEach(exerciseGroups) { exerciseGroup in
                    Section(header: Text(exerciseGroup.title.capitalized)) {
                        if exerciseGroup.title == "Selected" || exerciseGroup.title == "Recent" || showsExactResults {
                            ForEach(exerciseGroup.exercises, id: \.self) { exercise in
                                exactSelectionRow(exercise: exercise)
                            }
                        } else {
                            ForEach(ExerciseStore.splitIntoMovements(exercises: exerciseGroup.exercises)) { movement in
                                movementRow(movement)
                            }
                        }
                    }
                }
            }
        }
        .listStyleCompat_InsetGroupedListStyle()
        .environment(\.defaultMinListRowHeight, 54)
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
                .listRowInsets(compactRowInsets)
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
            .listRowInsets(compactRowInsets)
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
        let variation = exercise.compactVariationTitle()
        Button {
            toggle(exercise)
        } label: {
            HStack(spacing: Theme.Spacing.m) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(exercise.movementTitle)
                        .font(.forgeHeadline)
                        .foregroundColor(.forgeLabel)
                    if variation != "Standard" {
                        Text(variation)
                            .font(.forgeCaption)
                            .foregroundColor(.forgeSecondaryLabel)
                    }
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
        .listRowInsets(compactRowInsets)
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

extension Exercise {
    func compactVariationTitle(omittingEquipment equipmentTitleToOmit: String? = nil) -> String {
        let omittedEquipment = equipmentTitleToOmit?.normalizedExerciseFilterToken
        let fields = variationDisplayFields.compactMap { field -> String? in
            if field.label == "Equipment", field.value.normalizedExerciseFilterToken == omittedEquipment {
                return nil
            }
            return field.value
        }
        if !fields.isEmpty {
            return fields.joined(separator: ", ")
        }

        if let variationTitle = variationTitle?.trimmingCharacters(in: .whitespacesAndNewlines),
           !variationTitle.isEmpty,
           variationTitle.localizedCaseInsensitiveCompare(movementTitle) != .orderedSame {
            if let equipmentTitleToOmit,
               variationTitle.normalizedExerciseFilterToken == equipmentTitleToOmit.normalizedExerciseFilterToken {
                return "Standard"
            }
            return variationTitle
        }

        if let equipmentTitle,
           equipmentTitle.normalizedExerciseFilterToken != omittedEquipment,
           !equipmentTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return equipmentTitle
        }

        return "Standard"
    }
}

private struct ExerciseMovementSelectionView: View {
    private static let otherValue = "__other__"

    @EnvironmentObject private var exerciseStore: ExerciseStore
    let movement: ExerciseMovement
    @Binding var selection: Set<Exercise>

    @State private var equipmentChoice: String
    @State private var customEquipment = ""
    @State private var choices = [ExerciseVariationAttribute: String]()
    @State private var customValues = [ExerciseVariationAttribute: String]()
    @State private var isSaving = false
    @State private var showingSaveError = false

    init(movement: ExerciseMovement, selection: Binding<Set<Exercise>>) {
        self.movement = movement
        self._selection = selection
        let equipment = ExerciseStore.variationOptions(for: movement).equipment
        if equipment.count == 1 {
            _equipmentChoice = State(initialValue: equipment[0])
        } else if equipment.isEmpty {
            _equipmentChoice = State(initialValue: Self.otherValue)
        } else {
            _equipmentChoice = State(initialValue: "")
        }
    }

    private var equipmentTitle: String? {
        if equipmentChoice == Self.otherValue {
            return Exercise.cleanVariationField(customEquipment)
        }
        return Exercise.cleanVariationField(equipmentChoice)
    }

    private var options: ExerciseVariationOptions {
        ExerciseStore.variationOptions(for: movement, equipmentTitle: equipmentTitle)
    }

    private var visibleAttributes: [ExerciseVariationAttribute] {
        ExerciseVariationAttribute.allCases.filter { !options.values(for: $0).isEmpty }
    }

    private var variationSelection: ExerciseVariationSelection {
        ExerciseVariationSelection(
            movementID: movement.id,
            equipmentTitle: equipmentTitle,
            attachmentTitle: value(for: .attachment),
            setupTitle: value(for: .setup),
            gripTitle: value(for: .grip),
            sideTitle: value(for: .side),
            loadModeTitle: value(for: .load)
        )
    }

    private var existingExercise: Exercise? {
        guard equipmentTitle != nil else { return nil }
        return exerciseStore.variation(matching: variationSelection)
    }

    private var actionTitle: String {
        if let existingExercise, selection.contains(existingExercise) {
            return "Remove"
        }
        return existingExercise == nil ? "Create and add" : "Add exercise"
    }

    var body: some View {
        Form {
            Section {
                Picker("Equipment", selection: $equipmentChoice) {
                    Text("Choose equipment").tag("")
                    ForEach(ExerciseStore.variationOptions(for: movement).equipment, id: \.self) { equipment in
                        Text(equipment).tag(equipment)
                    }
                    Text("Other").tag(Self.otherValue)
                }
                .pickerStyle(.menu)

                if equipmentChoice == Self.otherValue {
                    TextField("Equipment", text: $customEquipment)
                        .textInputAutocapitalization(.words)
                }
            }

            if equipmentTitle != nil, !visibleAttributes.isEmpty {
                Section {
                    ForEach(visibleAttributes) { attribute in
                        attributePicker(attribute)
                    }
                }
            }

            if equipmentTitle != nil {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(movement.title)
                            .font(.forgeHeadline)
                        Text(variationSelection.summaryTitle)
                            .font(.forgeCaption)
                            .foregroundColor(.forgeSecondaryLabel)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .listStyleCompat_InsetGroupedListStyle()
        .navigationTitle(movement.title)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            if equipmentTitle != nil {
                Button(actionTitle) {
                    performAction()
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, Theme.Spacing.l)
                .padding(.vertical, Theme.Spacing.s)
                .background(.bar)
                .disabled(isSaving)
                .accessibilityValue(existingExercise.map { selection.contains($0) ? "Selected" : "Not selected" } ?? "New variation")
            }
        }
        .onChange(of: equipmentChoice) { _, _ in
            choices.removeAll()
            customValues.removeAll()
        }
        .alert("Variation not created", isPresented: $showingSaveError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text("The variation could not be created. Your exercise selection was not changed.")
        }
    }

    @ViewBuilder
    private func attributePicker(_ attribute: ExerciseVariationAttribute) -> some View {
        Picker(attribute.title, selection: choiceBinding(for: attribute)) {
            Text("Standard").tag("")
            ForEach(options.values(for: attribute), id: \.self) { value in
                Text(value).tag(value)
            }
            Text("Other").tag(Self.otherValue)
        }
        .pickerStyle(.menu)

        if choices[attribute] == Self.otherValue {
            TextField("Custom \(attribute.title.lowercased())", text: customValueBinding(for: attribute))
                .textInputAutocapitalization(.words)
        }
    }

    private func choiceBinding(for attribute: ExerciseVariationAttribute) -> Binding<String> {
        Binding(
            get: { choices[attribute] ?? "" },
            set: { choices[attribute] = $0 }
        )
    }

    private func customValueBinding(for attribute: ExerciseVariationAttribute) -> Binding<String> {
        Binding(
            get: { customValues[attribute] ?? "" },
            set: { customValues[attribute] = $0 }
        )
    }

    private func value(for attribute: ExerciseVariationAttribute) -> String? {
        if choices[attribute] == Self.otherValue {
            return Exercise.cleanVariationField(customValues[attribute])
        }
        return Exercise.cleanVariationField(choices[attribute])
    }

    private func performAction() {
        guard equipmentTitle != nil else { return }
        var transaction = Transaction()
        transaction.animation = nil
        if let existingExercise {
            Haptics.selection()
            withTransaction(transaction) {
                if selection.contains(existingExercise) {
                    selection.remove(existingExercise)
                } else {
                    selection.insert(existingExercise)
                }
            }
            return
        }

        isSaving = true
        defer { isSaving = false }
        do {
            let exercise = try exerciseStore.resolveOrCreateVariation(variationSelection, movementTitle: movement.title)
            withTransaction(transaction) {
                selection.insert(exercise)
            }
            Haptics.success()
        } catch {
            showingSaveError = true
        }
    }
}

#if DEBUG
struct ExerciseMultiSelectionView_Previews: PreviewProvider {
    static var previews: some View {
        ExerciseMultiSelectionView(exerciseGroups: ExerciseStore.splitIntoMuscleGroups(exercises: ExerciseStore.shared.shownExercises), selection: .constant(Set()))
    }
}
#endif
