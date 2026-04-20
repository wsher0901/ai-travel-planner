'use client';
import { type SunTimes, minToPercent } from '@/lib/sunPosition';

interface Props { sunTimes: SunTimes; }

export default function SkyGradient({ sunTimes }: Props) {
  const { astronomicalDawnMin, dawnMin, sunriseMin, solarNoonMin, sunsetMin, duskMin, astronomicalDuskMin } = sunTimes;
  const stops: string[] = [];
  const add = (pct: number, color: string) => stops.push(`${color} ${Math.max(0, Math.min(100, pct)).toFixed(2)}%`);

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

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0,
      background: `linear-gradient(90deg, ${stops.join(', ')})`,
      filter: 'saturate(1.05)',
    }} />
  );
}
