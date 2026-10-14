export const forgeDockGeometry = {
  surfaceHeight: 68,
  compactSurfaceHeight: 50,
  horizontalInset: 7,
  indicatorInset: 2,
  minimumTouchSize: 44,
  screenInset: 12,
  minimumBottomClearance: 12,
  surfaceToContentGap: 12,
} as const;

export function getDockWidths(viewportWidth: number) {
  const availableWidth = Math.max(0, viewportWidth - forgeDockGeometry.screenInset * 2);
  const bound = (width: number) => Math.min(width, availableWidth);
  return {
    regular: bound(Math.min(Math.max(viewportWidth * 0.86, 304), 360)),
    activeWorkout: bound(Math.round(Math.min(Math.max(viewportWidth * 0.88, 320), 390))),
    compact: bound(Math.min(Math.max(viewportWidth * 0.76, 304), 336)),
  };
}

export function getDockSlotGeometry(
  surfaceWidth: number,
  surfaceHeight: number,
  canvasWidth: number,
  itemCount: number,
  index: number,
) {
  'worklet';
  const contentWidth = Math.max(0, surfaceWidth - forgeDockGeometry.horizontalInset * 2);
  const slotWidth = contentWidth / Math.max(1, itemCount);
  const contentLeft = (canvasWidth - surfaceWidth) / 2 + forgeDockGeometry.horizontalInset;
  const centerX = contentLeft + (index + 0.5) * slotWidth;
  const centerY = forgeDockGeometry.surfaceHeight - surfaceHeight / 2;
  const expandedFraction = Math.max(
    0,
    Math.min(
      1,
      (surfaceHeight - forgeDockGeometry.compactSurfaceHeight) /
        (forgeDockGeometry.surfaceHeight - forgeDockGeometry.compactSurfaceHeight),
    ),
  );
  const indicatorHeight = surfaceHeight - 2 * (3 + expandedFraction * 5);
  const indicatorWidth = Math.max(0, slotWidth - forgeDockGeometry.indicatorInset * 2);
  return {
    slotWidth,
    contentLeft,
    centerX,
    centerY,
    indicatorWidth,
    indicatorHeight,
    indicatorLeft: centerX - indicatorWidth / 2,
    indicatorTop: centerY - indicatorHeight / 2,
  };
}

export function dockIndexAtPosition(
  x: number,
  surfaceWidth: number,
  canvasWidth: number,
  itemCount: number,
) {
  'worklet';
  const { contentLeft, slotWidth } = getDockSlotGeometry(
    surfaceWidth,
    forgeDockGeometry.surfaceHeight,
    canvasWidth,
    itemCount,
    0,
  );
  if (slotWidth <= 0) return 0;
  return Math.max(0, Math.min(itemCount - 1, Math.floor((x - contentLeft) / slotWidth)));
}
