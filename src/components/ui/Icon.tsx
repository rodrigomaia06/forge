import React from 'react';
import type { SvgProps } from 'react-native-svg';
import type { IconName, IconWeight } from '../../types';
import {
  BookStack,
  Calendar,
  Clock,
  Gym,
  Home,
  Menu,
  MoreHoriz,
  NavArrowLeft,
  NavArrowRight,
  NavArrowDown,
  Book,
  Basketball,
  Activity,
  Check,
  Play,
  Plus,
  QuestionMark,
  Timer,
  Trash,
  Running,
  Stretching,
  TennisBall,
  Ruler,
  Edit,
  ClockRotateRight,
  FireFlame,
  InfoCircle,
  Xmark,
} from 'iconoir-react-native';

const iconMap: Record<IconName, React.ComponentType<SvgProps>> = {
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
  fitness: Gym,
  'fitness-outline': Gym,
  basketball: Basketball,
  activity: Activity,
  running: Running,
  stretching: Stretching,
  'tennis-ball': TennisBall,
  stopwatch: Timer,
  'stopwatch-outline': Timer,
  trash: Trash,
  check: Check,
  measure: Ruler,
  note: Edit,
  history: ClockRotateRight,
  'warm-up': FireFlame,
  info: InfoCircle,
  close: Xmark,
  'arrow-forward': NavArrowRight,
};

export function Icon({
  name,
  size = 20,
  color,
  weight = 'regular',
  ...props
}: { name: IconName; size?: number; color?: string; weight?: IconWeight } & Omit<
  SvgProps,
  'color' | 'width' | 'height'
>) {
  const IconComponent = iconMap[name] || QuestionMark;
  const strokeWidth = weight === 'thin' ? 1.5 : weight === 'bold' ? 3 : 2.1;
  return (
    <IconComponent width={size} height={size} color={color} strokeWidth={strokeWidth} {...props} />
  );
}
