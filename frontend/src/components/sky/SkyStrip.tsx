'use client';
import { useEffect, useMemo, useState } from 'react';
import { type SkyStripProps } from './types';
import { getSunTimes, getSeasonalPalette } from '@/lib/sunPosition';
import { useTripStore } from '@/store/tripStore';
import SkyGradient from './layers/SkyGradient';
import CelestialBodies from './layers/CelestialBodies';
import Stars from './layers/Stars';
import Scenery from './layers/Scenery';
import WeatherLayers from './layers/WeatherLayers';
import {
  SceneAtmosphereProvider,
  type MockWeather,
} from './atmosphere/SceneAtmosphere';
import WeatherLayer from './atmosphere/WeatherLayer';
import WeatherDevCycler from './atmosphere/WeatherDevCycler';
import {
  getCurrentMinuteInTimezone,
  getNoonSunScenePct,
  getSunScenePctAtMinute,
  minuteToDate,
} from './atmosphere/sunScenePos';

export default function SkyStrip({
  date, lat, lng,
  timezone = 'UTC',
  scenery = 'mountainscape',
  walker = 'person',
  walkerXPercent = null,
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

  // Tick the local-tz minute. Drives both atmosphere golden-hour detection
  // and live sun-position glow. Only ticks for today.
  const [currentMinute, setCurrentMinute] = useState(() => simulatedMinute ?? getCurrentMinuteInTimezone(timezone));
  useEffect(() => {
    if (simulatedMinute !== null) {
      setCurrentMinute(simulatedMinute);
      return;
    }
    setCurrentMinute(getCurrentMinuteInTimezone(timezone));
    if (!isToday) return;
    const id = setInterval(() => {
      setCurrentMinute(getCurrentMinuteInTimezone(timezone));
    }, 60_000);
    return () => clearInterval(id);
  }, [isToday, timezone, simulatedMinute]);

  // Atmosphere clock. For non-today, anchor "now" to solar noon so the
  // strip reads as full daylight rather than whatever the wall clock is.
  // Dev override (simulatedMinute) bypasses this so we can probe sunrise/sunset.
  const refMinute = useMemo(() => (
    simulatedMinute !== null
      ? simulatedMinute
      : (isToday ? currentMinute : Math.round(sunTimes.solarNoonMin))
  ), [isToday, currentMinute, sunTimes, simulatedMinute]);

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

  // Sun position drives the SunnyGlow center and the GoldenHourWash side.
  // Dev override → simulated time. Today + sun above horizon → live. Else → noon.
  const sunPositionPct = useMemo(() => {
    if (simulatedMinute !== null) {
      return getSunScenePctAtMinute(sunTimes, simulatedMinute)
        ?? getNoonSunScenePct(sunTimes) ?? { x: 50, y: 30 };
    }
    if (isToday) {
      const live = getSunScenePctAtMinute(sunTimes, currentMinute);
      if (live) return live;
    }
    return getNoonSunScenePct(sunTimes) ?? { x: 50, y: 30 };
  }, [isToday, currentMinute, sunTimes, simulatedMinute]);

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

        {/* Scenery silhouette */}
        <Scenery preset={scenery} />

        {/* Layer 3: atmosphere — modulates the whole scene */}
        <WeatherLayer
          sunPositionPct={sunPositionPct}
          walkerXPercent={walkerXPercent}
          walkerPreset={walker}
        />

        {/* Dev-only weather cycler (gated to non-prod inside the component) */}
        <WeatherDevCycler weather={cyclerOverride} onChange={setCyclerOverride} />
      </div>
    </SceneAtmosphereProvider>
  );
}
