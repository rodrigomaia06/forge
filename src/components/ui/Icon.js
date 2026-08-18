import React from 'react';
import {
  BarbellIcon,
  CalendarBlankIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ClockIcon,
  DotsThreeIcon,
  PlusIcon,
  QuestionIcon,
  StackIcon,
  TimerIcon,
} from 'phosphor-react-native';

const iconMap = {
  add: PlusIcon,
  'chevron-back': CaretLeftIcon,
  'chevron-forward': CaretRightIcon,
  calendar: CalendarBlankIcon,
  'calendar-outline': CalendarBlankIcon,
  'calendar-clear-outline': CalendarBlankIcon,
  layers: StackIcon,
  'layers-outline': StackIcon,
  time: ClockIcon,
  'time-outline': ClockIcon,
  'ellipsis-horizontal': DotsThreeIcon,
  fitness: BarbellIcon,
  'fitness-outline': BarbellIcon,
  stopwatch: TimerIcon,
  'stopwatch-outline': TimerIcon,
};

export function Icon({ name, size = 20, color, weight = 'regular', ...props }) {
  const IconComponent = iconMap[name] || QuestionIcon;
  return <IconComponent size={size} color={color} weight={weight} {...props} />;
}
