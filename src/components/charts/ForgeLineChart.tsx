import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { ForgeText as Text } from '../ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';

export interface ForgeLinePoint {
  value: number;
  /** Axis label (e.g. a short date); shown only when `showAxes`. */
  label?: string;
}

/**
 * A Forge-themed line/area chart over gifted-charts. Measures its own width so
 * it fills the container responsively, then computes point spacing to fit.
 *
 * - Tiles: `height` ~64, `showAxes={false}`, few or no markers.
 * - Detail pages: taller, `showAxes`, `showTooltip` for a scrub pointer.
 */
export function ForgeLineChart({
  data,
  height = 120,
  color,
  showAxes = false,
  showMarkers = true,
  showTooltip = false,
  curved = true,
  formatValue = (v) => `${Math.round(v * 10) / 10}`,
  yAxisUnit = '',
}: {
  data: ForgeLinePoint[];
  height?: number;
  color?: string;
  showAxes?: boolean;
  showMarkers?: boolean;
  showTooltip?: boolean;
  curved?: boolean;
  formatValue?: (v: number) => string;
  yAxisUnit?: string;
}) {
  const theme = useForgeTheme();
  const [width, setWidth] = useState(0);
  const stroke = color ?? theme.selectionIndicator ?? theme.ink;
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  if (data.length < 2) {
    return <View style={{ height }} onLayout={onLayout} />;
  }

  // Leave room on the left for y-axis labels only when axes are shown.
  const yAxisWidth = showAxes ? 34 : 0;
  const initialSpacing = showAxes ? 8 : 6;
  const endSpacing = showAxes ? 8 : 6;
  const plotWidth = Math.max(0, width - yAxisWidth);
  const spacing = plotWidth > 0 ? (plotWidth - initialSpacing - endSpacing) / (data.length - 1) : 1;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = (max - min) || Math.max(1, Math.abs(max) * 0.1);
  // A sparkline (no axes) drops its baseline near the data so the line fills the
  // height even when values sit far from zero (e.g. bodyweight ~82kg); an axis
  // chart keeps real values so its y-labels stay meaningful.
  const floor = showAxes ? 0 : min - span * 0.2;
  const chartData = data.map((d) => ({ value: d.value - floor, label: d.label }));
  const chartMax = showAxes ? max + span * 0.15 : (max - floor) + span * 0.12;
  const chartOffset = showAxes ? Math.max(0, min - span * 0.15) : 0;

  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      {width > 0 ? (
        <LineChart
          data={chartData}
          width={plotWidth}
          height={height}
          spacing={spacing}
          initialSpacing={initialSpacing}
          endSpacing={endSpacing}
          adjustToWidth
          disableScroll
          curved={curved}
          isAnimated
          animationDuration={600}
          thickness={2.5}
          color={stroke}
          areaChart
          startFillColor={stroke}
          endFillColor={stroke}
          startOpacity={0.22}
          endOpacity={0.02}
          hideDataPoints={!showMarkers}
          dataPointsColor={stroke}
          dataPointsRadius={3}
          // Axes / grid
          yAxisThickness={0}
          xAxisThickness={0}
          hideRules={!showAxes}
          rulesColor={theme.border}
          rulesType="solid"
          hideYAxisText={!showAxes}
          yAxisTextStyle={{ color: theme.muted, ...typeScale.caption }}
          xAxisLabelTextStyle={{ color: theme.muted, ...typeScale.caption }}
          yAxisLabelWidth={yAxisWidth}
          yAxisLabelSuffix={yAxisUnit}
          noOfSections={showAxes ? 3 : 2}
          maxValue={chartMax}
          yAxisOffset={chartOffset}
          pointerConfig={
            showTooltip
              ? {
                  pointerStripColor: theme.border,
                  pointerStripWidth: 1,
                  pointerColor: stroke,
                  radius: 4,
                  activatePointersOnLongPress: false,
                  autoAdjustPointerLabelPosition: true,
                  pointerLabelComponent: (items: { value: number }[]) => (
                    <View
                      style={{
                        backgroundColor: theme.ink,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                        minWidth: 40,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: theme.surface, ...typeScale.caption }}>
                        {formatValue(items[0]?.value ?? 0)}
                        {yAxisUnit}
                      </Text>
                    </View>
                  ),
                }
              : undefined
          }
        />
      ) : null}
    </View>
  );
}
