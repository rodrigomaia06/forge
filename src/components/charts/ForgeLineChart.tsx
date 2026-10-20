import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ForgeLinePlot } from './ForgeLinePlot';
import { ForgeSessionLineChart } from './ForgeSessionLineChart';
import { sessionChartLayout } from './sessionChartLayout';
import { useForgeTheme } from '../../theme/ThemeProvider';

export interface ForgeLinePoint {
  value: number;
  date?: number;
  trend?: number;
  label?: string;
  description?: string;
}

/** Shared entry point for compact graphs and dated session charts. */
export function ForgeLineChart({
  data,
  height = 120,
  color,
  showAxes = false,
  showMarkers = true,
  showTooltip = false,
  showTrendLine = false,
  curved = true,
  formatValue = (v) => `${Math.round(v * 10) / 10}`,
  yAxisUnit = '',
  selectionPlacement = 'below',
  selectedIndex,
  onSelectionChange,
}: {
  data: ForgeLinePoint[];
  height?: number;
  color?: string;
  showAxes?: boolean;
  showMarkers?: boolean;
  showTooltip?: boolean;
  showTrendLine?: boolean;
  curved?: boolean;
  formatValue?: (value: number) => string;
  yAxisUnit?: string;
  selectionPlacement?: 'above' | 'below' | 'none';
  selectedIndex?: number;
  onSelectionChange?: (index: number) => void;
}) {
  const theme = useForgeTheme();
  const [width, setWidth] = useState(0);
  const stroke = color ?? theme.selectionIndicator;
  const points = data
    .filter((p) => Number.isFinite(p.value))
    .map((p, index) => ({ ...p, date: p.date ?? index }));
  if (data.some((p) => p.date !== undefined) || showAxes || showTooltip) {
    return (
      <ForgeSessionLineChart
        data={points}
        height={height}
        color={stroke}
        formatValue={(v) => `${formatValue(v)}${yAxisUnit}`}
        selectionPlacement={selectionPlacement}
        showAxes={showAxes}
        selectedIndex={selectedIndex}
        onSelectionChange={onSelectionChange}
      />
    );
  }
  const n = points.length;
  let regression: { date: number; value: number }[] = [];
  if (showTrendLine && n >= 2) {
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumXX = 0;
    points.forEach(({ value }, i) => {
      sumX += i;
      sumY += value;
      sumXY += i * value;
      sumXX += i * i;
    });
    const denominator = n * sumXX - sumX * sumX;
    const slope = denominator ? (n * sumXY - sumX * sumY) / denominator : 0;
    const intercept = (sumY - slope * sumX) / n;
    regression = [
      { date: 0, value: intercept },
      { date: n - 1, value: intercept + slope * (n - 1) },
    ];
  }
  const layout = sessionChartLayout([...points, ...regression], width, height, {
    horizontal: 6,
    vertical: 4,
  });
  const coordinates = (series: typeof regression) =>
    series.map((p) => ({ x: layout.x(p.date), y: layout.y(p.value) }));
  return (
    <View
      testID="forge-sparkline"
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={{ width: '100%', height, overflow: 'hidden' }}
    >
      {width > 0 && n >= 2 ? (
        <>
          <ForgeLinePlot
            points={coordinates(points)}
            color={stroke}
            width={width}
            height={height}
            smooth={curved}
            fill
          />
          <ForgeLinePlot
            points={coordinates(regression)}
            color={theme.slate}
            width={width}
            height={height}
            thickness={2}
            dashed
          />
          {showMarkers ? (
            <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
              {points.map((p, i) => (
                <Circle key={i} cx={layout.x(p.date)} cy={layout.y(p.value)} r={3} fill={stroke} />
              ))}
            </Svg>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
