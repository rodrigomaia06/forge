//
//  FeedView.swift
//  Forge
//
//  The Home dashboard: greeting, an activity calendar (a month grid whose days can be
//  selected, expandable to a year of month grids), and a compact monthly training mix.
//  The chosen day/month filter persists while the app is open (the page stays alive) and
//  clears only via the clear button or relaunch.
//

import SwiftUI
import CoreData
import WorkoutDataKit

private enum ActivityFilter: Equatable {
    case day(Date)
    case month(year: Int, month: Int)
}

struct FeedView: View {
    @Environment(\.managedObjectContext) private var context
    @EnvironmentObject private var settingsStore: SettingsStore
    @EnvironmentObject private var exerciseStore: ExerciseStore
    @EnvironmentObject private var sceneState: SceneState

    @FetchRequest private var workouts: FetchedResults<Workout>
    @FetchRequest(fetchRequest: Workout.currentWorkoutFetchRequest) private var currentWorkouts: FetchedResults<Workout>
    @State private var calendarExpanded = false
    @State private var filter: ActivityFilter?
    /// When set (from the year view), the calendar drills into this single month's detailed grid.
    @State private var zoomedMonth: MonthRef?
    @State private var activityIndex = ActivityIndex()

    private struct MonthRef: Equatable { let year: Int; let month: Int }
    private struct WorkoutActivityInput: Equatable {
        let objectURI: URL
        let start: Date?
        let workoutTypeURI: URL?
        let workoutTypeTitle: String
        let workoutTypeColorHex: String
    }

    /// Calendar.current copies the whole calendar on each access, so this is read once per render
    /// (into `body`) and passed down, never from inside a loop over the workouts.
    private var cal: Calendar {
        var c = Calendar.current
        c.firstWeekday = settingsStore.firstWeekday
        return c
    }

    /// One pass over the fetched workouts, so the dashboard walks the history once per render rather
    /// than once per stat tile, once per month grid (twelve times over with the year open), once more
    /// for the accessibility labels, and again for the list. With `fetchBatchSize = 20`, each of those
    /// passes was also a SQL round trip every twenty rows, so the cost grew with the user's history.
    private struct ActivityIndex {
        struct TypeSummary: Hashable {
            let title: String
            let colorHex: String
            let count: Int
            let duration: TimeInterval
        }

        private struct TypeKey: Hashable {
            let title: String
            let colorHex: String
        }

        /// Days of the month that have a workout, keyed by `year * 12 + month`.
        private(set) var daysByMonth: [Int: Set<Int>] = [:]
        /// Number of workouts in each month, keyed the same way.
        private(set) var countsByMonth: [Int: Int] = [:]
        private(set) var durationsByMonth: [Int: TimeInterval] = [:]
        private var countsByDay: [Int: Int] = [:]
        private var durationsByDay: [Int: TimeInterval] = [:]
        private var typeCountsByDay: [Int: [TypeKey: Int]] = [:]
        private var typeDurationsByDay: [Int: [TypeKey: TimeInterval]] = [:]
        private var typeCountsByMonth: [Int: [TypeKey: Int]] = [:]
        private var typeDurationsByMonth: [Int: [TypeKey: TimeInterval]] = [:]
        private(set) var thisWeek = 0

        static func key(year: Int, month: Int) -> Int { year * 12 + month }
        static func dayKey(year: Int, month: Int, day: Int) -> Int { year * 10_000 + month * 100 + day }

        init() { }

