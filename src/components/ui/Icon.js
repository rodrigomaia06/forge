import React from 'react';
import {
  BookStack,
  Calendar,
  Clock,
  Home,
  Menu,
  MoreHoriz,
  NavArrowLeft,
  NavArrowRight,
  NavArrowDown,
  Book,
  Play,
  Plus,
  QuestionMark,
  Timer,
  WeightAlt,
} from 'iconoir-react-native';

const iconMap = {
  add: Plus,
  'chevron-back': NavArrowLeft,
  'chevron-forward': NavArrowRight,
  'chevron-down': NavArrowDown,
  calendar: Calendar,
  'calendar-outline': Calendar,
  'calendar-clear-outline': Calendar,
  home: Home,
  'home-outline': Home,
  layers: BookStack,
  'layers-outline': BookStack,
  book: Book,
  play: Play,
  time: Clock,
  'time-outline': Clock,
  'ellipsis-horizontal': MoreHoriz,
  menu: Menu,
  fitness: WeightAlt,
  'fitness-outline': WeightAlt,
  stopwatch: Timer,
  'stopwatch-outline': Timer,
};

export function Icon({ name, size = 20, color, weight = 'regular', ...props }) {
  const IconComponent = iconMap[name] || QuestionMark;
  const strokeWidth = weight === 'thin' ? 1.5 : weight === 'bold' ? 3 : 2.1;
  return <IconComponent width={size} height={size} color={color} strokeWidth={strokeWidth} {...props} />;
}
