import type { WorkoutMap } from '../types';

export const workoutsByDate: WorkoutMap = {
  3: [
    {
      name: 'Upper strength',
      type: 'Strength',
      duration: '58 min',
      summary: '5 exercises · 18 sets',
    },
  ],
  6: [
    {
      name: 'Lower strength',
      type: 'Strength',
      duration: '1 h 04 min',
      summary: '6 exercises · 21 sets',
    },
  ],
  10: [
    {
      name: 'Upper strength',
      type: 'Strength',
      duration: '52 min',
      summary: '5 exercises · 16 sets',
    },
    {
      name: 'Court session',
      type: 'Court sport',
      duration: '1 h 12 min',
      summary: 'Duration-based · 1 session',
    },
  ],
  13: [
    {
      name: 'Pull + posterior',
      type: 'Strength',
      duration: '47 min',
      summary: '5 exercises · 15 sets',
    },
  ],
  17: [
    {
      name: 'Lower strength',
      type: 'Strength',
      duration: '1 h 01 min',
      summary: '6 exercises · 20 sets',
    },
  ],
  20: [
    {
      name: 'Upper strength',
      type: 'Strength',
      duration: '55 min',
      summary: '5 exercises · 17 sets',
    },
  ],
  24: [
    {
      name: 'Full body',
      type: 'Strength',
      duration: '1 h 09 min',
      summary: '7 exercises · 23 sets',
    },
  ],
};

export const monthDays = Array.from({ length: 31 }, (_, index) => index + 1);
