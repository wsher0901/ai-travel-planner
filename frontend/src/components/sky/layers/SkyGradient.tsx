'use client';
import { useMemo } from 'react';
import { type SunTimes } from '@/lib/sunPosition';
import { minuteToTimelinePercent } from '@/lib/timelineInset';

interface Props { sunTimes: SunTimes; }

function safeMin(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function c(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export default function SkyGradient({ sunTimes }: Props) {
  const gradient = useMemo(() => {
    const nightEndPct = c(minuteToTimelinePercent(safeMin(sunTimes.astronomicalDawnMin, 330)));
    const dawnPct     = c(minuteToTimelinePercent(safeMin(sunTimes.dawnMin,             360)));
    const sunrisePct  = c(minuteToTimelinePercent(safeMin(sunTimes.sunriseMin,          390)));
    const noonPct     = c(minuteToTimelinePercent(safeMin(sunTimes.solarNoonMin,        720)));
    const sunsetPct   = c(minuteToTimelinePercent(safeMin(sunTimes.sunsetMin,          1050)));
    const duskPct     = c(minuteToTimelinePercent(safeMin(sunTimes.duskMin,            1080)));
    const nightPct    = c(minuteToTimelinePercent(safeMin(sunTimes.astronomicalDuskMin, 1110)));

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
