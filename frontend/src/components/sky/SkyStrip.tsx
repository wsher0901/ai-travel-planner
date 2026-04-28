'use client';
import { useMemo } from 'react';
import { type SkyStripProps } from './types';
import { getSunTimes, getSeasonalPalette } from '@/lib/sunPosition';
import SkyGradient from './layers/SkyGradient';
import CelestialBodies from './layers/CelestialBodies';
import Stars from './layers/Stars';
import Scenery from './layers/Scenery';
import WeatherLayers from './layers/WeatherLayers';

export default function SkyStrip({
  date, lat, lng,
  timezone = 'UTC',
  scenery = 'mountainscape',
  weatherSegments = [],
  palette: paletteProp,
  isToday = false,
  aspectScale = 1,
}: SkyStripProps) {
  const sunTimes = useMemo(
    () => getSunTimes(date, lat, lng, timezone),
    [date, lat, lng, timezone]
  );
  const palette = useMemo(
    () => paletteProp ?? getSeasonalPalette(date, lat),
    [paletteProp, date, lat]
  );

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      borderRadius: 12,
      overflow: 'hidden',
      isolation: 'isolate',
    }}>
      {/* z0: seasonal CSS gradient backdrop */}
      <SkyGradient sunTimes={sunTimes} />

      {/* z1: SVG overlay — stars, weather, and celestial arc.
          WeatherLayers renders before CelestialBodies so cloud cover sits
          visually in front of the sun arc (occlusion comes in 2c). */}
      <svg
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          zIndex: 1,
          pointerEvents: 'none',
        }}
        viewBox="0 0 1000 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <Stars
          palette={palette}
          sunTimes={sunTimes}
          latSeed={lat}
          dateSeed={date}
        />
        <WeatherLayers segments={weatherSegments} palette={palette} />
        <CelestialBodies
          sunTimes={sunTimes}
          lat={lat}
          lng={lng}
          timezone={timezone}
          date={date}
          isToday={isToday}
          aspectScale={aspectScale}
        />
      </svg>

      {/* Scenery silhouette always on top */}
      <Scenery preset={scenery} />
    </div>
  );
}
