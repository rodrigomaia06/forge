import { useCallback, useRef } from 'react';
import {
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

const enabled = typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_LAYOUT_DEBUG === '1';

export function useLayoutProbe<T = View>(name: string, details: Record<string, unknown> = {}) {
  const ref = useRef<T>(null);

  const onLayout = useCallback(
    (event: LayoutChangeEvent): void => {
      if (!enabled) return;

      const { x, y, width, height } = event.nativeEvent.layout;
      const payload = { local: { x, y, width, height } };

      (
        ref.current as
          | (T & {
              measureInWindow: (
                callback: (
                  windowX: number,
                  windowY: number,
                  windowWidth: number,
                  windowHeight: number,
                ) => void,
              ) => void;
            })
          | null
      )?.measureInWindow(
        (windowX: number, windowY: number, windowWidth: number, windowHeight: number): void => {
          console.log(
            `[Forge layout] ${name}`,
            JSON.stringify({
              details,
              ...payload,
              window: { x: windowX, y: windowY, width: windowWidth, height: windowHeight },
            }),
          );
        },
      );
    },
    [name],
  );

  return { ref, onLayout };
}

/**
 * Development-only ScrollView probe. It reports the actual viewport, content
 * extent, current offset, and maximum reachable offset after a user scroll
 * ends, which separates a clipped body from an intercepted gesture.
 */
export function useScrollLayoutProbe<T = View>(name: string, details: Record<string, unknown> = {}) {
  const layoutProbe = useLayoutProbe<T>(name, details);
  const contentSize = useRef({ width: 0, height: 0 });

  const report = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (!enabled) return;
    const { contentOffset, contentSize: measuredContent, layoutMeasurement } = event.nativeEvent;
    const maximumOffset = Math.max(0, measuredContent.height - layoutMeasurement.height);
    console.log(
      `[Forge layout] ${name}: scroll`,
      JSON.stringify({
        details,
        viewport: { width: layoutMeasurement.width, height: layoutMeasurement.height },
        content: {
          width: measuredContent.width || contentSize.current.width,
          height: measuredContent.height || contentSize.current.height,
        },
        offset: contentOffset.y,
        maximumOffset,
        atEnd: contentOffset.y >= maximumOffset - 1,
      }),
    );
  }, [details, name]);

  return {
    ...layoutProbe,
    onContentSizeChange: (width: number, height: number): void => {
      contentSize.current = { width, height };
    },
    onMomentumScrollEnd: report,
    onScrollEndDrag: report,
  };
}
