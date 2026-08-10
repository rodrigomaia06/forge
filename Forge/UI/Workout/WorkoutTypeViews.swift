//
//  WorkoutTypeViews.swift
//  Forge
//

import SwiftUI
import CoreData
import WorkoutDataKit
import UIKit

extension Color {
    init(workoutTypeHex hex: String) {
        var raw = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        if raw.count == 3 {
            raw = raw.map { "\($0)\($0)" }.joined()
        }
        var value: UInt64 = 0
        Scanner(string: raw).scanHexInt64(&value)
        let red = Double((value >> 16) & 0xff) / 255
        let green = Double((value >> 8) & 0xff) / 255
        let blue = Double(value & 0xff) / 255
        self = Color(red: red, green: green, blue: blue)
    }

    var workoutTypeHex: String {
        let uiColor = UIColor(self)
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        guard uiColor.getRed(&red, green: &green, blue: &blue, alpha: &alpha) else {
            return WorkoutType.fallbackColorHex
        }
        return String(
            format: "#%02X%02X%02X",
            Int(red * 255),
            Int(green * 255),
            Int(blue * 255)
        )
    }
}

private let workoutTypeColorChoices: [(name: String, hex: String)] = [
    ("Blue", "#7C8CF8"),
    ("Green", "#6BD48F"),
    ("Red", "#F27D7D"),
    ("Orange", "#F4A261"),
    ("Purple", "#B78AF0"),
    ("Gray", "#9CA3AF")
]

struct WorkoutTypeLabel: View {
    let title: String

    init(type: WorkoutType?) {
        self.title = type?.displayTitle ?? WorkoutType.fallbackTitle
    }

    init(title: String, colorHex: String) {
        self.title = title
    }

    var body: some View {
        Text(title)
            .font(.forgeCaption)
            .foregroundColor(.forgeSecondaryLabel)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Workout type: \(title)")
    }
}

struct WorkoutTypePickerRow: View {
    @State private var showingSelection = false

    let title: String
    @Binding var selection: WorkoutType?

    private var selectedTitle: String {
        selection?.displayTitle ?? "None"
    }

