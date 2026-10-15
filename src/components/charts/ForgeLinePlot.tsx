import React from 'react';
import { View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import type { ChartCoordinate } from './sessionChartLayout';
import { linePlotData } from './linePlotData';

/** Gifted Charts owns every plotted line; Forge owns domains and session selection. */
export function ForgeLinePlot({
  points,
  width,
  height,
  color,
  thickness = 2.5,
  smooth = false,
  opacity = 1,
  fill = false,
  dashed = false,
}: {
  points: readonly ChartCoordinate[];
  width: number;
  height: number;
  color: string;
  thickness?: number;
  smooth?: boolean;
  opacity?: number;
  fill?: boolean;
  dashed?: boolean;
}) {
  if (points.length < 2 || width <= 0 || height <= 0) return null;
  return (
    <View
      testID="forge-line-plot"
      pointerEvents="none"
      // Gifted's hidden-axis layout places its path one point above our plot coordinates.
      style={{ position: 'absolute', top: 1, left: 0, width, height, opacity }}
    >
      <LineChart
        data={linePlotData(points, height, smooth)}
        width={width}
        height={height}
        maxValue={height}
        mostNegativeValue={0}
        initialSpacing={points[0].x}
        endSpacing={0}
        spacing={0}
        yAxisLabelWidth={0}
        yAxisThickness={0}
        xAxisThickness={0}
        xAxisLabelsHeight={0}
        yAxisExtraHeight={0}
        overflowTop={0}
        overflowBottom={0}
        hideAxesAndRules
        hideDataPoints
        disableScroll
        isAnimated={false}
        curved={false}
        color={color}
        thickness={thickness}
        strokeDashArray={dashed ? [6, 5] : undefined}
        areaChart={fill}
        startFillColor={color}
        endFillColor={color}
        startOpacity={0.22}
        endOpacity={0.02}
      />
    </View>
  );
}
