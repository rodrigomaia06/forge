import { requireNativeView, requireOptionalNativeModule } from 'expo';
import { Platform, type NativeSyntheticEvent, type ViewProps } from 'react-native';

export interface RangeKeyboardFrame {
  visible: boolean;
  height: number;
  width: number;
  screenX: number;
  screenY: number;
  duration: number;
}

type RangeKeyboardModule = {
  dismiss(): void;
  addListener(name: 'keyboardFrameChange', listener: (frame: RangeKeyboardFrame) => void): { remove(): void };
};

export const rangeKeyboardModule = Platform.OS === 'web'
  ? null
  : requireOptionalNativeModule<RangeKeyboardModule>('ForgeRangeKeyboard');

export interface NativeRangeInputProps extends Omit<ViewProps, 'onFocus' | 'onBlur'> {
  value: string;
  mostRecentEventCount: number;
  editable: boolean;
  placeholder: string;
  textColor?: number;
  placeholderTextColor?: number;
  fontSize: number;
  fontFamily: string;
  textAlign: string;
  appearance: string;
  focusRequest: number;
  onChange: (event: NativeSyntheticEvent<{ value: string; eventCount: number }>) => void;
  onFocus: () => void;
  onBlur: () => void;
}

export const NativeRangeInput = rangeKeyboardModule
  ? requireNativeView<NativeRangeInputProps>('ForgeRangeKeyboard')
  : null;
