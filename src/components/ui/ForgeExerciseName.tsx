import React, { useLayoutEffect, useRef } from 'react';
import { Platform, StyleSheet, Text as NativeText, type TextProps } from 'react-native';
import { maxFontSizeMultiplier } from '../../theme/tokens';

/** Single-line exercise names retain their full accessible label when space is tight. */
export function ForgeExerciseName({ children, style, ...props }: TextProps) {
  const ref = useRef<NativeText>(null);
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !ref.current) return;
    const element = ref.current as unknown as HTMLElement;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    const authoredSize =
      StyleSheet.flatten(style)?.fontSize ?? parseFloat(getComputedStyle(element).fontSize);
    const fit = () => {
      // Measure at the authored size first so wider layouts can restore the full size.
      element.style.fontSize = `${authoredSize}px`;
      const computed = getComputedStyle(element);
      context.font = `${computed.fontStyle} ${computed.fontWeight} ${authoredSize}px ${computed.fontFamily}`;
      const text = element.textContent ?? '';
      const naturalWidth =
        context.measureText(text).width +
        Math.max(0, text.length - 1) * (parseFloat(computed.letterSpacing) || 0);
      const available = element.clientWidth;
      if (available > 0 && naturalWidth > 0) {
        element.style.fontSize = `${Math.max(authoredSize * 0.75, Math.min(authoredSize, (authoredSize * available) / naturalWidth))}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (element.parentElement) observer.observe(element.parentElement);
    document.fonts.addEventListener('loadingdone', fit);
    void document.fonts.ready.then(() => {
      if (element.isConnected) fit();
    });
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener('loadingdone', fit);
    };
  }, [children, style]);
  return (
    <NativeText
      {...props}
      ref={ref}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
      style={[{ flexShrink: 1, minWidth: 0, includeFontPadding: false }, style]}
    >
      {children}
    </NativeText>
  );
}
