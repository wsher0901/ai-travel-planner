'use client';
import { useMemo, useState } from 'react';
import { type SkyStripProps } from './types';
import { getSunTimes, getSeasonalPalette } from '@/lib/sunPosition';
import { useTripStore } from '@/store/tripStore';
import SkyGradient from './layers/SkyGradient';
import CelestialBodies from './layers/CelestialBodies';
import Stars from './layers/Stars';
import Scenery from './layers/Scenery';
import {
  SceneAtmosphereProvider,
  type MockWeather,
} from './atmosphere/SceneAtmosphere';
import WeatherLayer from './atmosphere/WeatherLayer';
import WeatherDevCycler from './atmosphere/WeatherDevCycler';
import { minuteToDate } from './atmosphere/sunScenePos';

export default function SkyStrip({
  date, lat, lng,
  timezone = 'UTC',
  scenery = 'mountainscape',
  weatherSegments = [],
  palette: paletteProp,
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

  // Dev cycler override. null = "auto" (use real weather from useTripWeather).
  const [cyclerOverride, setCyclerOverride] = useState<MockWeather | null>(null);

  // Trip ID drives the weather hook's fetch keying.
  const tripId = useTripStore((s) => s.tripPlan?.id ?? null);

  // Dev-only URL override for time-of-day: ?atmoTime=sunrise|sunset|noon.
  // Lets us verify golden-hour visuals without changing the system clock.
  const simulatedMinute = useMemo(() => {
    if (process.env.NODE_ENV === 'production') return null;
    if (typeof window === 'undefined') return null;
    const sim = new URLSearchParams(window.location.search).get('atmoTime');
    if (sim === 'sunrise') return Math.round(sunTimes.sunriseMin);
    if (sim === 'sunset') return Math.round(sunTimes.sunsetMin);
    if (sim === 'noon') return Math.round(sunTimes.solarNoonMin);
    return null;
  }, [sunTimes]);

  // Atmosphere clock anchored to solar noon. Dev ?atmoTime= override bypasses
  // this so golden-hour visuals can be probed without touching the system clock.
  const refMinute = useMemo(() => (
    simulatedMinute !== null ? simulatedMinute : Math.round(sunTimes.solarNoonMin)
  ), [sunTimes, simulatedMinute]);

  const hourFloat = refMinute / 60;

  // Sunrise/sunset Dates (destination-local clock). Used as fallback when
  // the weather hook hasn't returned data yet for `date`.
  const fallbackSunrise = useMemo(
    () => minuteToDate(Math.round(sunTimes.sunriseMin)),
    [sunTimes]
  );
  const fallbackSunset = useMemo(
    () => minuteToDate(Math.round(sunTimes.sunsetMin)),
    [sunTimes]
  );

  return (
    <SceneAtmosphereProvider
      tripId={tripId}
      date={date}
      hourFloat={hourFloat}
      mockOverride={cyclerOverride}
      fallbackSunrise={fallbackSunrise}
      fallbackSunset={fallbackSunset}
    >
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

        {/* z0: celestial SVG — sun arc + moon. Sits BELOW Scenery in paint
            order (same zIndex:0, earlier in DOM) so mountain silhouettes
            can occlude the horizon sun naturally. */}
        <svg
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            zIndex: 0,
            pointerEvents: 'none',
          }}
          viewBox="0 0 1000 200"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <CelestialBodies
            sunTimes={sunTimes}
            lat={lat}
            lng={lng}
            timezone={timezone}
            date={date}
            aspectScale={aspectScale}
          />
        </svg>

        {/* Scenery silhouette — paints above celestial SVG (same z0, later in DOM) */}
        <Scenery preset={scenery} />

        {/* z1: stars SVG — above Scenery so stars are visible against the night sky */}
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
        </svg>

        {/* Layer 3: atmosphere — modulates the whole scene */}
        <WeatherLayer />

        {/* Dev-only weather cycler (gated to non-prod inside the component) */}
        <WeatherDevCycler weather={cyclerOverride} onChange={setCyclerOverride} />
      </div>
    </SceneAtmosphereProvider>
  );
}
