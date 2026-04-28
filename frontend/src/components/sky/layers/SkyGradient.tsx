'use client';
import { useMemo } from 'react';
import { type SunTimes } from '@/lib/sunPosition';

interface Props { sunTimes: SunTimes; }

function safeMin(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function c(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export default function SkyGradient({ sunTimes }: Props) {
  const gradient = useMemo(() => {
    const nightEndPct = c(safeMin(sunTimes.astronomicalDawnMin, 330) / 1440 * 100);
    const dawnPct     = c(safeMin(sunTimes.dawnMin,             360) / 1440 * 100);
    const sunrisePct  = c(safeMin(sunTimes.sunriseMin,          390) / 1440 * 100);
    const noonPct     = c(safeMin(sunTimes.solarNoonMin,        720) / 1440 * 100);
    const sunsetPct   = c(safeMin(sunTimes.sunsetMin,          1050) / 1440 * 100);
    const duskPct     = c(safeMin(sunTimes.duskMin,            1080) / 1440 * 100);
    const nightPct    = c(safeMin(sunTimes.astronomicalDuskMin, 1110) / 1440 * 100);

    const stops: Array<[number, string]> = [
      [0,                       '#0b1220'],
      [c(nightEndPct - 3),      '#0b1220'],
      [nightEndPct,             '#10192e'],
      [c(dawnPct - 4),          '#1e304a'],
      [c(dawnPct - 2),          '#8c3810'],
      [dawnPct,                 '#c4561c'],
      [c(sunrisePct - 1),       '#d96830'],
      [sunrisePct,              '#e8a060'],
      [c(sunrisePct + 2),       '#a8c8e0'],
      [c(sunrisePct + 5),       '#5a90c4'],
      [noonPct,                 '#3d7aae'],
      [c(sunsetPct - 5),        '#4282b8'],
      [c(sunsetPct - 2),        '#a8c8e0'],
      [sunsetPct,               '#e8a060'],
      [c(sunsetPct + 1),        '#d96830'],
      [duskPct,                 '#c4561c'],
      [c(duskPct + 2),          '#8c3810'],
      [nightPct,                '#10192e'],
      [100,                     '#0b1220'],
    ];

    stops.sort((a, b) => a[0] - b[0]);
    return `linear-gradient(90deg, ${stops.map(([pct, col]) => `${col} ${pct.toFixed(2)}%`).join(', ')})`;
  }, [sunTimes]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: gradient }} />
  );
}
