'use client';
import { useMemo, useEffect, useRef, useId } from 'react';
import {
  type SunTimes,
  getHourlySolarElevation,
  getMoonPositionAtMinute,
  getMoonRenderTime,
} from '@/lib/sunPosition';

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
const ARC_HORIZON_Y = 215;
const ARC_APEX_Y    = 5;

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
  const as  = aspectScale ?? 1;
  const uid = useId().replace(/:/g, '-');
  const sunCoreId = `sc-${uid}`;

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

    const x0   = (riseMin / 1440) * 1000;
    const x1   = (setMin  / 1440) * 1000;
    const cx   = (nMin    / 1440) * 1000;
    const path = `M ${x0.toFixed(1)} ${ARC_HORIZON_Y} Q ${cx.toFixed(1)} ${ARC_APEX_Y} ${x1.toFixed(1)} ${ARC_HORIZON_Y}`;

    // Noon y from the Bezier so the sun disc sits on the arc
    const nyResult = bezierYatX(x0, cx, x1, ARC_HORIZON_Y, ARC_APEX_Y, ARC_HORIZON_Y, cx);
    if (nyResult === null) return { arcPath: path, noonX: null, noonY: null, noonAltitude: -1 };
    const nalt = interpolatePos(hourlyElevations, nMin).altitude;

    return { arcPath: path, noonX: cx, noonY: nyResult, noonAltitude: nalt };
  }, [sunTimes, hourlyElevations]);

  // Moon
  const moonMinute = useMemo(
    () => getMoonRenderTime(date, lat, lng, timezone),
    [date, lat, lng, timezone],
  );
  const moonData = useMemo(
    () => moonMinute !== null ? getMoonPositionAtMinute(date, moonMinute, lat, lng, timezone) : null,
    [moonMinute, date, lat, lng, timezone],
  );
  const moonX = moonMinute !== null ? (moonMinute / 1440) * 1000 : null;
  const moonY = moonData && moonData.altitude > 0
    ? Math.max(15, 100 - (moonData.altitude / HALF_PI) * 80)
    : null;

  // Crescent phase — two-circle occlusion method
  const moonPhase    = moonData?.phase ?? 0;
  const phaseAngle   = moonPhase * 2 * Math.PI;
  const shadowDx     = Math.cos(phaseAngle) * 7;
  const shadowR      = 7;

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
      const { x, y, altitude } = interpolatePos(hourlyElevations, minute);
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

  return (
    <>
      <defs>
        {/* Sun: warm core fading to transparent edge */}
        <radialGradient id={sunCoreId} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#FFF8E0" />
          <stop offset="60%"  stopColor="#FFD56B" />
          <stop offset="100%" stopColor="#FFD56B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sun arc — single dotted quadratic Bezier from sunrise to sunset */}
      {arcPath && (
        <path
          d={arcPath}
          fill="none"
          stroke="rgba(255, 220, 180, 0.35)"
          strokeWidth={1.5}
          strokeDasharray="3 4"
          strokeLinecap="round"
        />
      )}

      {/* Solar noon marker */}
      {noonX !== null && noonY !== null && noonAltitude > 0 && (
        <g transform={`translate(${noonX.toFixed(1)} ${noonY.toFixed(1)})`}>
          <ellipse rx={20 * as} ry={20} fill="rgba(255, 213, 107, 0.22)" />
          <ellipse rx={11 * as} ry={11} fill={`url(#${sunCoreId})`} />
        </g>
      )}

      {/* Live "now" marker — position updated imperatively */}
      <g ref={liveRef} style={{ display: 'none', willChange: 'transform' }}>
        <ellipse rx={24 * as} ry={24} fill="rgba(255, 213, 107, 0.28)" />
        <ellipse rx={13 * as} ry={13} fill={`url(#${sunCoreId})`} />
      </g>

      {/* Moon — two-circle crescent */}
      {moonX !== null && moonY !== null && (
        <g transform={`translate(${moonX.toFixed(1)} ${moonY.toFixed(1)})`}>
          <ellipse rx={7 * as} ry={7} fill="#F4F0E8" />
          <ellipse cx={shadowDx} rx={shadowR * as} ry={shadowR} fill="#1A2444" />
        </g>
      )}
    </>
  );
}
