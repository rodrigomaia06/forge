import { sessionChartLayout } from './sessionChartLayout';
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Polyline, Circle } from 'react-native-svg';
import { ForgeText as Text, Button, ForgePressable as Pressable } from '../ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import type { ForgeLinePoint } from './ForgeLineChart';

/** Date-positioned session points and their already-classified trailing medians. */
export function ForgeSessionLineChart({
  data,
  height,
  color,
  formatValue,
}: {
  data: ForgeLinePoint[];
  height: number;
  color: string;
  formatValue: (value: number) => string;
}) {
  const theme = useForgeTheme();
  const chartRef = useRef<View>(null);
  const [width, setWidth] = useState(0);
  const [selection, setSelection] = useState<number | null>(null);
  const selected = Math.min(selection ?? data.length - 1, data.length - 1);
  const layout = sessionChartLayout(data as (ForgeLinePoint & { date: number })[], width, height);
  const x = (point: ForgeLinePoint) => layout.x(point.date!);
  const y = layout.y;
  const trend = data.filter((point) => point.trend !== undefined);
  const selectAt = (target: number) => {
    let nearest = 0;
    data.forEach((point, index) => {
      if (Math.abs(x(point) - target) < Math.abs(x(data[nearest]) - target)) nearest = index;
    });
    setSelection(nearest);
  };
  return (
    <View
      ref={chartRef}
      testID="exercise-progress-chart"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && data.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select a session point on the chart"
          onPress={(event) => {
            if ('detail' in event.nativeEvent && event.nativeEvent.detail === 0) {
              setSelection(0);
              return;
            }
            const { locationX, pageX } = event.nativeEvent;
            if (Number.isFinite(locationX)) selectAt(locationX);
            else if (Number.isFinite(pageX)) {
              // Browser click events supply page coordinates rather than RN's local coordinates.
              chartRef.current?.measure((_x, _y, _width, _height, left) => selectAt(pageX - left));
            } else setSelection(0);
          }}
        >
          <Svg pointerEvents="none" width={width} height={height}>
            {[0, 0.5, 1].map((fraction) => (
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
              strokeWidth={2}
            />
            {trend.length > 1 ? (
              <Polyline
                points={trend.map((point) => `${x(point)},${y(point.trend!)}`).join(' ')}
                fill="none"
                stroke={theme.textSecondary}
                strokeWidth={2}
                strokeDasharray="5 4"
              />
            ) : null}
            {data.map((point, index) => (
              <Circle
                key={index}
                cx={x(point)}
                cy={y(point.value)}
                r={index === selected ? 5 : 3}
                fill={color}
              />
            ))}
          </Svg>
        </Pressable>
      ) : null}
      {data.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Button
            icon="chevron-back"
            accessibilityLabel="Previous session point"
            variant="ghost"
            disabled={selected <= 0}
            onPress={() => setSelection(selected - 1)}
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
            onPress={() => setSelection(selected + 1)}
            style={{ minWidth: 44, minHeight: 44 }}
          />
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
