//
//  SettingsView.swift
//  Sunrise Fit
//
//  Created by Karim Abou Zeid on 11.07.19.
//  Copyright © 2019 Karim Abou Zeid Software. All rights reserved.
//

import SwiftUI

struct SettingsView : View {
    @EnvironmentObject var settingsStore: SettingsStore
    
    private var mainSection: some View {
        settingsGroup {
            settingsLink("Exercises", destination: ExerciseMuscleGroupsView())
            settingsSeparator
            settingsLink("Workout types", destination: WorkoutTypesSettingsView())
            settingsSeparator
            NavigationLink(destination: GeneralSettingsView(), isActive: $generalSelected) {
                settingsRow("General")
            }
            .buttonStyle(.plain)
            settingsSeparator
            settingsLink("Backup & Export", destination: BackupAndExportView())
        }
    }

    private var aboutSection: some View {
        settingsGroup {
            settingsLink("Logs", destination: DiagnosticsView())
            settingsSeparator
            settingsLink("About", destination: AboutView())
        }
    }
    
    #if DEBUG
    private var developerSettings: some View {
        settingsGroup {
            settingsLink("Developer", destination: DeveloperSettings())
        }
    }
    #endif

    @ViewBuilder
    private func settingsGroup<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: 0, content: content)
    }

    private var settingsSeparator: some View {
        ForgeListSeparator().padding(.leading, Theme.Layout.insetGroupedRowInset)
    }

    private func settingsLink<Destination: View>(_ title: String, destination: Destination) -> some View {
        NavigationLink(destination: destination) {
            settingsRow(title)
        }
        .buttonStyle(.plain)
    }

    private func settingsRow(_ title: String) -> some View {
        HStack(spacing: Theme.Spacing.s) {
            Text(title)
                .foregroundColor(.forgeLabel)
            Spacer(minLength: Theme.Spacing.s)
            Image(systemName: "chevron.right")
                .font(.body.weight(.semibold))
                .foregroundColor(.forgeSecondaryLabel)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, Theme.Layout.insetGroupedRowInset)
        .frame(minHeight: Theme.Layout.minTapTarget)
        .contentShape(Rectangle())
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                    mainSection
                    aboutSection

                    #if DEBUG
                    developerSettings
                    #endif
                }
                .padding(.horizontal, Theme.Layout.insetGroupedRowInset)
                .padding(.top, Theme.Spacing.m)
                .padding(.bottom, Theme.Layout.bottomScrollClearance)
            }
            .background(Color.forgeBackground.ignoresSafeArea())
            .forgeScreenTitle("Settings")
        }
    }
    
    // select the general tab by default on iPad
    @State private var generalSelected = UIDevice.current.userInterfaceIdiom == .pad ? true : false
}

#if DEBUG
struct SettingsView_Previews: PreviewProvider {
    static var previews: some View {
        SettingsView()
            .mockEnvironment(weightUnit: .metric)
    }
}
#endif
