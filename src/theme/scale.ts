import { Dimensions, Platform } from 'react-native';

/**
 * Responsive sizing — a downscale-only variant of the react-native-size-matters
 * algorithm, implemented in-repo to avoid a dependency.
 *
 * The iPhone Air is Forge's reference canvas: the UI is authored to look exactly
 * right there. So the reference device — and anything wider — must render the raw
 * authored values 1:1 (never inflated), and only NARROWER devices scale down from
 * there, proportionally. That is why the width/height ratios are clamped at 1.0:
 * at the iPhone Air's 420 dp width the factor is exactly 1, so type, spacing and
 * component sizes all equal the authored dp; a 360–393 dp phone scales below 1.
 *
 * - `scale` / `verticalScale`: linear against the short / long screen dimension.
 * - `moderateScale` / `moderateVerticalScale`: damped (default 0.5) — the right
 *   choice for type, spacing, radii, and most fixed sizes.
 * - `scaleUI`: a rounded `moderateScale` for component dp (card/chip/button sizes)
 *   so a narrower device is a proportional copy of the iPhone Air.
 *
 * Read once at startup; this app is portrait-locked and does not rebase on rotation.
 */
const { width, height } = Dimensions.get('window');
const [shortDimension, longDimension] = width < height ? [width, height] : [height, width];

// The iPhone Air's logical dimensions. Base width 420 is the device the UI is
// designed against; base height is kept generous so tall phones also clamp to 1.
const GUIDELINE_BASE_WIDTH = 420;
const GUIDELINE_BASE_HEIGHT = 852;

// Forge's sizing is authored iOS-generous; Android/Material conventions read
// denser, and Android phones also tend to be lower-density (so the same dp is
// physically larger). Trim the damped scales ~5% on Android only — iOS is 1.0 —
// so the app reads tighter on Android without touching the iPhone look.
const PLATFORM_FACTOR = Platform.OS === 'android' ? 0.95 : 1;

// Responsive scaling targets real devices. The web build — and the Playwright
// device profiles that render through it — stay at base size, so the layout the
// test suite asserts remains canonical; device behaviour is verified on a native
// build. (On web the ratios are 1, which makes every scale identity.)
const isWeb = Platform.OS === 'web';

// Downscale-only: 1.0 on the reference device (and anything larger), below 1 on
// narrower devices. Clamping at 1 is what keeps the iPhone Air exactly as authored.
const widthRatio = isWeb ? 1 : Math.min(1, shortDimension / GUIDELINE_BASE_WIDTH);
const heightRatio = isWeb ? 1 : Math.min(1, longDimension / GUIDELINE_BASE_HEIGHT);

export const scale = (size: number): number => size * widthRatio;
export const verticalScale = (size: number): number => size * heightRatio;
export const moderateScale = (size: number, factor = 0.5): number =>
  (size + (scale(size) - size) * factor) * PLATFORM_FACTOR;
export const moderateVerticalScale = (size: number, factor = 0.5): number =>
  (size + (verticalScale(size) - size) * factor) * PLATFORM_FACTOR;

// Component dp (card / chip / button sizes) run through the same damped scale as
// type and spacing, rounded to a whole pixel, so a narrower device is a true
// proportional copy of the iPhone Air. Native-only via the ratios above: on web
// (and on the iPhone Air) this is the identity, so the canonical layout is intact.
export const scaleUI = (size: number): number => Math.round(moderateScale(size));
