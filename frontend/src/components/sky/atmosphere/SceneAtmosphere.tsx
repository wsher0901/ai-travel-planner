'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  getAtmosphereAcrossDay as deriveAcrossDay,
  getAtmosphereAtTime as deriveAtTime,
  getHourlyAtmosphere,
  type DiscreteCrossfade,
} from '@/lib/weather/atmosphere';
import { ATMOSPHERE_SAMPLES, sampleIndexToHour } from '@/lib/weather/spatial';
import { useTripWeather } from '@/hooks/useTripWeather';
import type {
  AtmosphereCondition,
  DayMeta,
  DayWeather,
  HourlyWeather,
  SceneAtmosphere,
  SunMood,
  WeatherCondition,
} from '@/lib/weather/types';

// Re-export shared types so the existing 2A/2C `from './SceneAtmosphere'`
// imports continue to resolve. The canonical home for these is
// @/lib/weather/types now; this file just bridges back-compat.
export type { AtmosphereCondition, SceneAtmosphere, SunMood };

// ConditionTier was 2A's narrower 5-value union ('clear' | 'cloudy' | 'rain'
// | 'storm' | 'fog'). 3A widens it: 'sunny' replaces 'clear', and 'snow'
// is added. Re-exported under the old name to avoid touching consumer code.
export type ConditionTier = WeatherCondition;

export interface MockWeather {
  condition: AtmosphereCondition;
  windVector: { angleDeg: number; speedMps: number };
}

export const DEFAULT_MOCK_WEATHER: MockWeather = {
  condition: 'sunny',
  windVector: { angleDeg: 15, speedMps: 4 },
};

// Cold-cache / genuinely-missing-data fallback — neutral overcast avoids
// a sunny flash on slide before real data resolves.
const NO_DATA_FALLBACK_WEATHER: MockWeather = {
  condition: 'overcast',
  windVector: { angleDeg: 15, speedMps: 4 },
};

// Synthesize a representative HourlyWeather row from a cycler condition so
// dev-cycler atmospheres run through the same getHourlyAtmosphere pipeline
// as real data. Visibility is intentionally large for non-fog conditions
// so the visibility override in mapping.ts doesn't kick in.
//
// NOTE: The cycler enumerates AtmosphereCondition (12 values incl. null
// "auto"), not WeatherCondition. Each cycler entry synthesizes a WMO code
// + cloud cover + precipitation rate that maps through the regular pipeline
// to its corresponding conditionTier — so partly-cloudy, overcast, and the
// three snow tiers (light/moderate/heavy) are all reachable from dev QA.
// 'cloudy' is retained as a legacy alias for overcast.
function hourlyFromMock(m: MockWeather, hourFloat: number): HourlyWeather {
  const make = (
    code: number,
    mm: number,
    snow: number,
    cloud: number,
    vis: number,
  ): HourlyWeather => ({
    hour: Math.floor(hourFloat),
    weatherCode: code,
    precipitationMmHr: mm,
    snowfallCmHr: snow,
    cloudCover: cloud,
    cloudCoverLow: cloud * 0.6,
    cloudCoverMid: cloud * 0.3,
    cloudCoverHigh: cloud * 0.1,
    windSpeedMps: m.windVector.speedMps,
    windAngleDeg: m.windVector.angleDeg,
    visibilityM: vis,
    humidity: 60,
    apparentTempC: 18,
    uvIndex: 3,
    usAqi: 35,
    pm25: 8,
    pm10: 14,
  });

  switch (m.condition) {
    case 'sunny':         return make(0,  0,   0,   20, 16000);
    // Partly-cloudy: WMO 2 + 60% cloud cover → conditionTier 'partly-cloudy'.
    case 'partly_cloudy': return make(2,  0,   0,   60, 16000);
    // 'cloudy' (legacy) and 'overcast' (cycler-explicit) both produce the
    // overcast tier; kept distinct so the cycler can label them.
    case 'cloudy':
    case 'overcast':      return make(3,  0,   0,   95, 16000);
    case 'foggy':         return make(45, 0,   0,   90,   500);
    case 'light_rain':    return make(61, 0.3, 0,   85, 12000);
    case 'moderate_rain': return make(63, 2,   0,   88, 10000);
    case 'heavy_rain':    return make(65, 8,   0,   95,  6000);
    case 'thunderstorm':  return make(95, 6,   0,   95,  6000);
    // Snow tiers: visibility kept ≥ 4000 m so the foggy override in
    // mapToConditionTier doesn't reroute these to 'foggy'.
    case 'light_snow':    return make(71, 0,   0.3, 90,  8000);
    case 'moderate_snow': return make(73, 0,   1.5, 92,  6000);
    case 'heavy_snow':    return make(75, 0,   3.5, 95,  5000);
    default: {
      // Exhaustiveness guard — adding a new AtmosphereCondition value
      // without a case here is a compile error.
      const _exhaustive: never = m.condition;
      throw new Error(`Unhandled AtmosphereCondition in hourlyFromMock: ${_exhaustive}`);
    }
  }
}

