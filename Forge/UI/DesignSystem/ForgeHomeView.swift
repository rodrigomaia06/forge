//
//  ForgeHomeView.swift
//  Forge
//
//  Static mock of the Home dashboard for CI screenshots (the live FeedView needs real
//  data to render): greeting, a full-year activity heat-grid, and a monthly training
//  mix. Mirrors FeedView's design so we can review the look.
//

import SwiftUI

struct ForgeHomeView: View {
    private let activeWeeks: Set<Int> = [1, 2, 4, 5, 7, 8, 9, 11, 12, 14, 16, 17, 19, 20, 22, 24, 25]

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
            header
            activity
            trainingMix
        }
        .padding(.horizontal, Theme.Spacing.l)
        .padding(.top, Theme.Spacing.xxl)
        .padding(.bottom, Theme.Spacing.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.forgeBackground)
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xxs) {
                Text("Good afternoon").font(.forgeGreeting).foregroundColor(.forgeLabel)
                Text("Ready to train?").font(.forgeCaption).foregroundColor(.forgeSecondaryLabel)
            }
            Spacer()
            Image(systemName: "plus")
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(.forgeBackground)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Color.forgeAccent))
        }
    }

    private var activity: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.m) {
            HStack {
                Text("ACTIVITY 2026").font(.forgeSectionLabel).tracking(2).foregroundColor(.forgeSecondaryLabel)
                Spacer()
                Image(systemName: "chevron.up").font(.caption.weight(.semibold)).foregroundColor(.forgeSecondaryLabel)
            }
            VStack(spacing: 3) {
                ForEach(0..<7, id: \.self) { weekday in
                    HStack(spacing: 3) {
                        ForEach(0..<26, id: \.self) { week in
                            RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                                .fill(activeWeeks.contains(week) && (week + weekday) % 3 == 0 ? Color.forgeAccent : Color.forgeSurface)
                                .aspectRatio(1, contentMode: .fit)
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
        }
    }

    private var trainingMix: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.m) {
            HStack(alignment: .firstTextBaseline) {
                Text("BY TYPE").font(.forgeSectionLabel).tracking(2).foregroundColor(.forgeSecondaryLabel)
                Spacer()
                Text("March 2026").font(.forgeCaption).foregroundColor(.forgeSecondaryLabel)
            }
            card
        }
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s) {
            HStack(spacing: 2) {
                Capsule(style: .continuous).fill(Color.blue.opacity(0.8)).frame(maxWidth: .infinity)
                Capsule(style: .continuous).fill(Color.green.opacity(0.8)).frame(maxWidth: 80)
                Capsule(style: .continuous).fill(Color.red.opacity(0.8)).frame(maxWidth: 48)
            }
            .frame(height: 7)
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                mixRow(color: .blue, title: "Strength", value: "8 · 11h 10m")
                mixRow(color: .green, title: "Court sports", value: "2 · 2h")
                mixRow(color: .red, title: "Martial arts", value: "1 · 1h 10m")
            }
            ForgeListSeparator()
            HStack {
                Text("This week").font(.forgeCaption).foregroundColor(.forgeSecondaryLabel)
                Spacer()
                Text("3 workouts").font(.forgeCaption).foregroundColor(.forgeSecondaryLabel)
            }
        }
        .padding(.horizontal, Theme.Spacing.m)
        .padding(.vertical, Theme.Spacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: Theme.Radius.medium, style: .continuous).fill(Color.forgeSurface))
    }

    private func mixRow(color: Color, title: String, value: String) -> some View {
        HStack(spacing: Theme.Spacing.s) {
            Circle()
                .fill(color)
                .frame(width: 7, height: 7)
            Text(title)
                .font(.forgeCaption)
                .foregroundColor(.forgeLabel)
            Spacer()
            Text(value)
                .font(.forgeCaption)
                .foregroundColor(.forgeSecondaryLabel)
        }
    }
}

#if DEBUG
struct ForgeHomeView_Previews: PreviewProvider {
    static var previews: some View {
        ForgeHomeView().preferredColorScheme(.dark)
    }
}
#endif
