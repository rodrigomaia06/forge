import type { UnitsPreference } from '../../types';
import type { ProgressMetric } from './progress';
import { formatDuration } from './tracking';

export function formatProgressValue(
  metric: ProgressMetric,
  value: number,
  units: UnitsPreference,
): string {
  const imperial = units === 'imperial';
  if (metric === 'load' || metric === 'volume')
    return `${Number((value * (imperial ? 2.2046226218 : 1)).toFixed(1))} ${imperial ? 'lb' : 'kg'}${metric === 'volume' ? ' · reps' : ''}`;
  if (metric === 'distance')
    return `${Number((value * (imperial ? 0.6213711922 : 1)).toFixed(2))} ${imperial ? 'mi' : 'km'}`;
  if (metric === 'pace')
    return `${formatDuration(Math.round(value * (imperial ? 1.609344 : 1)))}/${imperial ? 'mi' : 'km'}`;
  if (metric === 'longest-duration' || metric === 'total-duration')
    return formatDuration(Math.round(value));
  return `${value} reps`;
}
