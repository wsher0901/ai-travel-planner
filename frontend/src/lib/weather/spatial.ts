import type { SceneAtmosphere } from './types';

// 0..24h ↔ 0..stripWidth(px). The day strip is hour-major: left edge is
// 00:00, right edge is the start of the next 00:00. Note: timeAxis.ts has
// a similar `timeToPercent(t: string | Date)` for formatted time strings;
// these helpers operate on raw fractional hours and pixel widths so they
// stay independent of clock formatting.

const HOURS_PER_DAY = 24;
export const ATMOSPHERE_SAMPLES = 48; // every 30 min; 3B's smooth-gradient floor

export function hourToX(hour: number, stripWidth: number): number {
  return (hour / HOURS_PER_DAY) * stripWidth;
}

export function xToHour(x: number, stripWidth: number): number {
  if (stripWidth <= 0) return 0;
  return (x / stripWidth) * HOURS_PER_DAY;
}

// Sample-index helpers — used by overlays building 48-stop CSS gradients.
export function sampleIndexToHour(i: number, samples = ATMOSPHERE_SAMPLES): number {
  return (i / samples) * HOURS_PER_DAY;
}

export function sampleIndexToPercent(i: number, samples = ATMOSPHERE_SAMPLES): number {
  return (i / (samples - 1)) * 100;
}

// Convenience for components that want a single atmosphere at one x. Most
// horizontal-mapping components use the precomputed `samples` array from
// useSceneWeather().getAtmosphereAcrossDay() instead — that's cheaper than
// re-deriving for each x.
export function getAtmosphereAtX(
  x: number,
  stripWidth: number,
  getAtmosphereAtTime: (hourFloat: number) => SceneAtmosphere | null,
): SceneAtmosphere | null {
  return getAtmosphereAtTime(xToHour(x, stripWidth));
}
