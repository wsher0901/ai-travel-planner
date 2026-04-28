'use client';
import { useMemo } from 'react';
import { type SunTimes } from '@/lib/sunPosition';
import { type SeasonalPalette } from '@/components/sky/types';

interface Props {
  palette: SeasonalPalette;
  sunTimes: SunTimes;
  latSeed: number;
  dateSeed: string;
}

interface Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
  animDelay: number;
  isFeatured: boolean;
}

// Mulberry32 PRNG — deterministic, no deps
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function computeStars(
  palette: SeasonalPalette,
  sunTimes: SunTimes,
  latSeed: number,
  dateSeed: string
): Star[] {
  const { dawnMin, duskMin } = sunTimes;

  const nightZones: [number, number][] = [];
  const safeD = Number.isFinite(dawnMin) ? dawnMin : 360;
  const safeK = Number.isFinite(duskMin) ? duskMin : 1080;

  if (safeD > 0) nightZones.push([0, safeD]);
  if (safeK < 1440) nightZones.push([safeK, 1440]);

  if (nightZones.length === 0) return [];

  // Seasonal density from palette nightDeep darkness heuristic
  const month = parseInt(dateSeed.split('-')[1], 10);
  const isWinterPalette = palette.nightDeep === '#050A1F';
  const isSummerPalette = palette.nightDeep === '#0A1228';
  const seasonMod = isWinterPalette ? 1.5 : isSummerPalette ? 0.7 : 1.0;
  const latMod = Math.abs(latSeed) > 50 ? 1.3 : 1.0;
  void month; // used implicitly via palette season

  const count = Math.round(30 * seasonMod * latMod);
  const featuredCount = Math.min(3, Math.floor(count * 0.1));

  const seed = (Math.floor(latSeed * 100) + parseInt(dateSeed.replace(/-/g, '').slice(-6), 10)) | 0;
  const rand = mulberry32(seed);

  const stars: Star[] = [];

  // Weight zone selection by proportional duration
  const totalNight = nightZones.reduce((s, z) => s + (z[1] - z[0]), 0);
  const zone0Weight = nightZones.length > 1 ? (nightZones[0][1] - nightZones[0][0]) / totalNight : 1;

  for (let i = 0; i < count; i++) {
    const zone = nightZones[rand() < zone0Weight ? 0 : 1];
    const xMin = (zone[0] / 1440) * 1000;
    const xMax = (zone[1] / 1440) * 1000;
    const x = xMin + rand() * (xMax - xMin);
    const y = 8 + rand() * 72; // upper 80 units of 200-unit viewBox (sky area)
    const r = 0.4 + rand() * 0.8;
    const opacity = 0.3 + rand() * 0.7;
    const animDelay = rand() * 4;
    const isFeatured = i < featuredCount;

    stars.push({ x, y, r, opacity, animDelay, isFeatured });
  }

  return stars;
}

export default function Stars({ palette, sunTimes, latSeed, dateSeed }: Props) {
  const stars = useMemo(
    () => computeStars(palette, sunTimes, latSeed, dateSeed),
    [palette, sunTimes, latSeed, dateSeed]
  );

  return (
    <g aria-hidden="true">
      {stars.map((s, i) => (
        <g key={i}>
          <circle
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill={palette.starColor}
            style={{
              '--star-opacity': s.opacity,
              animation: `skyStarTwinkle 4s ease-in-out infinite`,
              animationDelay: `${s.animDelay}s`,
            } as React.CSSProperties}
          />
          {s.isFeatured && (
            <path
              d={`M${s.x},${s.y - s.r * 2.5} L${s.x},${s.y + s.r * 2.5} M${s.x - s.r * 2.5},${s.y} L${s.x + s.r * 2.5},${s.y}`}
              stroke={palette.starColor}
              strokeWidth={0.4}
              opacity={s.opacity * 0.5}
            />
          )}
        </g>
      ))}
    </g>
  );
}
