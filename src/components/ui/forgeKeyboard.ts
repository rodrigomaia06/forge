import { AppState, BackHandler, Keyboard, Platform, type KeyboardEvent, type KeyboardEventName } from 'react-native';
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
  const ios = Platform.OS === 'ios';
  let suspended = ios && AppState.currentState !== null && AppState.currentState !== 'active';
  let resumeFrame: KeyboardEvent['endCoordinates'] | undefined;
  let lastFrame = ios ? Keyboard.metrics() : undefined;
  let pendingHide: ReturnType<typeof setTimeout> | undefined;
  const scheduleHide = (event: KeyboardEvent, notify: boolean) => {
    if (suspended || event.isEventFromThisApp === false) return;
    if (pendingHide !== undefined) clearTimeout(pendingHide);
    // A keyboard notification can precede the queued AppState change.
    pendingHide = setTimeout(() => {
      pendingHide = undefined;
      if (suspended || (AppState.currentState !== null && AppState.currentState !== 'active')) return;
      lastFrame = undefined;
      resumeFrame = undefined;
      if (notify) callback(event);
    }, 0);
  };
  const lifecycle = ios ? AppState.addEventListener('change', state => {
    if (state !== 'active') {
      suspended = true;
      resumeFrame = lastFrame;
    } else {
      suspended = false;
    }
  }) : null;
  // Show/frame subscribers must also forget a genuinely dismissed keyboard,
  // otherwise a later user-initiated opening could look like a resumed frame.
  const dismissal = ios && name !== 'keyboardWillHide' && name !== 'keyboardDidHide'
    ? Keyboard.addListener('keyboardWillHide', event => scheduleHide(event, false)) : null;
  const system = Keyboard.addListener(name, event => {
    if (ios) {
      // iOS also reports keyboard transitions from the app switcher and other
      // apps. They must not collapse Forge's sheets or restore its scroll offset.
      if (suspended || event.isEventFromThisApp === false) return;
      if (pendingHide !== undefined) clearTimeout(pendingHide);
      if (name === 'keyboardWillHide' || name === 'keyboardDidHide') {
        scheduleHide(event, true);
        return;
      }
      const frame = event.endCoordinates;
      const unchanged = resumeFrame && frame.height === resumeFrame.height &&
        frame.width === resumeFrame.width && frame.screenX === resumeFrame.screenX &&
        frame.screenY === resumeFrame.screenY;
      resumeFrame = undefined;
      lastFrame = frame;
      if (unchanged) return;
    }
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
  return { remove() {
    if (pendingHide !== undefined) clearTimeout(pendingHide);
    lifecycle?.remove();
    dismissal?.remove();
    system.remove(); custom?.remove(); back?.remove();
  } };
}
