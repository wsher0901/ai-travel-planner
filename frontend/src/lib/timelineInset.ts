export const TIMELINE_INSET_PCT = 2;

export function hourToTimelinePercent(hourFloat: number): number {
  const usable = 100 - 2 * TIMELINE_INSET_PCT;
  return TIMELINE_INSET_PCT + (hourFloat / 24) * usable;
}

export function minuteToTimelinePercent(minute: number): number {
  return hourToTimelinePercent(minute / 60);
}

// For mask builders — given sample index 0..N-1, return its inset-aware percent.
export function sampleIndexToInsetPercent(i: number, samples: number): number {
  const usable = 100 - 2 * TIMELINE_INSET_PCT;
  return TIMELINE_INSET_PCT + (i / (samples - 1)) * usable;
}
