'use client';
import { useMemo, useEffect, useRef, useId } from 'react';
import { TIMELINE_INSET_PCT } from '@/lib/timelineInset';
import {
  type SunTimes,
  getHourlySolarElevation,
  getMoonPositionAtMinute,
  getMoonPeakMinute,
} from '@/lib/sunPosition';
import { useSceneWeather } from '../atmosphere/SceneAtmosphere';
import { smoothMask } from '../atmosphere/maskUtils';

interface Props {
  sunTimes: SunTimes;
  lat: number;
  lng: number;
  timezone: string;
  date: string;
  isToday: boolean;
  aspectScale?: number;
}

const HALF_PI = Math.PI / 2;

// Tiers where the sun disc should be visible. Smoothed via smoothMask so the
// sun fades at tier transition boundaries rather than cutting abruptly.
const SUN_VISIBLE_TIERS = new Set(['sunny', 'partly-cloudy', 'light-snow']);
const ARC_HORIZON_Y = 215;
const ARC_APEX_Y    = -90;

function minuteToInsetViewboxX(minute: number): number {
  return (TIMELINE_INSET_PCT / 100 + (minute / 1440) * (1 - 2 * TIMELINE_INSET_PCT / 100)) * 1000;
}

function interpolatePos(
  samples: { hour: number; altitude: number }[],
  minute: number
): { x: number; y: number; altitude: number } {
  const hour = minute / 60;
  const idx  = Math.min(Math.floor(hour), 22);
  const t    = hour - idx;
  const s0   = samples[idx];
  const s1   = samples[idx + 1] ?? samples[idx];
  const altitude = s0.altitude + (s1.altitude - s0.altitude) * t;
  return { x: (hour / 24) * 1000, y: 100 - (altitude / HALF_PI) * 80, altitude };
}

function getCurrentMinuteInTimezone(tz: string): number {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false });
  } catch {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', hour: 'numeric', minute: 'numeric', hour12: false });
  }
  const p = fmt.formatToParts(new Date());
  const h = parseInt(p.find(x => x.type === 'hour')?.value ?? '0', 10) % 24;
  const m = parseInt(p.find(x => x.type === 'minute')?.value ?? '0', 10);
  return h * 60 + m;
}

// Returns the y coordinate on a quadratic Bezier at the point closest to targetX.
// Used to place the noon sun on the arc rather than at the solar-elevation y.
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

