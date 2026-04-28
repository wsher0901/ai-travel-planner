'use client';
import { useMemo } from 'react';
import { type SunTimes, minToPercent } from '@/lib/sunPosition';
import { type SeasonalPalette } from '@/components/sky/types';

interface Props { sunTimes: SunTimes; palette: SeasonalPalette; }

function safeMin(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export default function SkyGradient({ sunTimes, palette }: Props) {
  const gradient = useMemo(() => {
    const {
      astronomicalDawnMin: rawAstroD,
      dawnMin: rawDawn,
      sunriseMin: rawRise,
      solarNoonMin: rawNoon,
      sunsetMin: rawSet,
      duskMin: rawDusk,
      astronomicalDuskMin: rawAstroK,
    } = sunTimes;

    const astronomicalDawnMin = safeMin(rawAstroD, 330);
    const dawnMin            = safeMin(rawDawn,  360);
    const sunriseMin         = safeMin(rawRise,  390);
    const solarNoonMin       = safeMin(rawNoon,  720);
    const sunsetMin          = safeMin(rawSet,  1110);
    const duskMin            = safeMin(rawDusk, 1140);
    const astronomicalDuskMin = safeMin(rawAstroK, 1170);

    const rawStops: Array<[number, string]> = [];
    const add = (pct: number, color: string) => {
      rawStops.push([Math.max(0, Math.min(100, pct)), color]);
    };

    add(0, palette.nightDeep);
    add(minToPercent(astronomicalDawnMin) - 2, palette.nightDeep);
    add(minToPercent(astronomicalDawnMin), '#0e1838');
    add(minToPercent(dawnMin) - 1, '#2a1f52');
    add(minToPercent(dawnMin), '#6a3a58');
    add(minToPercent(sunriseMin) - 0.5, palette.dawnAmber);
    add(minToPercent(sunriseMin), '#f5cfa0');
    add(minToPercent(sunriseMin) + 1.5, palette.dayPrimary);
    add(minToPercent(sunriseMin) + 3, palette.dayDeep);
    add(minToPercent(solarNoonMin), palette.dayPrimary);
    add(minToPercent(sunsetMin) - 3, palette.dayDeep);
    add(minToPercent(sunsetMin) - 1.5, palette.duskAmber);
    add(minToPercent(sunsetMin), palette.duskAmber);
    add(minToPercent(sunsetMin) + 0.5, '#c64a28');
    add(minToPercent(duskMin), '#7a2e48');
    add(minToPercent(duskMin) + 1, '#3a2048');
    add(minToPercent(astronomicalDuskMin), palette.nightDeep);
    add(100, palette.nightDeep);

    rawStops.sort((a, b) => a[0] - b[0]);
    const stops = rawStops.map(([pct, color]) => `${color} ${pct.toFixed(2)}%`);
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }, [sunTimes, palette]);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0,
      background: gradient,
      filter: 'saturate(1.05)',
    }} />
  );
}
