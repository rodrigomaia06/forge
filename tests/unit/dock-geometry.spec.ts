import { expect, test } from '@playwright/test';
import {
  dockIndexAtPosition,
  forgeDockGeometry,
  getDockSlotGeometry,
  getDockWidths,
} from '../../src/components/dockGeometry';

test('dock fits narrow phones and retains reachable slots with and without a workout', () => {
  for (const viewport of [320, 360, 375, 393, 402, 420, 440]) {
    const widths = getDockWidths(viewport);
    for (const count of [4, 5]) {
      for (const width of [count === 5 ? widths.activeWorkout : widths.regular, widths.compact]) {
        expect(width).toBeLessThanOrEqual(viewport - 24);
        expect((width - 14) / count).toBeGreaterThanOrEqual(forgeDockGeometry.minimumTouchSize);
      }
    }
  }
  expect(getDockWidths(420)).toEqual({ regular: 360, activeWorkout: 370, compact: 319.2 });
});

test('every slot and indicator share a center throughout compacting and workout insertion', () => {
  for (const viewport of [320, 393, 402, 420]) {
    const widths = getDockWidths(viewport);
    for (const count of [4, 5]) {
      const expandedWidth = count === 5 ? widths.activeWorkout : widths.regular;
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        const width = expandedWidth + (widths.compact - expandedWidth) * progress;
        const height = 68 - 18 * progress;
        for (let index = 0; index < count; index += 1) {
          const slot = getDockSlotGeometry(width, height, widths.activeWorkout, count, index);
          expect(slot.indicatorLeft + slot.indicatorWidth / 2).toBeCloseTo(slot.centerX);
          expect(slot.indicatorTop + slot.indicatorHeight / 2).toBeCloseTo(slot.centerY);
          expect(slot.indicatorTop).toBeGreaterThanOrEqual(68 - height);
          expect(slot.indicatorTop + slot.indicatorHeight).toBeLessThanOrEqual(68);
          expect(dockIndexAtPosition(slot.centerX, width, widths.activeWorkout, count)).toBe(index);
        }
      }
    }
  }
});

test('scrubbing clamps outside edges and changes tabs at slot boundaries', () => {
  for (const count of [4, 5]) {
    const slot = getDockSlotGeometry(304, 50, 320, count, 0);
    expect(dockIndexAtPosition(-100, 304, 320, count)).toBe(0);
    expect(dockIndexAtPosition(1000, 304, 320, count)).toBe(count - 1);
    for (let boundary = 1; boundary < count; boundary += 1) {
      const x = slot.contentLeft + boundary * slot.slotWidth;
      expect(dockIndexAtPosition(x - 0.1, 304, 320, count)).toBe(boundary - 1);
      expect(dockIndexAtPosition(x + 0.1, 304, 320, count)).toBe(boundary);
    }
  }
});