        init(workouts: FetchedResults<Workout>, calendar: Calendar, now: Date) {
            for workout in workouts {
                guard let start = workout.start else { continue }
                let parts = calendar.dateComponents([.year, .month, .day], from: start)
                guard let year = parts.year, let month = parts.month, let day = parts.day else { continue }
                let key = Self.key(year: year, month: month)
                let dayKey = Self.dayKey(year: year, month: month, day: day)
                let typeKey = TypeKey(
                    title: workout.workoutType?.displayTitle ?? WorkoutType.fallbackTitle,
                    colorHex: workout.workoutType?.displayColorHex ?? WorkoutType.fallbackColorHex
                )
                daysByMonth[key, default: []].insert(day)
                countsByMonth[key, default: 0] += 1
                countsByDay[dayKey, default: 0] += 1
                if let duration = workout.duration {
                    durationsByMonth[key, default: 0] += duration
                    durationsByDay[dayKey, default: 0] += duration
                    typeDurationsByMonth[key, default: [:]][typeKey, default: 0] += duration
                    typeDurationsByDay[dayKey, default: [:]][typeKey, default: 0] += duration
                }
                typeCountsByDay[dayKey, default: [:]][typeKey, default: 0] += 1
                typeCountsByMonth[key, default: [:]][typeKey, default: 0] += 1
                if calendar.isDate(start, equalTo: now, toGranularity: .weekOfYear) { thisWeek += 1 }
            }
        }

        func days(inMonthOf date: Date, calendar: Calendar) -> Set<Int> {
            let parts = calendar.dateComponents([.year, .month], from: date)
            guard let year = parts.year, let month = parts.month else { return [] }
            return daysByMonth[Self.key(year: year, month: month)] ?? []
        }

        func count(year: Int, month: Int) -> Int {
            countsByMonth[Self.key(year: year, month: month)] ?? 0
        }

        func duration(year: Int, month: Int) -> TimeInterval {
            durationsByMonth[Self.key(year: year, month: month)] ?? 0
        }

        func count(for date: Date, calendar: Calendar) -> Int {
            let parts = calendar.dateComponents([.year, .month, .day], from: date)
            guard let year = parts.year, let month = parts.month, let day = parts.day else { return 0 }
            return countsByDay[Self.dayKey(year: year, month: month, day: day)] ?? 0
        }

        func duration(for date: Date, calendar: Calendar) -> TimeInterval {
            let parts = calendar.dateComponents([.year, .month, .day], from: date)
            guard let year = parts.year, let month = parts.month, let day = parts.day else { return 0 }
            return durationsByDay[Self.dayKey(year: year, month: month, day: day)] ?? 0
        }

        func days(year: Int, month: Int) -> Set<Int> {
            daysByMonth[Self.key(year: year, month: month)] ?? []
        }

        func typeSummaries(for date: Date, calendar: Calendar) -> [TypeSummary] {
            let parts = calendar.dateComponents([.year, .month, .day], from: date)
            guard let year = parts.year, let month = parts.month, let day = parts.day else { return [] }
            let counts = typeCountsByDay[Self.dayKey(year: year, month: month, day: day)] ?? [:]
            let durations = typeDurationsByDay[Self.dayKey(year: year, month: month, day: day)] ?? [:]
            return sortedTypeSummaries(counts: counts, durations: durations)
        }

        func typeSummaries(year: Int, month: Int) -> [TypeSummary] {
            let key = Self.key(year: year, month: month)
            return sortedTypeSummaries(
                counts: typeCountsByMonth[key] ?? [:],
                durations: typeDurationsByMonth[key] ?? [:]
            )
        }

        private func sortedTypeSummaries(counts: [TypeKey: Int], durations: [TypeKey: TimeInterval]) -> [TypeSummary] {
            return counts
                .map { TypeSummary(title: $0.key.title, colorHex: $0.key.colorHex, count: $0.value, duration: durations[$0.key] ?? 0) }
                .sorted {
                    if $0.count != $1.count { return $0.count > $1.count }
                    return $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
                }
        }
    }

    init() {
        let request: NSFetchRequest<Workout> = Workout.fetchRequest()
        request.predicate = NSPredicate(format: "\(#keyPath(Workout.isCurrentWorkout)) != %@", NSNumber(value: true))
        request.sortDescriptors = [NSSortDescriptor(keyPath: \Workout.start, ascending: false)]
        request.fetchBatchSize = 20
        _workouts = FetchRequest(fetchRequest: request)
    }

