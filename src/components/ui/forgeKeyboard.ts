import { AppState, Keyboard, Platform, type KeyboardEvent, type KeyboardEventName } from 'react-native';

export function dismissForgeKeyboard() {
  Keyboard.dismiss();
}

/**
 * System keyboard listener that ignores iOS keyboard transitions caused by app
 * switching or other apps, so they never collapse sheets or move the list.
 */
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
    callback(event);
  });
  return { remove() {
    if (pendingHide !== undefined) clearTimeout(pendingHide);
    lifecycle?.remove();
    dismissal?.remove();
    system.remove();
  } };
}
