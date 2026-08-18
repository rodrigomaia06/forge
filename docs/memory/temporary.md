# Temporary decisions and revisit items

## Prototype state

- The first visual Dashboard prototype is split into `src/screens/`, `src/components/`, `src/data/`, and `src/theme/`. It remains a prototype and is not the final application architecture.
- The prototype is intentionally limited to Dashboard rendering and basic calendar day selection.
- The Dashboard direction is now consolidated into the former option 3 composition. The temporary option 1 and option 2 branches were removed after visual review.
- Plans, History, More, Active Workout, persistence, real navigation, themes, and historical entry are not implemented yet.
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
- The Dashboard shell is temporarily reduced to three ordinary layout regions: header, scrollable content, and dock slot. Blur, translucency, shadows, and absolute positioning were removed while the dock geometry is debugged. The dock is currently a single dark rounded cylinder with a contained selected item.
- The Dashboard's `Recent context` card is temporarily not rendered in the initial composition. Native bounds showed that it was the pale rectangle being clipped immediately above the dock. Reintroduce it only after choosing a placement that cannot be partially visible at the bottom of the scroll viewport.
- Generated Playwright results live in `tests/results/`. Visual baselines remain beside their spec, currently under `tests/dashboard.spec.js-snapshots/`.

## Revisit before production implementation

- Split the Dashboard prototype into feature components and data modules before adding more screens.
- Establish the real navigation and persistence architecture.
- Define semantic light/dark tokens in reusable modules rather than keeping prototype colors local to one screen.
- Replace mock calendar data with the actual workout model.
- Decide whether the final project remains Expo-managed or needs a development build/native modules for haptics, notifications, storage, or other platform capabilities.