    // Shared date formatters, so the dashboard does not allocate a new DateFormatter on every render.
    private static let monthYearFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "MMMM yyyy"; return f
    }()
    private static let fullDayFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateStyle = .full; f.timeStyle = .none; return f
    }()
    var body: some View {
        let calendar = cal
        let index = activityIndex
        return NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                    header
                    activitySection(index, calendar: calendar)
                    dashboardPanel(index, calendar: calendar)
                }
                .padding(.horizontal, Theme.Spacing.l)
                .padding(.top, Theme.Spacing.xxl)
                .padding(.bottom, Theme.Spacing.l)
            }
            .background(Color.forgeBackground.ignoresSafeArea())
            // Keep the custom greeting header; the nav bar only appears on pushed detail screens.
            .toolbar(.hidden, for: .navigationBar)
        }
        .onAppear { rebuildActivityIndex(calendar: calendar) }
        .onChange(of: workoutActivityInputs) { _, _ in rebuildActivityIndex(calendar: calendar) }
        .onChange(of: settingsStore.firstWeekday) { _, _ in rebuildActivityIndex(calendar: cal) }
        .onChange(of: settingsStore.showPlanInWorkoutTitle) { _, _ in rebuildActivityIndex(calendar: cal) }
    }

    private var workoutActivityInputs: [WorkoutActivityInput] {
        workouts.map {
            WorkoutActivityInput(
                objectURI: $0.objectID.uriRepresentation(),
                start: $0.start,
                workoutTypeURI: $0.workoutType?.objectID.uriRepresentation(),
                workoutTypeTitle: $0.workoutType?.displayTitle ?? WorkoutType.fallbackTitle,
                workoutTypeColorHex: $0.workoutType?.displayColorHex ?? WorkoutType.fallbackColorHex
            )
        }
    }

    private func rebuildActivityIndex(calendar: Calendar) {
        activityIndex = ActivityIndex(
            workouts: workouts,
            calendar: calendar,
            now: Date()
        )
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .center) {
            Text(greeting).font(.forgeGreeting).foregroundColor(.forgeLabel)
            Spacer()
            Button {
                Haptics.impact()
                sceneState.selectedTab = .workout
            } label: {
                Image(systemName: "plus")
                    .imageScale(.large)
                    .frame(width: 44, height: 44)
                    .contentShape(Circle())
                    .forgeGlassCircle()
            }
            .accessibilityLabel("Start workout")
        }
    }

    private var greeting: String {
        switch cal.component(.hour, from: Date()) {
        case 5..<12: return "Good morning"
        case 12..<18: return "Good afternoon"
        default: return "Good evening"
        }
    }

    // MARK: Activity calendar (month <-> year)

    private func toggle(_ f: ActivityFilter) {
        Haptics.selection()
        withAnimation(.snappy(duration: 0.2)) {
            filter = (filter == f) ? nil : f
        }
    }

    private func activitySection(_ index: ActivityIndex, calendar: Calendar) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.m) {
            activityHeader

            if let zoom = zoomedMonth {
                monthGrid(firstOfMonth: firstOf(year: zoom.year, month: zoom.month), index: index, calendar: calendar)
            } else if calendarExpanded {
                yearCalendar(index, calendar: calendar)
            } else {
                monthGrid(firstOfMonth: currentFirstOfMonth, index: index, calendar: calendar)
            }

            if let summary = activitySummaryText(index, calendar: calendar) {
                HStack(spacing: Theme.Spacing.s) {
                    Text(summary)
                        .font(.forgeCaption)
                        .foregroundColor(.forgeSecondaryLabel)
                    Spacer(minLength: Theme.Spacing.s)
                    if filter != nil {
                        Button {
                            withAnimation(.snappy(duration: 0.2)) { filter = nil }
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.callout)
                                .foregroundColor(.forgeSecondaryLabel)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Clear filter")
                    }
                }
                .padding(.top, Theme.Spacing.xxs)
            }
        }
    }

    @ViewBuilder
    private var activityHeader: some View {
        if let zoom = zoomedMonth {
            // Zoomed into a single month: the header becomes a back affordance to the year.
            Button {
                Haptics.selection()
                withAnimation(.snappy(duration: 0.28)) { zoomedMonth = nil }
            } label: {
                HStack(spacing: Theme.Spacing.xs) {
                    Image(systemName: "chevron.left").font(.caption.weight(.semibold))
                    Text(monthTitle(zoom).uppercased()).font(.forgeSectionLabel).tracking(2)
                    Spacer()
                }
                .foregroundColor(.forgeSecondaryLabel)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back to year")
        } else {
            Button {
                withAnimation(.snappy(duration: 0.28)) { calendarExpanded.toggle() }
            } label: {
                HStack {
                    Text(calendarExpanded ? "ACTIVITY \(yearString)" : monthString)
                        .font(.forgeSectionLabel).tracking(2)
                        .foregroundColor(.forgeSecondaryLabel)
                    Spacer()
                    Image(systemName: calendarExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.forgeSecondaryLabel)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    private var currentFirstOfMonth: Date {
        cal.date(from: cal.dateComponents([.year, .month], from: Date())) ?? Date()
    }

    private func firstOf(year: Int, month: Int) -> Date {
        cal.date(from: DateComponents(year: year, month: month, day: 1)) ?? Date()
    }

    private func monthTitle(_ ref: MonthRef) -> String {
        return Self.monthYearFormatter.string(from: firstOf(year: ref.year, month: ref.month))
    }

    private var monthString: String {
        return Self.monthYearFormatter.string(from: Date()).uppercased()
    }

    private var yearString: String { String(cal.component(.year, from: Date())) }

    private func activitySummaryText(_ index: ActivityIndex, calendar: Calendar) -> String? {
        switch filter {
        case .day(let date):
            return summaryText(count: index.count(for: date, calendar: calendar), duration: index.duration(for: date, calendar: calendar))
        case .month(let year, let month):
            return summaryText(count: index.count(year: year, month: month), duration: index.duration(year: year, month: month))
        case nil:
            let parts = calendar.dateComponents([.year, .month], from: Date())
            guard let year = parts.year, let month = parts.month else { return nil }
            return summaryText(count: index.count(year: year, month: month), duration: index.duration(year: year, month: month))
        }
    }

    private func summaryText(count: Int, duration: TimeInterval) -> String? {
        guard count > 0 else { return nil }
        let workoutText = count == 1 ? "1 workout" : "\(count) workouts"
        guard duration > 0, let durationText = Workout.durationFormatter.string(from: duration) else {
            return workoutText
        }
        return "\(workoutText) · \(durationText)"
    }

    private func weekdaySymbols(_ calendar: Calendar) -> [String] {
        let syms = calendar.veryShortStandaloneWeekdaySymbols
        let start = calendar.firstWeekday - 1
        return Array(syms[start...] + syms[..<start])
    }

    private func monthGrid(firstOfMonth: Date, index: ActivityIndex, calendar: Calendar) -> some View {
        let firstWeekday = (calendar.component(.weekday, from: firstOfMonth) - calendar.firstWeekday + 7) % 7
        let daysInMonth = calendar.range(of: .day, in: .month, for: firstOfMonth)?.count ?? 30
        let rows = Int(ceil(Double(firstWeekday + daysInMonth) / 7.0))

        return VStack(spacing: Theme.Spacing.xs) {
            HStack(spacing: 0) {
                ForEach(weekdaySymbols(calendar), id: \.self) { s in
                    Text(s).font(.system(size: 10, weight: .medium)).foregroundColor(.forgeSecondaryLabel).frame(maxWidth: .infinity)
                }
            }
            ForEach(0..<rows, id: \.self) { row in
                HStack(spacing: 0) {
                    ForEach(0..<7, id: \.self) { col in
                        let day = row * 7 + col - firstWeekday + 1
                        dayCell(day: day, valid: day >= 1 && day <= daysInMonth, firstOfMonth: firstOfMonth, index: index, calendar: calendar)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func dayCell(day: Int, valid: Bool, firstOfMonth: Date, index: ActivityIndex, calendar: Calendar) -> some View {
        if valid, let date = calendar.date(byAdding: .day, value: day - 1, to: firstOfMonth) {
            let isSelected = filter == .day(date)
            let typeSummaries = index.typeSummaries(for: date, calendar: calendar)
            let active = !typeSummaries.isEmpty
            Button {
                if active {
                    filter = .day(date)
                    openHistoryDate(date)
                } else {
                    toggle(.day(date))
                }
            } label: {
                VStack(spacing: 2) {
                    Text("\(day)")
                        .font(.system(size: 13, weight: active || isSelected ? .semibold : .regular))
                        .foregroundColor(isSelected ? .forgeBackground : (active ? .forgeLabel : .forgeSecondaryLabel))
                        .frame(height: 18)
                    HStack(spacing: 2) {
                        ForEach(Array(typeSummaries.prefix(3)), id: \.self) { summary in
                            Circle()
                                .fill(Color(workoutTypeHex: summary.colorHex))
                                .frame(width: 4, height: 4)
                        }
                    }
                    .frame(height: 5)
                }
                .frame(width: 34, height: 34)
                .background(Circle().fill(isSelected ? Color.forgeAccent : (active ? Color.forgeSurface : Color.clear)))
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(dayAccessibilityLabel(date, typeSummaries: typeSummaries))
            .accessibilityAddTraits(isSelected ? [.isSelected] : [])
        } else {
            Color.clear.frame(height: 34).frame(maxWidth: .infinity)
                .accessibilityHidden(true)
        }
    }

    private func dayAccessibilityLabel(_ date: Date, typeSummaries: [ActivityIndex.TypeSummary]) -> String {
        let day = Self.fullDayFormatter.string(from: date)
        guard !typeSummaries.isEmpty else { return "\(day), no workout" }
        let workoutCount = typeSummaries.reduce(0) { $0 + $1.count }
        let countText = workoutCount == 1 ? "1 workout" : "\(workoutCount) workouts"
        let typeText = typeSummaries
            .map { summary in
                summary.count == 1 ? summary.title : "\(summary.count) \(summary.title)"
            }
            .joined(separator: ", ")
        return "\(day), \(countText): \(typeText)"
    }

    // The full year as smaller, tappable month grids (4 per row).
    private func yearCalendar(_ index: ActivityIndex, calendar: Calendar) -> some View {
        let year = calendar.component(.year, from: Date())
        let columns = Array(repeating: GridItem(.flexible(), spacing: Theme.Spacing.m), count: 4)
        return LazyVGrid(columns: columns, alignment: .leading, spacing: Theme.Spacing.l) {
            ForEach(1...12, id: \.self) { month in
                Button {
                    Haptics.selection()
                    withAnimation(.snappy(duration: 0.28)) {
                        zoomedMonth = MonthRef(year: year, month: month)
                        filter = .month(year: year, month: month)
                    }
                } label: {
                    miniMonth(year: year, month: month, selected: filter == .month(year: year, month: month), index: index, calendar: calendar)
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(monthAccessibilityLabel(year: year, month: month, index: index, calendar: calendar))
            }
        }
    }

    private func monthAccessibilityLabel(year: Int, month: Int, index: ActivityIndex, calendar: Calendar) -> String {
        let name = calendar.standaloneMonthSymbols[month - 1]
        let count = index.count(year: year, month: month)
        let workoutText = count == 1 ? "1 workout" : "\(count) workouts"
        return "\(name) \(year), \(workoutText)"
    }

    private func miniMonth(year: Int, month: Int, selected: Bool, index: ActivityIndex, calendar: Calendar) -> some View {
        let firstOfMonth = calendar.date(from: DateComponents(year: year, month: month, day: 1)) ?? Date()
        let firstWeekday = (calendar.component(.weekday, from: firstOfMonth) - calendar.firstWeekday + 7) % 7
        let daysInMonth = calendar.range(of: .day, in: .month, for: firstOfMonth)?.count ?? 30
        let active = index.days(year: year, month: month)
        let rows = Int(ceil(Double(firstWeekday + daysInMonth) / 7.0))
        return VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Text(calendar.shortStandaloneMonthSymbols[month - 1].uppercased())
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(selected ? .forgeLabel : .forgeSecondaryLabel)
            VStack(spacing: 1.5) {
                ForEach(0..<rows, id: \.self) { row in
                    HStack(spacing: 1.5) {
                        ForEach(0..<7, id: \.self) { col in
                            let day = row * 7 + col - firstWeekday + 1
                            let valid = day >= 1 && day <= daysInMonth
                            RoundedRectangle(cornerRadius: 1, style: .continuous)
                                .fill(valid ? (active.contains(day) ? Color.forgeAccent : Color.forgeSurface) : Color.clear)
                                .aspectRatio(1, contentMode: .fit)
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
        }
        .padding(Theme.Spacing.xs)
        .background(RoundedRectangle(cornerRadius: Theme.Radius.small, style: .continuous)
            .strokeBorder(selected ? Color.forgeAccent : Color.clear, lineWidth: 1))
    }

    // MARK: Monthly mix

    @ViewBuilder
    private func dashboardPanel(_ index: ActivityIndex, calendar: Calendar) -> some View {
        if let currentWorkout = currentWorkouts.first {
            activeWorkoutPanel(currentWorkout)
        } else if case .day(let date) = filter {
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                selectedDayPanel(date, index: index, calendar: calendar)
                monthlyMixPanel(index, calendar: calendar)
            }
        } else {
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                lastWorkoutPanel
                monthlyMixPanel(index, calendar: calendar)
            }
        }
    }

    private func activeWorkoutPanel(_ workout: Workout) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.m) {
            panelTitle("Workout in progress")
            panelCard(colorHex: workout.workoutType?.displayColorHex ?? WorkoutType.fallbackColorHex) {
                TimelineView(.periodic(from: Date(), by: 60)) { context in
                    let elapsed = max(0, context.date.timeIntervalSince(workout.safeStart))
                    VStack(alignment: .leading, spacing: Theme.Spacing.s) {
                        Text(workout.displayTitle(in: exerciseStore.exercises, showPlan: settingsStore.showPlanInWorkoutTitle))
                            .font(.forgeHeadline)
                            .foregroundColor(.forgeLabel)
                            .lineLimit(2)
                        panelMeta([
                            workout.workoutType?.displayTitle ?? WorkoutType.fallbackTitle,
                            Workout.durationFormatter.string(from: elapsed) ?? "In progress"
                        ])
                        dashboardActionButton("Continue", systemImage: "arrow.right") {
                            sceneState.selectedTab = .workout
                        }
                    }
                }
            }
        }
    }

    private func monthlyMixPanel(_ index: ActivityIndex, calendar: Calendar) -> some View {
        let month = mixMonth(calendar)
        let typeSummaries = index.typeSummaries(year: month.year, month: month.month)
        return VStack(alignment: .leading, spacing: Theme.Spacing.m) {
            HStack(alignment: .firstTextBaseline) {
                panelTitle("By type")
                Spacer()
                if index.thisWeek > 0 {
                    Text(index.thisWeek == 1 ? "1 this week" : "\(index.thisWeek) this week")
                        .font(.forgeCaption)
                        .foregroundColor(.forgeSecondaryLabel)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }
            }
            VStack(alignment: .leading, spacing: Theme.Spacing.s) {
                mixStrip(typeSummaries)
                if typeSummaries.isEmpty {
                    Text("No workouts logged")
                        .font(.forgeCaption)
                        .foregroundColor(.forgeSecondaryLabel)
                } else {
                    typeBreakdown(typeSummaries)
                }
            }
            .padding(.horizontal, Theme.Spacing.s)
        }
    }

    private func selectedDayPanel(_ date: Date, index: ActivityIndex, calendar: Calendar) -> some View {
        let dayWorkouts = workouts(on: date, calendar: calendar)
        return VStack(alignment: .leading, spacing: Theme.Spacing.m) {
            HStack(alignment: .firstTextBaseline) {
                panelTitle("Selected day")
                Spacer()
                Text(Self.fullDayFormatter.string(from: date))
                    .font(.forgeCaption)
                    .foregroundColor(.forgeSecondaryLabel)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }

            if dayWorkouts.isEmpty {
                panelCard {
                    VStack(alignment: .leading, spacing: Theme.Spacing.s) {
                        Text("No workout logged")
                            .font(.forgeHeadline)
                            .foregroundColor(.forgeLabel)
                        panelMeta(["Nothing saved for this day"])
                        dashboardActionButton("Start workout", systemImage: "plus") {
                            sceneState.selectedTab = .workout
                        }
                    }
                }
            } else if dayWorkouts.count == 1, let workout = dayWorkouts.first {
                workoutLinkPanel(workout)
            } else {
                let summaries = index.typeSummaries(for: date, calendar: calendar)
                panelCard {
                    VStack(alignment: .leading, spacing: Theme.Spacing.s) {
                        Text(dayWorkouts.count == 1 ? "1 workout" : "\(dayWorkouts.count) workouts")
                            .font(.forgeHeadline)
                            .foregroundColor(.forgeLabel)
                        panelMeta([
                            Workout.durationFormatter.string(from: index.duration(for: date, calendar: calendar)) ?? "",
                            summaries.map(\.title).prefix(3).joined(separator: " · ")
                        ])
                        dashboardActionButton("Open in History", systemImage: "clock.arrow.circlepath") {
                            openHistoryDate(date)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var lastWorkoutPanel: some View {
        if let workout = workouts.first {
            VStack(alignment: .leading, spacing: Theme.Spacing.m) {
                panelTitle("Last workout")
                workoutLinkPanel(workout)
            }
        }
    }

    private func workoutLinkPanel(_ workout: Workout) -> some View {
        Button {
            Haptics.selection()
            openHistoryWorkout(workout)
        } label: {
            panelCard(colorHex: workout.workoutType?.displayColorHex ?? WorkoutType.fallbackColorHex) {
                VStack(alignment: .leading, spacing: Theme.Spacing.s) {
                    Text(workout.displayTitle(in: exerciseStore.exercises, showPlan: settingsStore.showPlanInWorkoutTitle))
                        .font(.forgeHeadline)
                        .foregroundColor(.forgeLabel)
                        .lineLimit(2)
                    panelMeta([
                        workout.workoutType?.displayTitle ?? WorkoutType.fallbackTitle,
                        workoutDateText(workout.start),
                        workout.duration.flatMap { Workout.durationFormatter.string(from: $0) } ?? "",
                        workoutExerciseSummary(workout)
                    ])
                    exerciseBreakdown(workout)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open workout")
    }

    private func workouts(on date: Date, calendar: Calendar) -> [Workout] {
        let start = calendar.startOfDay(for: date)
        let end = calendar.date(byAdding: .day, value: 1, to: start) ?? start
        return Array(workouts.filter { workout in
            guard let workoutStart = workout.start else { return false }
            return workoutStart >= start && workoutStart < end
        })
    }

    private func workoutDateText(_ date: Date?) -> String {
        guard let date else { return "" }
        return date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }

    private func workoutExerciseSummary(_ workout: Workout) -> String {
        let exercises = workout.workoutExercises?.array as? [WorkoutExercise] ?? []
        guard !exercises.isEmpty else { return "" }
        let setCount = exercises.reduce(0) { $0 + ($1.workoutSets?.count ?? 0) }
        let exerciseText = exercises.count == 1 ? "1 exercise" : "\(exercises.count) exercises"
        let setText = setCount == 1 ? "1 set" : "\(setCount) sets"
        return "\(exerciseText) · \(setText)"
    }

    private func exerciseBreakdown(_ workout: Workout) -> some View {
        let exercises = workout.workoutExercises?.array as? [WorkoutExercise] ?? []
        return VStack(alignment: .leading, spacing: Theme.Spacing.xxs) {
            ForEach(Array(exercises.prefix(3).enumerated()), id: \.offset) { _, workoutExercise in
                HStack(spacing: Theme.Spacing.s) {
                    Text(workoutExercise.exercise(in: exerciseStore.exercises)?.title ?? "Exercise")
                        .font(.forgeCaption)
                        .foregroundColor(.forgeSecondaryLabel)
                        .lineLimit(1)
                    Spacer(minLength: Theme.Spacing.s)
                    Text(setCountText(workoutExercise.workoutSets?.count ?? 0))
                        .font(.forgeCaption)
                        .foregroundColor(.forgeSecondaryLabel)
                        .lineLimit(1)
                }
            }
            if exercises.count > 3 {
                Text("\(exercises.count - 3) more")
                    .font(.forgeCaption)
                    .foregroundColor(.forgeSecondaryLabel)
            }
        }
    }

    private func setCountText(_ count: Int) -> String {
        count == 1 ? "1 set" : "\(count) sets"
    }

    private func mixMonth(_ calendar: Calendar) -> MonthRef {
        if let zoom = zoomedMonth { return zoom }
        if case .month(let year, let month) = filter {
            return MonthRef(year: year, month: month)
        }
        let parts = calendar.dateComponents([.year, .month], from: Date())
        return MonthRef(year: parts.year ?? calendar.component(.year, from: Date()), month: parts.month ?? calendar.component(.month, from: Date()))
    }

    private func mixStrip(_ summaries: [ActivityIndex.TypeSummary]) -> some View {
        let total = summaries.reduce(0) { $0 + $1.count }
        return GeometryReader { proxy in
            HStack(spacing: 2) {
                if summaries.isEmpty || total == 0 {
                    Capsule(style: .continuous)
                        .fill(Color.forgeSeparator)
                } else {
                    ForEach(summaries, id: \.self) { summary in
                        Capsule(style: .continuous)
                            .fill(Color(workoutTypeHex: summary.colorHex))
                            .frame(width: max(4, proxy.size.width * CGFloat(summary.count) / CGFloat(total)))
                    }
                }
            }
        }
        .frame(height: 7)
    }

    private func panelTitle(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.forgeSectionLabel)
            .tracking(2)
            .foregroundColor(.forgeSecondaryLabel)
            .lineLimit(2)
    }

    private func panelMeta(_ parts: [String]) -> some View {
        Text(parts.filter { !$0.isEmpty }.joined(separator: " · "))
            .font(.forgeCaption)
            .foregroundColor(.forgeSecondaryLabel)
            .lineLimit(2)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func panelCard<Content: View>(colorHex: String? = nil, @ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(Theme.Spacing.l)
            .frame(maxWidth: .infinity, alignment: .leading)
            .forgeCard()
            .overlay(alignment: .leading) {
                if let colorHex {
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(Color(workoutTypeHex: colorHex))
                        .frame(width: 4)
                        .padding(.vertical, Theme.Spacing.l)
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous)
                    .strokeBorder(Color.forgeSeparator, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.large, style: .continuous))
    }

    private func dashboardActionButton(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.selection()
            action()
        } label: {
            Label(title, systemImage: systemImage)
                .font(.forgeCaption.weight(.semibold))
                .foregroundColor(.forgeLabel)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
                .frame(maxWidth: .infinity)
                .frame(minHeight: Theme.Layout.minTapTarget)
                .forgeGlassCapsule()
                .glassOutline()
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }

    private func typeBreakdown(_ summaries: [ActivityIndex.TypeSummary]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            ForEach(summaries.prefix(4), id: \.self) { summary in
                HStack(spacing: Theme.Spacing.s) {
                    Circle()
                        .fill(Color(workoutTypeHex: summary.colorHex))
                        .frame(width: 7, height: 7)
                    Text(summary.title)
                        .font(.forgeCaption)
                        .foregroundColor(.forgeLabel)
                        .lineLimit(1)
                    Spacer(minLength: Theme.Spacing.s)
                    Text(typeSummaryValue(summary))
                        .font(.forgeCaption)
                        .foregroundColor(.forgeSecondaryLabel)
                        .lineLimit(1)
                }
            }
        }
    }

    private func typeSummaryValue(_ summary: ActivityIndex.TypeSummary) -> String {
        let countText = summary.count == 1 ? "1" : "\(summary.count)"
        guard summary.duration > 0, let duration = Workout.durationFormatter.string(from: summary.duration) else {
            return countText
        }
        return "\(countText) · \(duration)"
    }

    private func openHistoryDate(_ date: Date) {
        sceneState.historyDateToOpen = date
        sceneState.selectedTab = .history
    }

    private func openHistoryWorkout(_ workout: Workout) {
        sceneState.historyWorkoutToOpen = workout
        sceneState.selectedTab = .history
    }

}

#if DEBUG
struct FeedView_Previews: PreviewProvider {
    static var previews: some View {
        FeedView()
            .mockEnvironment(weightUnit: .metric)
            .preferredColorScheme(.dark)
    }
}
#endif
