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
      [0,                       '#04071A'],
      [c(nightEndPct - 3),      '#04071A'],
      [nightEndPct,             '#0E1838'],
      [c(dawnPct - 2),          '#2A1F52'],
      [dawnPct,                 '#6A3A58'],
      [c(sunrisePct - 1),       '#C4623E'],
      [sunrisePct,              '#ECAA6A'],
      [c(sunrisePct + 1),       '#F5CFA0'],
      [c(sunrisePct + 3),       '#C8DCEC'],
      [c(sunrisePct + 6),       '#8EC2E8'],
      [noonPct,                 '#72B6E8'],
      [c(sunsetPct - 6),        '#8EC2E8'],
      [c(sunsetPct - 3),        '#C4B488'],
      [c(sunsetPct - 1),        '#E0A470'],
      [sunsetPct,               '#E8833E'],
      [c(sunsetPct + 1),        '#C64A28'],
      [duskPct,                 '#7A2E48'],
      [c(duskPct + 2),          '#3A2048'],
      [nightPct,                '#161838'],
      [100,                     '#06081C'],
    ];

    stops.sort((a, b) => a[0] - b[0]);
    return `linear-gradient(90deg, ${stops.map(([pct, col]) => `${col} ${pct.toFixed(2)}%`).join(', ')})`;
  }, [sunTimes]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: gradient }} />
  );
}
