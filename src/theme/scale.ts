import { Dimensions, Platform } from 'react-native';

/**
 * Responsive sizing — the react-native-size-matters algorithm, implemented in-repo
 * to avoid a dependency.
 *
 * Forge's raw dp values are authored against a ~393 × 852 dp iPhone canvas, so that
 * is the guideline base: on it the factor is ~1.0 (iOS stays as designed), and
 * other devices scale proportionally — smaller/older Android phones (e.g. 360 × 720)
 * down, larger phones up — with a damping `factor` so nothing over-scales. There are
 * deliberately no breakpoints or per-device clamps.
 *
 * - `scale` / `verticalScale`: linear against the short / long screen dimension.
 * - `moderateScale` / `moderateVerticalScale`: damped (default 0.5) — the right
 *   choice for type, spacing, radii, and most fixed sizes.
 *
 * Read once at startup; this app is portrait-locked and does not rebase on rotation.
 */
const { width, height } = Dimensions.get('window');
const [shortDimension, longDimension] = width < height ? [width, height] : [height, width];

const GUIDELINE_BASE_WIDTH = 393;
const GUIDELINE_BASE_HEIGHT = 852;

// Forge's sizing is authored iOS-generous; Android/Material conventions read
// denser, and Android phones also tend to be lower-density (so the same dp is
// physically larger). Trim the damped scales ~5% on Android only — iOS is 1.0 —
// so the app reads tighter on Android without touching the iPhone look.
const PLATFORM_FACTOR = Platform.OS === 'android' ? 0.95 : 1;

// Responsive scaling targets real devices. The web build — and the Playwright
// device profiles that render through it — stay at base size, so the layout the
// test suite asserts remains canonical; device behaviour is verified on a native
// build. (On web the two base scales are identity, which makes the moderate
// scales identity too.)
const isWeb = Platform.OS === 'web';

export const scale = (size: number): number =>
  isWeb ? size : (shortDimension / GUIDELINE_BASE_WIDTH) * size;
export const verticalScale = (size: number): number =>
  isWeb ? size : (longDimension / GUIDELINE_BASE_HEIGHT) * size;
export const moderateScale = (size: number, factor = 0.5): number =>
  (size + (scale(size) - size) * factor) * PLATFORM_FACTOR;
export const moderateVerticalScale = (size: number, factor = 0.5): number =>
  (size + (verticalScale(size) - size) * factor) * PLATFORM_FACTOR;