export default function CelestialBodies({
  sunTimes, lat, lng, timezone, date, isToday, aspectScale,
}: Props) {
  const as = aspectScale ?? 1;
  const moonMaskId = useId();

  const { samples48 } = useSceneWeather();

  const hourlyElevations = useMemo(
    () => getHourlySolarElevation(date, lat, lng, timezone),
    [date, lat, lng, timezone],
  );

  const { arcPath, noonX, noonY, noonAltitude } = useMemo(() => {
    const riseMin = sunTimes.sunriseMin;
    const setMin  = sunTimes.sunsetMin;
    const nMin    = sunTimes.solarNoonMin;

    if (!Number.isFinite(riseMin) || !Number.isFinite(setMin) || !Number.isFinite(nMin)) {
      return { arcPath: null, noonX: null, noonY: null, noonAltitude: -1 };
    }

    const x0   = minuteToInsetViewboxX(riseMin);
    const x1   = minuteToInsetViewboxX(setMin);
    const cx   = minuteToInsetViewboxX(nMin);
    const path = `M ${x0.toFixed(1)} ${ARC_HORIZON_Y} Q ${cx.toFixed(1)} ${ARC_APEX_Y} ${x1.toFixed(1)} ${ARC_HORIZON_Y}`;

    // Noon y from the Bezier so the sun disc sits on the arc
    const nyResult = bezierYatX(x0, cx, x1, ARC_HORIZON_Y, ARC_APEX_Y, ARC_HORIZON_Y, cx);
    if (nyResult === null) return { arcPath: path, noonX: null, noonY: null, noonAltitude: -1 };
    const nalt = interpolatePos(hourlyElevations, nMin).altitude;

    return { arcPath: path, noonX: cx, noonY: nyResult, noonAltitude: nalt };
  }, [sunTimes, hourlyElevations]);

  // Moon
  const moonMinute = useMemo(
    () => getMoonPeakMinute(date, lat, lng, timezone),
    [date, lat, lng, timezone],
  );
  const moonData = useMemo(
    () => moonMinute !== null ? getMoonPositionAtMinute(date, moonMinute, lat, lng, timezone) : null,
    [moonMinute, date, lat, lng, timezone],
  );
  // Crescent phase — two-circle occlusion method
  const moonPhase  = moonData?.phase ?? 0;
  const isNewMoon  = moonPhase < 0.03 || moonPhase > 0.97;
  const phaseAngle = moonPhase * 2 * Math.PI;
  const shadowDx   = Math.cos(phaseAngle) * 7;
  const shadowR    = 7;

  const moonX = moonMinute !== null ? minuteToInsetViewboxX(moonMinute) : null;
  const moonY = (!isNewMoon && moonData !== null && moonData.altitude > 0)
    ? Math.max(20, 100 - (moonData.altitude / HALF_PI) * 80)
    : null;

  // Tier-conditional sun opacity. Sunny/partly-cloudy/light-snow show the sun;
  // overcast, rain, heavy snow hide it. smoothMask produces a ramp at boundaries.
  const sunOpacity = useMemo(() => {
    if (!samples48.length) return 1;
    const raw = new Float32Array(samples48.length);
    for (let i = 0; i < samples48.length; i++) {
      raw[i] = SUN_VISIBLE_TIERS.has(samples48[i].conditionTier) ? 1 : 0;
    }
    const smoothed = smoothMask(raw);
    const sunMinute = isToday
      ? getCurrentMinuteInTimezone(timezone)
      : sunTimes.solarNoonMin;
    const idx = Math.max(0, Math.min(samples48.length - 1, Math.round(sunMinute / 30)));
    return smoothed[idx] ?? 1;
  }, [samples48, isToday, timezone, sunTimes.solarNoonMin]);

  // Fade moon toward 0.3 opacity during daytime so it reads as "background" sky phenomenon
  const moonOpacity = useMemo(() => {
    if (moonMinute === null || moonData === null || moonData.altitude <= 0 || isNewMoon) return 1;
    const sunAlt = interpolatePos(hourlyElevations, moonMinute).altitude;
    return sunAlt < 0 ? 1.0 : Math.max(0.3, 1.0 - (sunAlt / HALF_PI) * 0.7);
  }, [moonMinute, moonData, hourlyElevations, isNewMoon]);

  // Live "now" marker — ref-mutated on 60 s tick to avoid React re-renders
  const liveRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const el = liveRef.current;
    if (!el) return;
    if (!isToday) { el.style.display = 'none'; return; }

    const update = (firstRun: boolean) => {
      const g = liveRef.current;
      if (!g) return;
      const minute  = getCurrentMinuteInTimezone(timezone);
      const { y, altitude } = interpolatePos(hourlyElevations, minute);
      const x = minuteToInsetViewboxX(minute);
      if (altitude < 0) { g.style.display = 'none'; return; }
      g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      if (firstRun) {
        g.style.opacity    = '0';
        g.style.display    = '';
        g.style.transition = 'opacity 600ms ease-out';
        requestAnimationFrame(() => { if (liveRef.current) liveRef.current.style.opacity = '1'; });
      } else {
        g.style.display = '';
      }
    };

    update(true);
    const id = setInterval(() => update(false), 60000);
    return () => clearInterval(id);
  }, [isToday, hourlyElevations, timezone]);

  // Live moon marker (today only) — ref-mutated on 60 s tick
  const moonLiveRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const el = moonLiveRef.current;
    if (!el) return;
    if (!isToday || isNewMoon) { el.style.display = 'none'; return; }

    const update = (firstRun: boolean) => {
      const g = moonLiveRef.current;
      if (!g) return;
      const minute  = getCurrentMinuteInTimezone(timezone);
      const pos     = getMoonPositionAtMinute(date, minute, lat, lng, timezone);
      if (pos.altitude <= 0) { g.style.display = 'none'; return; }
      const x = minuteToInsetViewboxX(minute);
      const y = Math.max(20, 100 - (pos.altitude / HALF_PI) * 80);
      const sunAlt = interpolatePos(hourlyElevations, minute).altitude;
      const targetOpacity = sunAlt < 0 ? '1' : String(Math.max(0.3, 1 - (sunAlt / HALF_PI) * 0.7).toFixed(2));
      g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      if (firstRun) {
        g.style.opacity    = '0';
        g.style.display    = '';
        g.style.transition = 'opacity 600ms ease-out';
        requestAnimationFrame(() => { if (moonLiveRef.current) moonLiveRef.current.style.opacity = targetOpacity; });
      } else {
        g.style.opacity = targetOpacity;
        g.style.display = '';
      }
    };

    update(true);
    const id = setInterval(() => update(false), 60000);
    return () => clearInterval(id);
  }, [isToday, isNewMoon, date, lat, lng, timezone, hourlyElevations]);

  return (
    <>
      <defs>
        <mask id={moonMaskId}>
          <ellipse rx={7 * as} ry={7} fill="white" />
          <ellipse cx={shadowDx} rx={shadowR * as} ry={shadowR} fill="black" />
        </mask>
      </defs>

      {/* Sun arc — dotted quadratic Bezier from sunrise to sunset */}
      {arcPath && (
        <path
          d={arcPath}
          fill="none"
          stroke="rgba(180, 210, 240, 0.45)"
          strokeWidth={1.5}
          strokeDasharray="3 4"
          strokeLinecap="round"
        />
      )}

      {/* Solar noon marker — hidden on isToday (live marker takes over, matching moon pattern) */}
      {!isToday && noonX !== null && noonY !== null && noonAltitude > 0 && (
        <g transform={`translate(${noonX.toFixed(1)} ${noonY.toFixed(1)})`} style={{ opacity: sunOpacity }}>
          <ellipse rx={28 * as} ry={28} fill="rgba(180, 210, 200, 0.12)" />
          <ellipse rx={16 * as} ry={16} fill="rgba(220, 200, 100, 0.32)" />
          <ellipse rx={9 * as}  ry={9}  fill="#F2CA40" />
        </g>
      )}

      {/* Live "now" marker — position updated imperatively; outer g applies tier opacity */}
      <g style={{ opacity: sunOpacity }}>
        <g ref={liveRef} style={{ display: 'none', willChange: 'transform' }}>
          <ellipse rx={28 * as} ry={28} fill="rgba(180, 210, 200, 0.12)" />
          <ellipse rx={16 * as} ry={16} fill="rgba(220, 200, 100, 0.32)" />
          <ellipse rx={9 * as}  ry={9}  fill="#F2CA40" />
        </g>
      </g>

      {/* Moon — static at peak-altitude hour (hidden on today; live marker takes over) */}
      {!isToday && moonX !== null && moonY !== null && (
        <g transform={`translate(${moonX.toFixed(1)} ${moonY.toFixed(1)})`} opacity={moonOpacity}>
          <ellipse rx={7 * as} ry={7} fill="#6888a8" mask={`url(#${moonMaskId})`} />
        </g>
      )}

      {/* Live moon — position updated imperatively on today */}
      <g ref={moonLiveRef} style={{ display: 'none', willChange: 'transform' }}>
        <ellipse rx={7 * as} ry={7} fill="#6888a8" mask={`url(#${moonMaskId})`} />
      </g>
    </>
  );
}
