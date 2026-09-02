/** Matches Forge's native picker: 30 seconds through 10 minutes in five-second steps. */
export const REST_DURATION_OPTIONS: readonly number[] = Array.from(
  { length: ((10 * 60) - 30) / 5 + 1 },
  (_, index) => 30 + index * 5,
);
