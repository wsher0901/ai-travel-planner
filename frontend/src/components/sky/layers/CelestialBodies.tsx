'use client';
import { useMemo, useEffect, useRef, useId } from 'react';
import { motion } from 'framer-motion';
import {
  type SunTimes,
  type SeasonalPalette,
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
  palette: SeasonalPalette;
  aspectScale?: number;
}

const HALF_PI = Math.PI / 2;

// Catmull-Rom spline → cubic Bezier path string
function catmullRomPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function interpolatePos(
  samples: { hour: number; altitude: number }[],
  minute: number
): { x: number; y: number; altitude: number } {
  const hour = minute / 60;
  const idx = Math.min(Math.floor(hour), 22);
  const t = hour - idx;
  const s0 = samples[idx];
  const s1 = samples[idx + 1] ?? samples[idx];
  const altitude = s0.altitude + (s1.altitude - s0.altitude) * t;
  return {
    x: (hour / 24) * 1000,
    y: 100 - (altitude / HALF_PI) * 80,
    altitude,
  };
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

export default function CelestialBodies({
  sunTimes, lat, lng, timezone, date, isToday, palette, aspectScale,
}: Props) {
  // rx = r * as makes circles appear circular when preserveAspectRatio="none" stretches non-uniformly
  const as = aspectScale ?? 1;

  // Unique IDs per instance — prevents gradient collisions across two-slot animation
  const uid = useId().replace(/:/g, '-');
  const ids = {
    arcGlow:           `ag-${uid}`,
    arcGradient:       `agr-${uid}`,
    arcGradientBright: `agrb-${uid}`,
    sunCore:           `sc-${uid}`,
    sunMid:            `sm-${uid}`,
    sunOuter:          `so-${uid}`,
    sunCoreBright:     `scb-${uid}`,
    sunMidBright:      `smb-${uid}`,
    sunOuterBright:    `sob-${uid}`,
    moonBase:          `mb-${uid}`,
    moonGlow:          `mg-${uid}`,
    textShadow:        `ts-${uid}`,
  };

  const hourlyElevations = useMemo(
    () => getHourlySolarElevation(date, lat, lng, timezone),
    [date, lat, lng, timezone]
  );

  const { arcPath, noonPos } = useMemo(() => {
    const dayPts = hourlyElevations
      .filter(s => s.altitude > 0)
      .map(s => ({ x: (s.hour / 24) * 1000, y: 100 - (s.altitude / HALF_PI) * 80 }));

    const np = Number.isFinite(sunTimes.solarNoonMin)
      ? interpolatePos(hourlyElevations, sunTimes.solarNoonMin)
      : null;

    return { arcPath: catmullRomPath(dayPts), noonPos: np };
  }, [hourlyElevations, sunTimes.solarNoonMin]);

  // Moon
  const moonMinute = useMemo(
    () => getMoonRenderTime(date, lat, lng, timezone),
    [date, lat, lng, timezone]
  );
  const moonData = useMemo(
    () => moonMinute !== null ? getMoonPositionAtMinute(date, moonMinute, lat, lng, timezone) : null,
    [moonMinute, date, lat, lng, timezone]
  );
  const moonX = moonMinute !== null ? (moonMinute / 1440) * 1000 : null;
  // y derived from actual lunar altitude so the moon appears at the right elevation
  const moonY = moonData && moonData.altitude > 0
    ? Math.max(15, 100 - (moonData.altitude / HALF_PI) * 80)
    : null;

  // Phase shadow: waxing moves shadow left (showing right), waning moves right (showing left)
  const mr = 12;
  const moonPhase = moonData?.phase ?? 0.5;
  const shadowDx = moonPhase <= 0.5
    ? -4 * mr * moonPhase        // 0→−2r as phase goes 0→0.5
    : 4 * mr * (1 - moonPhase);  // 2r→0 as phase goes 0.5→1

  // Live "now" marker — ref mutation on 60s tick, no React re-renders
  const liveRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const el = liveRef.current;
    if (!el) return;

    if (!isToday) {
      el.style.display = 'none';
      return;
    }

    const update = (firstRun: boolean) => {
      const g = liveRef.current;
      if (!g) return;
      const minute = getCurrentMinuteInTimezone(timezone);
      const { x, y, altitude } = interpolatePos(hourlyElevations, minute);

      if (altitude < 0) {
        g.style.display = 'none';
        return;
      }

      g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);

      if (firstRun) {
        g.style.opacity = '0';
        g.style.display = '';
        g.style.transition = 'opacity 600ms ease-out';
        requestAnimationFrame(() => {
          if (liveRef.current) liveRef.current.style.opacity = '1';
        });
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
        <filter id={ids.arcGlow} x="-10%" y="-200%" width="120%" height="500%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id={ids.moonGlow} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
        <filter id={ids.textShadow} x="-20%" y="-50%" width="140%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="rgba(0,0,0,0.7)" />
        </filter>

        {/* Arc path gradients — layered luminous arc effect */}
        <linearGradient id={ids.arcGradient} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%"   stopColor="rgba(255,180,110,0)" />
          <stop offset="15%"  stopColor="rgba(255,200,140,0.45)" />
          <stop offset="50%"  stopColor="rgba(255,235,200,0.7)" />
          <stop offset="85%"  stopColor="rgba(255,200,140,0.45)" />
          <stop offset="100%" stopColor="rgba(255,180,110,0)" />
        </linearGradient>
        <linearGradient id={ids.arcGradientBright} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%"   stopColor="rgba(255,220,170,0)" />
          <stop offset="50%"  stopColor="rgba(255,248,220,0.9)" />
          <stop offset="100%" stopColor="rgba(255,220,170,0)" />
        </linearGradient>

        {/* Sun noon gradients */}
        <radialGradient id={ids.sunCore} cx="50%" cy="50%" r="50%" fx="35%" fy="30%">
          <stop offset="0%" stopColor="#FFF8E0" />
          <stop offset="100%" stopColor="#FFD56B" />
        </radialGradient>
        <radialGradient id={ids.sunMid} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,213,107,0.4)" />
          <stop offset="100%" stopColor="rgba(255,213,107,0)" />
        </radialGradient>
        <radialGradient id={ids.sunOuter} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,213,107,0.2)" />
          <stop offset="100%" stopColor="rgba(255,213,107,0)" />
        </radialGradient>

        {/* Live "now" marker gradients — slightly brighter */}
        <radialGradient id={ids.sunCoreBright} cx="50%" cy="50%" r="50%" fx="35%" fy="30%">
          <stop offset="0%" stopColor="#FFFDE0" />
          <stop offset="100%" stopColor="#FFE08A" />
        </radialGradient>
        <radialGradient id={ids.sunMidBright} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,230,140,0.5)" />
          <stop offset="100%" stopColor="rgba(255,230,140,0)" />
        </radialGradient>
        <radialGradient id={ids.sunOuterBright} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,230,140,0.28)" />
          <stop offset="100%" stopColor="rgba(255,230,140,0)" />
        </radialGradient>

        {/* Moon */}
        <radialGradient id={ids.moonBase} cx="50%" cy="50%" r="50%" fx="38%" fy="32%">
          <stop offset="0%" stopColor="#F4F0E8" />
          <stop offset="100%" stopColor="#C4BCA8" />
        </radialGradient>
      </defs>

      {/* Layer 1 — outer halo (blurred, widest) */}
      {arcPath && (
        <path
          d={arcPath}
          stroke="rgba(255,200,130,0.06)"
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
          filter={`url(#${ids.arcGlow})`}
        />
      )}

      {/* Layer 2 — soft glow */}
      {arcPath && (
        <path
          d={arcPath}
          stroke={`url(#${ids.arcGradient})`}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Layer 3 — bright thin trace */}
      {arcPath && (
        <path
          d={arcPath}
          stroke={`url(#${ids.arcGradientBright})`}
          strokeWidth={0.8}
          strokeDasharray="2 3"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Solar noon marker */}
      {noonPos && noonPos.altitude > 0 && (
        <g transform={`translate(${noonPos.x.toFixed(1)} ${noonPos.y.toFixed(1)})`}>
          {/* Pulsing outer glow — CSS transform (compositor-eligible) */}
          <g className="sun-ambi-pulse">
            <ellipse rx={28 * as} ry={28} fill={`url(#${ids.sunOuter})`} />
          </g>
          <ellipse rx={20 * as} ry={20} fill={`url(#${ids.sunMid})`} />
          <ellipse rx={14 * as} ry={14} fill={`url(#${ids.sunCore})`} />
        </g>
      )}

      {/* Live "now" marker — position updated via ref, no React re-renders */}
      <g ref={liveRef} style={{ display: 'none', willChange: 'transform' }}>
        <ellipse rx={36 * as} ry={36} fill={`url(#${ids.sunOuterBright})`} />
        <ellipse rx={26 * as} ry={26} fill={`url(#${ids.sunMidBright})`} />
        <ellipse rx={18 * as} ry={18} fill={`url(#${ids.sunCoreBright})`} />
        {/* Rotating orbital ring — CSS animation via class */}
        <g className="sky-orbit-ring">
          <ellipse rx={24 * as} ry={24} fill="none" stroke="rgba(255,220,130,0.3)" strokeWidth={1.0} strokeDasharray="3 4" />
        </g>
      </g>

      {/* Moon — only when above horizon */}
      {moonX !== null && moonData && moonY !== null && (
        <g transform={`translate(${moonX.toFixed(1)} ${moonY.toFixed(1)})`}>
          {/* Soft outer glow */}
          <ellipse rx={mr * as} ry={mr} fill={`url(#${ids.moonBase})`} filter={`url(#${ids.moonGlow})`} opacity={0.45} />
          {/* Moon disc */}
          <ellipse rx={mr * as} ry={mr} fill={`url(#${ids.moonBase})`} />
          {/* Phase shadow: an ellipse offset to reveal only the lit crescent */}
          {moonPhase !== 0.5 && (
            <ellipse
              rx={mr * as}
              ry={mr}
              cx={shadowDx}
              cy={0}
              fill={palette.nightDeep}
              opacity={moonPhase === 0 || moonPhase === 1 ? 0.95 : 0.9}
            />
          )}
          {/* Subtle craters */}
          <ellipse cx={-3.2} cy={-2.8} rx={0.7 * as}  ry={0.7}  fill="rgba(150,140,120,0.18)" />
          <ellipse cx={3.1}  cy={2.2}  rx={0.45 * as} ry={0.45} fill="rgba(150,140,120,0.15)" />
          <ellipse cx={-1.8} cy={4.2}  rx={0.55 * as} ry={0.55} fill="rgba(150,140,120,0.16)" />
          <ellipse cx={4.2}  cy={-3.8} rx={0.35 * as} ry={0.35} fill="rgba(150,140,120,0.12)" />
          <ellipse cx={-5.1} cy={1.9}  rx={0.4 * as}  ry={0.4}  fill="rgba(150,140,120,0.13)" />
        </g>
      )}
    </>
  );
}
