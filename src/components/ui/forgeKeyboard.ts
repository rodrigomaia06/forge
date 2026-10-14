import { BackHandler, Keyboard, type KeyboardEvent, type KeyboardEventName } from 'react-native';
import { rangeKeyboardModule } from '../../../modules/forge-range-keyboard';

let rangeFrame: KeyboardEvent['endCoordinates'] | undefined;

export function forgeKeyboardMetrics() {
  return rangeFrame ?? Keyboard.metrics();
}

export function isRangeKeyboardVisible() {
  return rangeFrame !== undefined;
}

export function dismissForgeKeyboard() {
  rangeKeyboardModule?.dismiss();
  Keyboard.dismiss();
}

/** Android's app-local keypad reports occlusion through the same consumer contract as the IME. */
export function addForgeKeyboardListener(name: KeyboardEventName, callback: (event: KeyboardEvent) => void) {
  const system = Keyboard.addListener(name, event => {
    // The IME can finish hiding after the custom panel has already taken its place.
    if (rangeFrame && (name === 'keyboardDidHide' || name === 'keyboardWillHide')) return;
    callback(event);
  });
  const back = rangeKeyboardModule && name === 'keyboardDidShow'
    ? BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isRangeKeyboardVisible()) return false;
      dismissForgeKeyboard();
      return true;
    }) : null;
  const custom = rangeKeyboardModule?.addListener('keyboardFrameChange', (frame) => {
    rangeFrame = frame.visible ? {
      height: frame.height, width: frame.width, screenX: frame.screenX, screenY: frame.screenY,
    } : undefined;
    if ((frame.visible && name === 'keyboardDidShow') || (!frame.visible && name === 'keyboardDidHide')) {
      callback({ duration: frame.duration, easing: 'keyboard', endCoordinates: {
        height: frame.visible ? frame.height : 0, width: frame.width, screenX: frame.screenX, screenY: frame.screenY,
      } });
    }
  });
  return { remove() { system.remove(); custom?.remove(); back?.remove(); } };
}
