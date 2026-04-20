'use client';
import { useMemo } from 'react';
import { type SkyStripProps } from './types';
import { getSunTimes } from '@/lib/sunPosition';
import SkyGradient from './layers/SkyGradient';
import CelestialBodies from './layers/CelestialBodies';
import Stars from './layers/Stars';
import Scenery from './layers/Scenery';
import WeatherLayers from './layers/WeatherLayers';

export default function SkyStrip({ date, lat, lng, timezone, scenery = 'mountainscape', weatherSegments = [] }: SkyStripProps) {
  const sunTimes = useMemo(() => getSunTimes(date, lat, lng, timezone ?? 'UTC'), [date, lat, lng, timezone]);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      borderRadius: 12,
      overflow: 'hidden',
      isolation: 'isolate',
    }}>
      <SkyGradient sunTimes={sunTimes} />
      <Stars />
      <CelestialBodies sunTimes={sunTimes} />
      <WeatherLayers segments={weatherSegments} />
      <Scenery preset={scenery} />
    </div>
  );
}