    var body: some View {
        Button {
            showingSelection = true
        } label: {
            HStack {
                Text(title)
                    .foregroundColor(.forgeLabel)
                Spacer()
                Text(selectedTitle)
                    .foregroundColor(.forgeSecondaryLabel)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title), \(selectedTitle)")
        .sheet(isPresented: $showingSelection) {
            NavigationStack {
                WorkoutTypeSelectionView(title: title, selection: $selection)
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
    }
}

private struct WorkoutTypeSelectionView: View {
    @Environment(\.dismiss) private var dismiss
    @FetchRequest(fetchRequest: WorkoutType.fetchRequestSorted()) private var workoutTypes

    let title: String
    @Binding var selection: WorkoutType?

    private var visibleTypes: [WorkoutType] {
        workoutTypes.filter { !$0.isArchived || $0.objectID == selection?.objectID }
    }

    var body: some View {
        List {
            Section {
                Button {
                    selection = nil
                    dismiss()
                } label: {
                    HStack {
                        Text("None")
                            .foregroundColor(.forgeLabel)
                        Spacer()
                        if selection == nil {
                            Image(systemName: "checkmark")
                                .foregroundColor(.forgeAccent)
                                .accessibilityLabel("Selected")
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                ForEach(visibleTypes, id: \.objectID) { type in
                    Button {
                        selection = type
                        dismiss()
                    } label: {
                        HStack(spacing: Theme.Spacing.m) {
                            colorSwatch(type.displayColorHex)
                            Text(type.displayTitle)
                                .foregroundColor(.forgeLabel)
                            Spacer()
                            if selection?.objectID == type.objectID {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.forgeAccent)
                                    .accessibilityLabel("Selected")
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .navigationBarTitle(title, displayMode: .inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Done") { dismiss() }
            }
        }
    }
}

struct WorkoutTypesSettingsView: View {
    @Environment(\.managedObjectContext) private var context
    @FetchRequest(fetchRequest: WorkoutType.fetchRequestSorted()) private var workoutTypes
    @State private var editMode: EditMode = .inactive

    private var activeTypes: [WorkoutType] {
        workoutTypes.filter { !$0.isArchived }
    }

    var body: some View {
        List {
            Section {
                ForEach(activeTypes, id: \.objectID) { type in
                    NavigationLink(destination: WorkoutTypeEditorView(type: type)) {
                        WorkoutTypeSettingsRow(type: type)
                    }
                }
                .onMove(perform: move)
                .onDelete(perform: delete)
            } footer: {
                Text("Deleting a type hides it from new workouts. Used types stay on existing workouts.")
            }
        }
        .environment(\.editMode, $editMode)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button(editMode.isEditing ? "Done" : "Edit") {
                    withAnimation(.snappy(duration: 0.2)) {
                        editMode = editMode.isEditing ? .inactive : .active
                    }
                }
                Button {
                    addType()
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Add workout type")
            }
        }
        .onDisappear {
            editMode = .inactive
        }
        .navigationBarTitle("Workout types", displayMode: .inline)
    }

    private func addType() {
        let type = WorkoutType.create(context: context)
        type.title = "New type"
        type.colorHex = WorkoutType.fallbackColorHex
        type.sortIndex = ((workoutTypes.map(\.sortIndex).max()) ?? -1) + 1
        context.saveOrCrash()
    }

    private func move(from source: IndexSet, to destination: Int) {
        var ordered = activeTypes
        ordered.move(fromOffsets: source, toOffset: destination)
        for (index, type) in ordered.enumerated() {
            type.sortIndex = Int32(index)
        }
        context.saveOrCrash()
    }

    private func delete(at offsets: IndexSet) {
        let ordered = activeTypes
        for index in offsets {
            ordered[index].deleteOrArchive(in: context)
        }
        reindexVisibleTypes()
        context.saveOrCrash()
    }

    private func reindexVisibleTypes() {
        for (index, type) in activeTypes.filter({ !$0.isDeleted }).enumerated() {
            type.sortIndex = Int32(index)
        }
    }
}

private struct WorkoutTypeSettingsRow: View {
    @ObservedObject var type: WorkoutType

    var body: some View {
        HStack(spacing: Theme.Spacing.m) {
            colorSwatch(type.displayColorHex)
            Text(type.displayTitle)
            if type.isArchived {
                Text("Archived")
                    .font(.forgeCaption)
                    .foregroundColor(.forgeSecondaryLabel)
            }
        }
    }
}

private struct WorkoutTypeEditorView: View {
    @Environment(\.managedObjectContext) private var context
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var type: WorkoutType

    private var selectedColor: Binding<Color> {
        Binding(
            get: { Color(workoutTypeHex: type.displayColorHex) },
            set: {
                type.colorHex = $0.workoutTypeHex
                context.saveOrCrash()
            }
        )
    }

    var body: some View {
        List {
            Section {
                TextField("Title", text: Binding(
                    get: { type.title ?? "" },
                    set: { type.title = $0 }
                ))
                .onSubmit { context.saveOrCrash() }
            }

            Section(header: Text("Color")) {
                ColorPicker("Custom color", selection: selectedColor, supportsOpacity: false)

                ForEach(workoutTypeColorChoices, id: \.hex) { choice in
                    Button {
                        type.colorHex = choice.hex
                        context.saveOrCrash()
                    } label: {
                        HStack(spacing: Theme.Spacing.m) {
                            colorSwatch(choice.hex)
                            Text(choice.name)
                                .foregroundColor(.forgeLabel)
                            Spacer()
                            if type.displayColorHex == choice.hex {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.forgeAccent)
                                    .accessibilityLabel("Selected")
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }

            Section {
                Toggle("Archived", isOn: Binding(
                    get: { type.isArchived },
                    set: { type.isArchived = $0; context.saveOrCrash() }
                ))
            } footer: {
                Text("Archived types stay on old workouts but are hidden from workout pickers.")
            }

            Section {
                Button(role: .destructive) {
                    type.deleteOrArchive(in: context)
                    context.saveOrCrash()
                    dismiss()
                } label: {
                    Text(type.isDefaultPreset || type.hasUserDataReferences ? "Archive type" : "Delete type")
                }
            } footer: {
                if type.isDefaultPreset || type.hasUserDataReferences {
                    Text("Archived types stay on existing workouts but are hidden from pickers.")
                }
            }
        }
        .scrollContentBackground(.hidden)
        .onDisappear { context.saveOrCrash() }
        .navigationBarTitle(type.displayTitle, displayMode: .inline)
    }
}

@ViewBuilder
private func colorSwatch(_ hex: String) -> some View {
    Circle()
        .fill(Color(workoutTypeHex: hex))
        .frame(width: 14, height: 14)
        .accessibilityHidden(true)
}
