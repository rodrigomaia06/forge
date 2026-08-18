# Temporary decisions and revisit items

## Prototype state

- The first visual Dashboard prototype is split into `src/screens/`, `src/components/`, `src/data/`, and `src/theme/`. It remains a prototype and is not the final application architecture.
- The prototype is intentionally limited to Dashboard rendering and calendar day selection; the calendar now offers Year, Month, and Week views from a three-dot overflow menu. Year mini-months are selectable, and month/week days expose the selected-day state with completed-workout overlays and dots.
- The Dashboard direction is now consolidated into the former option 3 composition. The temporary option 1 and option 2 branches were removed after visual review.
- Plans, History, More, centered Workout action, Active Workout, persistence, real navigation, themes, and historical entry are not implemented yet.
- Mock workouts exist only to make the visual hierarchy reviewable. They must not become the domain model by accident.
- The supplied logo and the Forge name remain provisional.

## Tooling

- The project currently uses Expo SDK 54 so it can run in the current Expo Go release.
- The environment used for verification reports Node `20.19.2` while some SDK 54 packages request `20.19.4+`; the iOS export currently succeeds, but the runtime version should be aligned before release work.
- `npm audit` currently reports transitive dependency advisories from the Expo toolchain. Do not run broad automatic fixes without reviewing compatibility.
- Browser visual checks use Expo's static web export plus a local Python server under Playwright's `webServer`, with Playwright's iPhone device emulation defining the viewport. The interactive `npx expo start --web` path remains available for normal development.
- Playwright's local preview/test server is standardized on port `9021`.
- The prototype now trials Iconoir through `src/components/ui/Icon.js` as its single icon-family boundary. The family can be replaced later without changing feature components.
- Iconoir strokes are intentionally slightly heavier for mobile legibility. The Dashboard dock now follows the useful structural pattern found in Stack Wallet's public `WalletNavigationBar`: a narrower floating container, large radius, internal padding, and evenly distributed items.
- The Dashboard shell uses a fixed header, scrollable content, and a floating dock overlay. The dock now uses the SDK 54-compatible `expo-blur` `BlurView` with a translucent light surface; its surrounding slot is transparent, the selected state is an internal pill, and the header uses a time-based greeting without a leading icon.
- The Dashboard header has three switchable prototype variants in `src/components/DashboardHeader.js`: `greeting` (active), `archive`, and `month`. Change `dashboardTheme.headerVariant` to compare them while leaving the rest of the Dashboard unchanged.
- The greeting header uses an icon-only accent-filled Start button: a compact 50px control with a short low-opacity shadow and a bold plus symbol. Its five shape/size variants remain controlled by `dashboardTheme.startButtonVariant`: `outline-pill` (active), `outline-rounded`, `outline-compact`, `outline-soft`, and `outline-wide`.
- The Dashboard's `Recent context` card is rendered as a compact card again. Its compact height is intended to keep it fully inside the visible scroll viewport above the dark dock backdrop.
- Generated Playwright results live in `tests/results/`. Visual baselines remain beside their spec, currently under `tests/dashboard.spec.js-snapshots/`.

## Revisit before production implementation

- Split the Dashboard prototype into feature components and data modules before adding more screens.
- Establish the real navigation and persistence architecture.
- Define semantic light/dark tokens in reusable modules rather than keeping prototype colors local to one screen.
- Replace mock calendar data with the actual workout model.
- Decide whether the final project remains Expo-managed or needs a development build/native modules for haptics, notifications, storage, or other platform capabilities.
