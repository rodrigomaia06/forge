# Forge: A Strength-Training App

Forge is a private, fast workout tracker for iOS and Android. It's built for the
gym floor: log sets quickly, keep your data on your own device, and keep working
even when a session is interrupted.

## Core Capabilities

Log a workout as a scroll of exercise cards, each with its set table inline.
Forge includes:

- Rest timers with customizable alerts, including a live countdown on the lock
  screen (iOS Live Activity).
- Reusable routines and multi-routine plans, with a suggested next workout.
- Workout history, trends, and a muscle heatmap.
- Set types, personal-record markers, and RPE logging.
- Unilateral (per-side) exercises and custom exercises.
- Backup and export, plus shareable `.forge` files that import with a review of
  exactly what will be added or changed.

## Why Forge

Most popular trackers (Hevy, Strong, and the like) put your log behind an
account, sync it to someone else's cloud, and gate the genuinely useful parts
behind a subscription. Forge takes the opposite stance:

- **No account, no cloud, no sign-up.** It opens and works.
- **No subscription and no ads.** Every feature is included; nothing is
  paywalled.
- **No analytics or tracking.** Nothing leaves your device unless you export it.
- **You own your data.** Everything lives in a local database with a full,
  portable export — no lock-in and no migration tax.
- **Fully offline.** The gym's dead spot never gets in the way.
- **Built for speed.** The session UI is designed around quick set entry, not a
  social feed.
- **Open source (GPLv3).** Auditable, and you can build it yourself.

## Privacy & Data Handling

Forge stores workouts locally in an on-device SQLite database. It requires no
account, includes no analytics or advertising SDKs, and sends nothing off the
device unless you deliberately export it. There are no subscriptions and no user
tracking. A portable JSON / `.forge` export lets you move data between your own
installs.

## Installation

Prebuilt binaries are attached to each GitHub [Release](../../releases).

- **iOS:** download the unsigned `.ipa` and sideload it onto an iPhone running
  iOS 16+ with a tool like iLoader, which re-signs it with your Apple ID.
- **Android:** download the `.apk` and sideload it onto a phone. It is an
  `arm64-v8a` build — it installs on physical phones, not on x86 emulators.

## Development

The app is built with Expo, React Native, and TypeScript. Install dependencies
with `npm install` and start the dev server with `npm start`. Verify changes
with `npm run typecheck` and the Playwright suites under `tests/`. A full native
build needs a Mac with Xcode (iOS) or the Android SDK (Android); GitHub Actions
workflows build both and the binaries are published to Releases.

Development leverages AI-assisted tooling, with the features reviewed by a human.

## License

Forge is released under the GNU General Public License v3.0. See
[LICENSE](LICENSE) for the full text.
