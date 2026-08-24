import { useCallback, useRef } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

const enabled = typeof __DEV__ !== 'undefined' && __DEV__;

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