interface SceneWeatherContextValue {
  atmosphere: SceneAtmosphere;
  dayWeather: DayWeather | null;
  isMockFallback: boolean;
  loading: boolean;
  // Pre-built 48-stop sample array for the rendered day. Always non-empty
  // (length 48). Override-aware: when the dev cycler is active, every
  // sample reflects the cycled condition; when no real data is available,
  // every sample is the bland sunny default. 3B horizontal-mapping
  // overlays consume this directly.
  samples48: SceneAtmosphere[];
  getAtmosphereAcrossDay: (samples?: number) => SceneAtmosphere[] | null;
  getDiscreteCrossfade: (hourFloat: number) => DiscreteCrossfade | null;
}

const SceneWeatherContext = createContext<SceneWeatherContextValue | null>(null);

// Back-compat hook — returns just the SceneAtmosphere value, exactly like 2A.
export function useSceneAtmosphere(): SceneAtmosphere {
  const ctx = useContext(SceneWeatherContext);
  if (!ctx) {
    throw new Error('useSceneAtmosphere must be used within <SceneAtmosphereProvider>');
  }
  return ctx.atmosphere;
}

// Full context for callers that need dayWeather + cross-day getters (3B).
export function useSceneWeather(): SceneWeatherContextValue {
  const ctx = useContext(SceneWeatherContext);
  if (!ctx) {
    throw new Error('useSceneWeather must be used within <SceneAtmosphereProvider>');
  }
  return ctx;
}

interface ProviderProps {
  // Drives weather fetching. null/empty disables fetch and falls to mock.
  tripId: string | null;
  // Day to render, in destination-local YYYY-MM-DD.
  date: string;
  // Time of day on `date`, fractional hour 0..24.
  hourFloat: number;
  // Dev cycler override. Non-null in dev replaces real data with a synthetic
  // HourlyWeather built from the cycled condition. Ignored in production.
  mockOverride?: MockWeather | null;
  // Locally-computed sunrise/sunset (Dates with destination-local clock).
  // Used when no real data is available for the rendered day.
  fallbackSunrise: Date;
  fallbackSunset: Date;
  children: ReactNode;
}

function parseDateLocal(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function SceneAtmosphereProvider({
  tripId,
  date,
  hourFloat,
  mockOverride,
  fallbackSunrise,
  fallbackSunset,
  children,
}: ProviderProps) {
  const hook = useTripWeather(tripId);
  const dayWeather = hook.daysData.get(date) ?? null;

  const isDev = process.env.NODE_ENV !== 'production';
  const overrideActive = isDev && mockOverride != null;

  const fallbackDaily = useMemo<DayMeta>(() => ({
    sunrise: fallbackSunrise,
    sunset: fallbackSunset,
    maxTempC: 20,
    minTempC: 10,
  }), [fallbackSunrise, fallbackSunset]);

  const atmosphere = useMemo<SceneAtmosphere>(() => {
    if (overrideActive && mockOverride) {
      // Cycler path — synthetic hourly through the real pipeline.
      return getHourlyAtmosphere(
        hourlyFromMock(mockOverride, hourFloat),
        fallbackDaily,
        hourFloat,
      );
    }

    if (dayWeather) {
      return deriveAtTime(dayWeather, hourFloat);
    }

    // No real data and no override — overcast until network resolves.
    return getHourlyAtmosphere(
      hourlyFromMock(NO_DATA_FALLBACK_WEATHER, hourFloat),
      fallbackDaily,
      hourFloat,
    );
  }, [overrideActive, mockOverride, dayWeather, hourFloat, fallbackDaily]);

  // 48-stop atmosphere strip across the rendered day. Memoized on the
  // *day's* inputs only — does NOT depend on hourFloat — so the array
  // doesn't churn every minute when "now" ticks.
  const samples48 = useMemo<SceneAtmosphere[]>(() => {
    if (overrideActive && mockOverride) {
      const out = new Array<SceneAtmosphere>(ATMOSPHERE_SAMPLES);
      for (let i = 0; i < ATMOSPHERE_SAMPLES; i++) {
        const hf = sampleIndexToHour(i);
        out[i] = getHourlyAtmosphere(
          hourlyFromMock(mockOverride, hf),
          fallbackDaily,
          hf,
        );
      }
      return out;
    }
    if (dayWeather) {
      return deriveAcrossDay(dayWeather, ATMOSPHERE_SAMPLES);
    }
    const out = new Array<SceneAtmosphere>(ATMOSPHERE_SAMPLES);
    for (let i = 0; i < ATMOSPHERE_SAMPLES; i++) {
      const hf = sampleIndexToHour(i);
      out[i] = getHourlyAtmosphere(
        hourlyFromMock(NO_DATA_FALLBACK_WEATHER, hf),
        fallbackDaily,
        hf,
      );
    }
    return out;
  }, [overrideActive, mockOverride, dayWeather, fallbackDaily]);

  const value = useMemo<SceneWeatherContextValue>(() => ({
    atmosphere,
    dayWeather,
    isMockFallback: hook.isMockFallback,
    loading: hook.loading,
    samples48,
    getAtmosphereAcrossDay: (samples?: number) =>
      hook.getAtmosphereAcrossDay(parseDateLocal(date), samples),
    getDiscreteCrossfade: (hf: number) =>
      hook.getDiscreteCrossfade(parseDateLocal(date), hf),
  }), [atmosphere, dayWeather, hook, date, samples48]);

  return (
    <SceneWeatherContext.Provider value={value}>
      {children}
    </SceneWeatherContext.Provider>
  );
}
