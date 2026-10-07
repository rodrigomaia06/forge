import { Dimensions, Platform } from 'react-native';

// Downscale from the 420dp portrait reference; larger devices keep authored sizes.
// Dimensions are sampled at startup because Forge is portrait-locked.
const { width, height } = Dimensions.get('window');
const [shortDimension, longDimension] = width < height ? [width, height] : [height, width];

const GUIDELINE_BASE_WIDTH = 420;
const GUIDELINE_BASE_HEIGHT = 852;

// Android applies a 5% density trim to damped scales.
const PLATFORM_FACTOR = Platform.OS === 'android' ? 0.95 : 1;

// Browser profiles use authored sizes; native sizing requires device verification.
const isWeb = Platform.OS === 'web';

const widthRatio = isWeb ? 1 : Math.min(1, shortDimension / GUIDELINE_BASE_WIDTH);
const heightRatio = isWeb ? 1 : Math.min(1, longDimension / GUIDELINE_BASE_HEIGHT);

export const scale = (size: number): number => size * widthRatio;
export const verticalScale = (size: number): number => size * heightRatio;
export const moderateScale = (size: number, factor = 0.5): number =>
  (size + (scale(size) - size) * factor) * PLATFORM_FACTOR;
export const moderateVerticalScale = (size: number, factor = 0.5): number =>
  (size + (verticalScale(size) - size) * factor) * PLATFORM_FACTOR;

// Round component dimensions to whole pixels.
export const scaleUI = (size: number): number => Math.round(moderateScale(size));
