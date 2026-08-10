//
//  WorkoutTypeViews.swift
//  Forge
//

import SwiftUI
import CoreData
import WorkoutDataKit

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
}

private let workoutTypeColorChoices: [(name: String, hex: String)] = [
    ("Blue", "#3B82F6"),
    ("Green", "#22C55E"),
    ("Red", "#EF4444"),
    ("Orange", "#F97316"),
    ("Purple", "#A855F7"),
    ("Gray", "#6B7280")
]

struct WorkoutTypeLabel: View {
    let title: String
    let colorHex: String

    init(type: WorkoutType?) {
        self.title = type?.displayTitle ?? WorkoutType.fallbackTitle
        self.colorHex = type?.displayColorHex ?? WorkoutType.fallbackColorHex
    }

    init(title: String, colorHex: String) {
        self.title = title
        self.colorHex = colorHex
    }

    var body: some View {
        HStack(spacing: Theme.Spacing.xs) {
            Circle()
                .fill(Color(workoutTypeHex: colorHex))
                .frame(width: 8, height: 8)
            Text(title)
                .font(.forgeCaption)
                .foregroundColor(.forgeSecondaryLabel)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Workout type: \(title)")
    }
}

struct WorkoutTypePickerRow: View {
    @Environment(\.managedObjectContext) private var context
    @FetchRequest(fetchRequest: WorkoutType.fetchRequestSorted()) private var workoutTypes

    let title: String
    @Binding var selection: WorkoutType?

    private var visibleTypes: [WorkoutType] {
        workoutTypes.filter { !$0.isArchived || $0.objectID == selection?.objectID }
    }

    private var fallbackType: WorkoutType? {
        workoutTypes.first { $0.displayTitle.caseInsensitiveCompare(WorkoutType.fallbackTitle) == .orderedSame }
    }

    private var selectedObjectID: Binding<NSManagedObjectID?> {
        Binding(
            get: { selection?.objectID ?? fallbackType?.objectID },
            set: { objectID in
                guard let objectID else {
                    selection = nil
                    return
                }
                selection = (try? context.existingObject(with: objectID)) as? WorkoutType
            }
        )
    }

    var body: some View {
        Picker(title, selection: selectedObjectID) {
            ForEach(visibleTypes, id: \.objectID) { type in
                Label {
                    Text(type.displayTitle)
                } icon: {
                    Circle()
                        .fill(Color(workoutTypeHex: type.displayColorHex))
                }
                .tag(Optional(type.objectID))
            }
        }
    }
}

struct WorkoutTypesSettingsView: View {
    @Environment(\.managedObjectContext) private var context
    @FetchRequest(fetchRequest: WorkoutType.fetchRequestSorted()) private var workoutTypes

    var body: some View {
        List {
            Section {
                ForEach(workoutTypes, id: \.objectID) { type in
                    WorkoutTypeEditorRow(type: type)
                }
                .onMove(perform: move)
            } footer: {
                Text("Archived types stay on old workouts but are hidden from workout pickers.")
            }
        }
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                EditButton()
                Button {
                    addType()
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Add workout type")
            }
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
        var ordered = Array(workoutTypes)
        ordered.move(fromOffsets: source, toOffset: destination)
        for (index, type) in ordered.enumerated() {
            type.sortIndex = Int32(index)
        }
        context.saveOrCrash()
    }
}

private struct WorkoutTypeEditorRow: View {
    @Environment(\.managedObjectContext) private var context
    @ObservedObject var type: WorkoutType

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s) {
            TextField("Title", text: Binding(
                get: { type.title ?? "" },
                set: { type.title = $0 }
            ))
            .onSubmit { context.saveOrCrash() }

            Picker("Color", selection: Binding(
                get: { type.displayColorHex },
                set: { type.colorHex = $0; context.saveOrCrash() }
            )) {
                ForEach(workoutTypeColorChoices, id: \.hex) { choice in
                    Label(choice.name, systemImage: "circle.fill")
                        .foregroundColor(Color(workoutTypeHex: choice.hex))
                        .tag(choice.hex)
                }
            }

            Toggle("Archived", isOn: Binding(
                get: { type.isArchived },
                set: { type.isArchived = $0; context.saveOrCrash() }
            ))
        }
        .onDisappear { context.saveOrCrash() }
    }
}
