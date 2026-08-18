import { useCallback, useRef } from 'react';

const enabled = typeof __DEV__ !== 'undefined' && __DEV__;

export function useLayoutProbe(name) {
  const ref = useRef(null);

  const onLayout = useCallback((event) => {
    if (!enabled) return;

    const { x, y, width, height } = event.nativeEvent.layout;
    const payload = { local: { x, y, width, height } };

    ref.current?.measureInWindow((windowX, windowY, windowWidth, windowHeight) => {
      console.log(`[Forge layout] ${name}`, JSON.stringify({
        ...payload,
        window: { x: windowX, y: windowY, width: windowWidth, height: windowHeight },
      }));
    });
  }, [name]);

  return { ref, onLayout };
}

