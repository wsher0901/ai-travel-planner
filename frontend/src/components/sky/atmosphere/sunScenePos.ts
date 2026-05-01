import type { SunTimes } from '@/lib/sunPosition';
import { TIMELINE_INSET_PCT } from '@/lib/timelineInset';

// Mirrors the bezier arc geometry used by CelestialBodies.tsx so the
// SunnyGlow center lines up with the rendered sun disc. Constants must
// match CelestialBodies.tsx (ARC_HORIZON_Y=215, ARC_APEX_Y=-90).
const ARC_HORIZON_Y = 215;
const ARC_APEX_Y = -90;
const VIEWBOX_W = 1000;
const VIEWBOX_H = 200;

function minuteToInsetViewboxX(minute: number): number {
  return (TIMELINE_INSET_PCT / 100 + (minute / 1440) * (1 - 2 * TIMELINE_INSET_PCT / 100)) * VIEWBOX_W;
}

function bezierYatX(
  x0: number, ctrlX: number, x1: number,
  y0: number, ctrlY: number, y1: number,
  targetX: number,
): number | null {
  const a = x0 - 2 * ctrlX + x1;
  const b = 2 * (ctrlX - x0);
  const cc = x0 - targetX;
  let t: number | null = null;
  if (Math.abs(a) < 0.001) {
    if (Math.abs(b) > 0.001) t = -cc / b;
  } else {
    const disc = b * b - 4 * a * cc;
    if (disc >= 0) {
      const t1 = (-b + Math.sqrt(disc)) / (2 * a);
      const t2 = (-b - Math.sqrt(disc)) / (2 * a);
      if (t1 >= 0 && t1 <= 1) t = t1;
      else if (t2 >= 0 && t2 <= 1) t = t2;
    }
  }
  if (t === null) return null;
  return (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ctrlY + t * t * y1;
}

function viewboxToPct(x: number, y: number): { x: number; y: number } {
  return { x: (x / VIEWBOX_W) * 100, y: (y / VIEWBOX_H) * 100 };
}

export function getSunScenePctAtMinute(
  sunTimes: SunTimes,
  minute: number,
): { x: number; y: number } | null {
  const { sunriseMin, sunsetMin, solarNoonMin } = sunTimes;
  if (
    !Number.isFinite(sunriseMin) ||
    !Number.isFinite(sunsetMin) ||
    !Number.isFinite(solarNoonMin)
  ) return null;

  if (minute < sunriseMin || minute > sunsetMin) return null;

  const x0 = minuteToInsetViewboxX(sunriseMin);
  const x1 = minuteToInsetViewboxX(sunsetMin);
  const cx = minuteToInsetViewboxX(solarNoonMin);
  const targetX = minuteToInsetViewboxX(minute);

  const y = bezierYatX(x0, cx, x1, ARC_HORIZON_Y, ARC_APEX_Y, ARC_HORIZON_Y, targetX);
  if (y === null) return null;
  return viewboxToPct(targetX, y);
}

export function getNoonSunScenePct(sunTimes: SunTimes): { x: number; y: number } | null {
  return getSunScenePctAtMinute(sunTimes, sunTimes.solarNoonMin);
}

// Converts a fixed clock time (HH:MM in target tz) to a Date object suitable
// for getAtmosphere delta math. Basis is arbitrary — only deltas matter.
export function minuteToDate(minute: number): Date {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return new Date(2000, 0, 1, h, m, 0, 0);
}

export function getCurrentMinuteInTimezone(tz: string): number {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
  } catch {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
  }
  const p = fmt.formatToParts(new Date());
  const h = parseInt(p.find(x => x.type === 'hour')?.value ?? '0', 10) % 24;
  const m = parseInt(p.find(x => x.type === 'minute')?.value ?? '0', 10);
  return h * 60 + m;
}
