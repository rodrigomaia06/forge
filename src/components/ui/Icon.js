import React from 'react';
import {
  BookStack,
  Calendar,
  Clock,
  MoreHoriz,
  NavArrowLeft,
  NavArrowRight,
  Plus,
  QuestionMark,
  Timer,
  WeightAlt,
} from 'iconoir-react-native';

const iconMap = {
  add: Plus,
  'chevron-back': NavArrowLeft,
  'chevron-forward': NavArrowRight,
  calendar: Calendar,
  'calendar-outline': Calendar,
  'calendar-clear-outline': Calendar,
  layers: BookStack,
  'layers-outline': BookStack,
  time: Clock,
  'time-outline': Clock,
  'ellipsis-horizontal': MoreHoriz,
  fitness: WeightAlt,
  'fitness-outline': WeightAlt,
  stopwatch: Timer,
  'stopwatch-outline': Timer,
};

export function Icon({ name, size = 20, color, weight = 'regular', ...props }) {
  const IconComponent = iconMap[name] || QuestionMark;
  return <IconComponent width={size} height={size} color={color} strokeWidth={weight === 'thin' ? 1 : 1.7} {...props} />;
}
