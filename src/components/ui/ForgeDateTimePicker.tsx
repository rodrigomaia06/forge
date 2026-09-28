import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { WeekStartsOn } from '../../types';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { ForgeText as Text } from './ForgeText';
import { ForgeWheelColumn } from './ForgeWheelColumn';
import { Icon } from './Icon';
import { lightHaptic, selectionHaptic } from './haptics';
import { pressedFeedback } from './pressFeedback';

export type ForgeDateTimePickerMode = 'date' | 'time';

interface ForgeDateTimePickerProps {
  mode: ForgeDateTimePickerMode;
  value: Date;
  onChange: (value: Date) => void;
  weekStartsOn: WeekStartsOn;
  testID?: string;
}

/** A platform-neutral Forge date or time control. Parent sheets own draft and commit behavior. */
export function ForgeDateTimePicker({
  mode,
  value,
  onChange,
  weekStartsOn,
  testID,
}: ForgeDateTimePickerProps) {
  return mode === 'date' ? (
    <ForgeDatePicker value={value} onChange={onChange} weekStartsOn={weekStartsOn} testID={testID} />
  ) : (
    <ForgeTimePicker value={value} onChange={onChange} testID={testID} />
  );
}

function ForgeDatePicker({
  value,
  onChange,
  weekStartsOn,
  testID,
}: Omit<ForgeDateTimePickerProps, 'mode'>) {
  const theme = useForgeTheme();
  const [month, setMonth] = useState(() => startOfMonth(value));

  useEffect(() => {
    setMonth(startOfMonth(value));
  }, [value.getFullYear(), value.getMonth()]);

  const days = useMemo(() => daysForMonth(month, weekStartsOn), [month, weekStartsOn]);
  const weekdays = weekStartsOn === 1 ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const previousMonthLabel = formatMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const nextMonthLabel = formatMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  const previousMonth = () => {
    lightHaptic();
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    lightHaptic();
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  return (
    <View testID={testID} accessibilityLabel="Date picker" style={styles.datePicker}>
      <View style={styles.monthHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={previousMonth}
          style={({ pressed }) => [styles.monthButton, { backgroundColor: theme.surfaceMuted }, pressed && pressedFeedback]}
        >
          <Icon name="chevron-back" size={20} color={theme.textPrimary} />
          <Text style={[styles.monthButtonText, { color: theme.textPrimary }]}>{previousMonthLabel}</Text>
        </Pressable>
        <Text style={[styles.monthTitle, { color: theme.textPrimary }]}>
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={nextMonth}
          style={({ pressed }) => [styles.monthButton, { backgroundColor: theme.surfaceMuted }, pressed && pressedFeedback]}
        >
          <Text style={[styles.monthButtonText, { color: theme.textPrimary }]}>{nextMonthLabel}</Text>
          <Icon name="chevron-forward" size={20} color={theme.textPrimary} />
        </Pressable>
      </View>
      <View style={styles.weekdays}>
        {weekdays.map((weekday, index) => (
          <Text key={`${weekday}-${index}`} style={[styles.weekday, { color: theme.textSecondary }]}>{weekday}</Text>
        ))}
      </View>
      <View style={styles.dayGrid}>
        {days.map((day, index) => {
          if (!day) return <View key={`blank-${index}`} style={styles.dayCell} />;
          const selected = sameDay(day, value);
          return (
            <View key={day.toISOString()} style={styles.dayCell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Select ${day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}
                accessibilityState={{ selected }}
                onPress={() => {
                  selectionHaptic();
                  onChange(withDate(value, day));
                }}
                style={({ pressed }) => [
                  styles.dayButton,
                  selected && { backgroundColor: theme.selectionIndicator },
                  pressed && pressedFeedback,
                ]}
              >
                <Text style={[styles.dayText, { color: selected ? theme.onActionPrimary : theme.textPrimary }]}>{day.getDate()}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ForgeTimePicker({ value, onChange, testID }: Omit<ForgeDateTimePickerProps, 'mode' | 'weekStartsOn'>) {
  const theme = useForgeTheme();
  return (
    <View testID={testID} accessibilityLabel="Time picker" style={styles.timePicker}>
      <View style={styles.timeColumn}>
        <ForgeWheelColumn
          label="Hours"
          testID="forge-time-hours-wheel"
          accessibilityRole="radio"
          options={HOURS}
          selectedValue={value.getHours()}
          visibleRows={WHEEL_TIME_VISIBLE_ROWS}
          formatValue={pad}
          accessibilityLabel={(hour) => `Hours ${pad(hour)}`}
          onSelect={(hour) => {
            const next = new Date(value);
            next.setHours(hour);
            onChange(next);
          }}
        />
      </View>
      <Text style={[styles.timeSeparator, { color: theme.textPrimary }]}>:</Text>
      <View style={styles.timeColumn}>
        <ForgeWheelColumn
          label="Minutes"
          testID="forge-time-minutes-wheel"
          accessibilityRole="radio"
          options={MINUTES}
          selectedValue={value.getMinutes()}
          visibleRows={WHEEL_TIME_VISIBLE_ROWS}
          formatValue={pad}
          accessibilityLabel={(minute) => `Minutes ${pad(minute)}`}
          onSelect={(minute) => {
            const next = new Date(value);
            next.setMinutes(minute);
            onChange(next);
          }}
        />
      </View>
    </View>
  );
}

const HOURS = Array.from({ length: 24 }, (_, value) => value);
const MINUTES = Array.from({ length: 60 }, (_, value) => value);
const WHEEL_TIME_VISIBLE_ROWS = 5;

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function formatMonth(value: Date): string {
  return value.toLocaleDateString(undefined, { month: 'short' });
}

function daysForMonth(month: Date, weekStartsOn: WeekStartsOn): Array<Date | null> {
  const leading = (month.getDay() - weekStartsOn + 7) % 7;
  const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
  ];
}

function withDate(current: Date, next: Date): Date {
  const value = new Date(current);
  value.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
  return value;
}

function sameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

const styles = StyleSheet.create({
  datePicker: { gap: 12, paddingHorizontal: 4 },
  monthHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthButton: { minWidth: 76, height: 44, paddingHorizontal: 10, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  monthButtonText: { ...typeScale.label },
  monthTitle: { flex: 1, textAlign: 'center', ...typeScale.cardTitle },
  weekdays: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', ...typeScale.caption },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', height: 44, alignItems: 'center', justifyContent: 'center' },
  dayButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayText: { ...typeScale.supporting },
  timePicker: { minHeight: 250, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  timeSeparator: { marginTop: 22, ...typeScale.sectionTitle },
  timeColumn: { width: 112 },
});
