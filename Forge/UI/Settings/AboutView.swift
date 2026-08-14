//
//  AboutView.swift
//  Forge
//
//  Created by Karim Abou Zeid on 04.03.20.
//  Copyright © 2020 Karim Abou Zeid Software. All rights reserved.
//

import SwiftUI

struct AboutView: View {
    var body: some View {
        List {
            HStack {
                Image("AppIconRounded")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(height: 80)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Forge \(versionString)")
                        .font(.headline)

                    // GPL attribution: Forge is a derived work of the open-source Iron app.
                    Text("Based on Iron by Karim Abou Zeid")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding()
            }
            .listRowBackground(Color.clear)

            Section {
                Button {
                    UIApplication.shared.open(URL(string: "https://github.com/rodrigomaia06/Forge")!)
                } label: {
                    Label("Source code", image: "github.fill")
                }

                Button {
                    UIApplication.shared.open(URL(string: "https://github.com/rodrigomaia06/Forge/blob/main/LICENSE")!)
                } label: {
                    Label("License: GPL v3.0", systemImage: "doc.text")
                }
            }

            Section(header: Text("Privacy")) {
                Text("Forge keeps your workouts on this iPhone. No account, no server, no tracking.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .navigationBarTitle("About", displayMode: .inline)
    }

    private var versionString: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String
        let commit = Bundle.main.infoDictionary?["ForgeGitCommit"] as? String
        let buildText = [displayBuild(build), displayCommit(commit)].compactMap { value -> String? in
            guard let value, !value.isEmpty else { return nil }
            return value
        }.joined(separator: ", ")
        let base = buildText.isEmpty ? "\(version ?? "?")" : "\(version ?? "?") (\(buildText))"
        #if DEBUG
        return "\(base) DEBUG"
        #else
        return base
        #endif
    }

    private func displayBuild(_ build: String?) -> String? {
        guard let build, !build.isEmpty else { return nil }
        if build == "1" { return nil }
        return build
    }

    private func displayCommit(_ commit: String?) -> String? {
        guard let commit, !commit.isEmpty, commit != "local" else { return nil }
        return commit
    }
}

#if DEBUG
struct AboutView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            AboutView().mockEnvironment(weightUnit: .metric)
        }
    }
}
#endif
