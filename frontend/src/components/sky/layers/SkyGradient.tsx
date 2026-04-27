'use client';
import { type SunTimes, minToPercent } from '@/lib/sunPosition';

interface Props { sunTimes: SunTimes; }

/** NaN guard: replace NaN/Infinity with fallback minutes */
function safeMin(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export default function SkyGradient({ sunTimes }: Props) {
  const {
    astronomicalDawnMin: rawAstroD,
    dawnMin: rawDawn,
    sunriseMin: rawRise,
    solarNoonMin: rawNoon,
    sunsetMin: rawSet,
    duskMin: rawDusk,
    astronomicalDuskMin: rawAstroK,
  } = sunTimes;

  // Apply NaN guards with sensible defaults (typical mid-latitude day)
  const astronomicalDawnMin = safeMin(rawAstroD, 330);  // ~5:30 AM
  const dawnMin            = safeMin(rawDawn,  360);    // ~6:00 AM
  const sunriseMin         = safeMin(rawRise,  390);    // ~6:30 AM
  const solarNoonMin       = safeMin(rawNoon,  720);    // 12:00 PM
  const sunsetMin          = safeMin(rawSet,  1110);    // ~6:30 PM
  const duskMin            = safeMin(rawDusk, 1140);    // ~7:00 PM
  const astronomicalDuskMin = safeMin(rawAstroK, 1170); // ~7:30 PM

  const rawStops: Array<[number, string]> = [];
  const add = (pct: number, color: string) => {
    const clamped = Math.max(0, Math.min(100, pct));
    rawStops.push([clamped, color]);
  };

  add(0, '#040714');
  add(minToPercent(astronomicalDawnMin) - 2, '#080f28');
  add(minToPercent(astronomicalDawnMin), '#0e1838');
  add(minToPercent(dawnMin) - 1, '#2a1f52');
  add(minToPercent(dawnMin), '#6a3a58');
  add(minToPercent(sunriseMin) - 0.5, '#c4623e');
  add(minToPercent(sunriseMin), '#ecaa6a');
  add(minToPercent(sunriseMin) + 0.8, '#f5cfa0');
  add(minToPercent(sunriseMin) + 1.5, '#c8dcec');
  add(minToPercent(sunriseMin) + 3, '#8ec2e8');
  add(minToPercent(solarNoonMin), '#72b6e8');
  add(minToPercent(sunsetMin) - 3, '#8ec2e8');
  add(minToPercent(sunsetMin) - 1.5, '#c4b488');
  add(minToPercent(sunsetMin) - 0.8, '#e0a470');
  add(minToPercent(sunsetMin), '#e8833e');
  add(minToPercent(sunsetMin) + 0.5, '#c64a28');
  add(minToPercent(duskMin), '#7a2e48');
  add(minToPercent(duskMin) + 1, '#3a2048');
  add(minToPercent(astronomicalDuskMin), '#161838');
  add(100, '#060a1c');

  // Sort stops by percentage to guarantee valid CSS linear-gradient output
  rawStops.sort((a, b) => a[0] - b[0]);
  const stops = rawStops.map(([pct, color]) => `${color} ${pct.toFixed(2)}%`);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0,
      background: `linear-gradient(90deg, ${stops.join(', ')})`,
      filter: 'saturate(1.05)',
    }} />
  );
}
