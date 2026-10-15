import { nearestSessionIndex, sessionChartLayout, shapePreservingPath } from './sessionChartLayout';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Polyline, Circle, Path, Text as SvgText } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ForgeText as Text, Button } from '../ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import type { ForgeLinePoint } from './ForgeLineChart';

/** Date-positioned session points and their already-classified trailing medians. */
export function ForgeSessionLineChart({
  data,
  height,
  color,
  formatValue,
  selectionPlacement = 'below',
  showAxes = false,
}: {
  data: ForgeLinePoint[];
  height: number;
  color: string;
  formatValue: (value: number) => string;
  selectionPlacement?: 'above' | 'below';
  showAxes?: boolean;
}) {
  const theme = useForgeTheme();
  const chartRef = useRef<View>(null);
  const [width, setWidth] = useState(0);
  const [selection, setSelection] = useState(data.length - 1);
  const selected = Math.max(0, Math.min(selection, data.length - 1));
  const selectedOnUI = useSharedValue(data.length - 1);
  const positionsOnUI = useSharedValue<number[]>([]);
  const identity = JSON.stringify(
    data.map(({ date, value, trend, label, description }) => [
      date,
      value,
      trend,
      label,
      description,
    ]),
  );
  const values = data
    .flatMap((point) => [point.value, point.trend])
    .filter((value): value is number => value !== undefined && Number.isFinite(value));
  const minimum = values.reduce((value, next) => Math.min(value, next), values[0] ?? 0);
  const maximum = values.reduce((value, next) => Math.max(value, next), values[0] ?? 0);
  const ticks = minimum === maximum ? [minimum] : [minimum, (minimum + maximum) / 2, maximum];
  const axisWidth = showAxes
    ? Math.max(
        40,
        ...ticks.map((value) => Number(value.toFixed(1)).toLocaleString().length * 7 + 12),
      )
    : 0;
  const layout = useMemo(
    () =>
      sessionChartLayout(
        data as (ForgeLinePoint & { date: number })[],
        Math.max(0, width - axisWidth),
        height,
      ),
    [data, width, height, axisWidth],
  );
  const x = (point: ForgeLinePoint) => layout.x(point.date!) + axisWidth;
  const y = layout.y;
  const positions = data.map(x);
  const markerCount = Math.min(data.length, 60);
  const markerIndices = Array.from({ length: markerCount }, (_, index) =>
    markerCount > 1 ? Math.round((index * (data.length - 1)) / (markerCount - 1)) : 0,
  );
  const trend = data.filter((point) => point.trend !== undefined);
  const trendPath = shapePreservingPath(
    trend.map((point) => ({ x: x(point), y: y(point.trend!) })),
  );
  useEffect(() => {
    selectedOnUI.set(data.length - 1);
    setSelection(data.length - 1);
  }, [identity, selectedOnUI]);
  useEffect(() => {
    positionsOnUI.set(positions);
  }, [identity, width, height, positionsOnUI]);
  const commitSelection = useCallback((index: number) => setSelection(index), []);
  useAnimatedReaction(
    () => selectedOnUI.get(),
    (index, previous) => {
      if (index !== previous && index >= 0) scheduleOnRN(commitSelection, index);
    },
  );
  const selectAt = (target: number) => selectedOnUI.set(nearestSessionIndex(positions, target));
  const scrub = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-8, 8])
    .onUpdate((event) => {
      selectedOnUI.set(nearestSessionIndex(positionsOnUI.get(), event.x));
    });
  const readout = data.length ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Button
        icon="chevron-back"
        accessibilityLabel="Previous session point"
        variant="ghost"
        disabled={selected <= 0}
        onPress={() => selectedOnUI.set(selected - 1)}
        style={{ minWidth: 44, minHeight: 44 }}
      />
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text
          testID="exercise-progress-selection"
          accessibilityLiveRegion="polite"
          style={[typeScale.supporting, { color: theme.textPrimary }]}
        >{`${data[selected].description ?? data[selected].label}: ${formatValue(data[selected].value)}`}</Text>
      </View>
      <Button
        icon="chevron-forward"
        accessibilityLabel="Next session point"
        variant="ghost"
        disabled={selected >= data.length - 1}
        onPress={() => selectedOnUI.set(selected + 1)}
        style={{ minWidth: 44, minHeight: 44 }}
      />
    </View>
  ) : null;
  return (
    <View
      ref={chartRef}
      testID="exercise-progress-chart"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {selectionPlacement === 'above' ? readout : null}
      {width > 0 && data.length ? (
        <GestureDetector gesture={scrub} touchAction="pan-y">
          <Animated.View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select a session point on the chart"
              onPress={(event) => {
                if ('detail' in event.nativeEvent && event.nativeEvent.detail === 0) {
                  selectedOnUI.set(0);
                  return;
                }
                const { locationX, pageX } = event.nativeEvent;
                if (Number.isFinite(locationX)) selectAt(locationX);
                else if (Number.isFinite(pageX)) {
                  // Browser click events supply page coordinates rather than RN's local coordinates.
                  chartRef.current?.measure((_x, _y, _width, _height, left) =>
                    selectAt(pageX - left),
                  );
                } else selectedOnUI.set(0);
              }}
            >
              <Svg pointerEvents="none" width={width} height={height}>
                {showAxes
                  ? ticks.map((value) => (
                      <React.Fragment key={value}>
                        <Line
                          x1={axisWidth}
                          x2={width - 16}
                          y1={y(value)}
                          y2={y(value)}
                          stroke={theme.border}
                          strokeOpacity={0.6}
                        />
                        <SvgText
                          x={axisWidth - 8}
                          y={y(value) + 4}
                          textAnchor="end"
                          fill={theme.textSecondary}
                          fontFamily={typeScale.caption.fontFamily}
                          fontSize={typeScale.caption.fontSize}
                        >
                          {Number(value.toFixed(1)).toLocaleString()}
                        </SvgText>
                      </React.Fragment>
                    ))
                  : [0, 0.5, 1].map((fraction) => (
                      <Line
                        key={fraction}
                        x1={16}
                        x2={width - 16}
                        y1={12 + fraction * (height - 24)}
                        y2={12 + fraction * (height - 24)}
                        stroke={theme.divider}
                      />
                    ))}
                <Polyline
                  points={data.map((point) => `${x(point)},${y(point.value)}`).join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                />
                {trend.length > 1 ? (
                  <Path
                    d={trendPath}
                    fill="none"
                    stroke={color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                ) : null}
                <Line
                  testID="exercise-progress-selection-guide"
                  x1={x(data[selected])}
                  x2={x(data[selected])}
                  y1={12}
                  y2={height - 12}
                  stroke={theme.textSecondary}
                  strokeOpacity={0.65}
                  strokeDasharray="3 4"
                />
                {markerIndices
                  .filter((index) => index !== selected)
                  .map((index) => (
                    <Circle
                      key={index}
                      cx={x(data[index])}
                      cy={y(data[index].value)}
                      r={3}
                      fill={theme.surface}
                      stroke={color}
                      strokeOpacity={0.6}
                      strokeWidth={1}
                    />
                  ))}
                <Circle
                  cx={x(data[selected])}
                  cy={y(data[selected].value)}
                  r={5}
                  fill={color}
                  stroke={color}
                  strokeWidth={2}
                />
              </Svg>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      ) : null}
      {selectionPlacement === 'below' ? readout : null}
      {trend.length > 1 ? (
        <View
          style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
        >
          <View style={{ width: 16, height: 1.5, backgroundColor: color, opacity: 0.6 }} />
          <Text style={[typeScale.caption, { color: theme.textSecondary }]}>Sessions</Text>
          <View style={{ width: 16, height: 2.5, backgroundColor: color, marginLeft: 8 }} />
          <Text style={[typeScale.caption, { color: theme.textSecondary }]}>Trend</Text>
        </View>
      ) : null}
      {data.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[typeScale.caption, { color: theme.textSecondary }]}>{data[0].label}</Text>
          <Text style={[typeScale.caption, { color: theme.textSecondary }]}>
            {data[data.length - 1].label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
