import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import ColorPicker, {
  HueSlider,
  Panel1,
  Preview,
  type RenderThumbProps,
  type ColorPickerRef,
} from 'reanimated-color-picker';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { Button, ForgeText, pressedFeedback, selectionHaptic } from '../../components/ui';
import { workoutTypeColorChoices } from '../../domain/workouts/workoutTypeDefaults';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { scaleUI } from '../../theme/scale';
import { typeScale } from '../../theme/tokens';
import { useForgeReducedMotion } from '../../theme/motion';

export function WorkoutTypeCustomColorPicker({
  color,
  onApply,
}: {
  color: string;
  onApply: (color: string) => void;
}) {
  const theme = useForgeTheme();
  const reducedMotion = useForgeReducedMotion();
  const [draft, setDraft] = useState(color.toUpperCase());
  const picker = useRef<ColorPickerRef>(null);
  return (
    <View testID="custom-workout-type-color-picker" style={styles.body}>
      <ColorPicker
        ref={picker}
        value={color}
        onCompleteJS={({ hex }) => setDraft(hex.toUpperCase())}
        thumbSize={28}
        renderThumb={ColorThumb}
        sliderThickness={44}
        boundedThumb
        thumbAnimationDuration={reducedMotion ? 0 : 100}
        thumbScaleAnimationValue={1}
        thumbScaleAnimationDuration={0}
        style={styles.picker}
      >
        <View style={styles.previewGroup}>
          <Preview style={styles.preview} hideText disableOpacityTexture />
          <View style={styles.previewLabels}>
            <ForgeText style={[styles.previewLabel, { color: theme.textSecondary }]}>
              Current {color.toUpperCase()}
            </ForgeText>
            <ForgeText style={[styles.previewLabel, { color: theme.textSecondary }]}>
              New {draft}
            </ForgeText>
          </View>
        </View>
        <Panel1 accessibilityLabel="Color saturation and brightness" style={styles.panel} />
        <HueSlider accessibilityLabel="Color hue" style={styles.hue} />
      </ColorPicker>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Preset colors"
        style={styles.swatches}
      >
        {workoutTypeColorChoices.map(({ name, value }) => {
          const selected = draft === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={`Use ${name} color`}
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              onPress={() => {
                if (!selected) selectionHaptic();
                picker.current?.setColor(value, reducedMotion ? 0 : 100);
                setDraft(value);
              }}
              style={({ pressed }) => [
                styles.swatch,
                { borderColor: selected ? theme.selectionIndicator : 'transparent' },
                pressed && pressedFeedback,
              ]}
            >
              <View style={[styles.swatchColor, { backgroundColor: value }]} />
            </Pressable>
          );
        })}
      </View>
      <Button
        label="Apply color"
        accessibilityLabel={`Apply color ${draft}`}
        theme={theme}
        variant="outline"
        tone="success"
        icon="check"
        onPress={() => {
          selectionHaptic();
          onApply(draft);
        }}
      />
    </View>
  );
}

function ColorThumb({ width, height, positionStyle }: RenderThumbProps) {
  return (
    <Animated.View
      style={[
        styles.thumb,
        { width, height, borderRadius: width / 2 },
        positionStyle as StyleProp<AnimatedStyle<ViewStyle>>,
      ]}
    >
      <View style={[styles.thumbInner, { borderRadius: width / 2 }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: { gap: scaleUI(20) },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: scaleUI(8),
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchColor: { width: 32, height: 32, borderRadius: 16 },
  picker: { gap: scaleUI(20) },
  preview: { height: scaleUI(44), borderRadius: scaleUI(12) },
  previewGroup: { gap: scaleUI(8) },
  previewLabels: { flexDirection: 'row' },
  previewLabel: { flex: 1, textAlign: 'center', ...typeScale.supporting },
  panel: { height: scaleUI(220), borderRadius: scaleUI(12) },
  hue: { borderRadius: scaleUI(14), minHeight: 44 },
  // Opposing edges keep the handle visible across every user-selected colour.
  thumb: { borderWidth: 1, borderColor: '#000000', padding: 1 },
  thumbInner: { flex: 1, alignSelf: 'stretch', borderWidth: 2, borderColor: '#FFFFFF' },
});
