'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useTripStore } from '@/store/tripStore';
import {
  getAtmosphereAcrossDay as deriveAcrossDay,
  getAtmosphereAtTime as deriveAtTime,
  getDiscreteCrossfade as deriveCrossfade,
  type DiscreteCrossfade,
} from '@/lib/weather/atmosphere';
import { makeMockTripWeather } from '@/lib/weather/mock';
import type {
  DayMeta,
  DayWeather,
  DayWeatherWire,
  SceneAtmosphere,
  WeatherResponseWire,
  WeatherSource,
} from '@/lib/weather/types';

const FORECAST_TTL_MS = 6 * 60 * 60 * 1000;          // 6 hours
const ESTIMATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;    // 30 days
const STORAGE_PREFIX = 'weather:';

export interface UseTripWeatherReturn {
  loading: boolean;
  error: Error | null;
  daysData: Map<string, DayWeather>;
  getAtmosphereAtTime: (date: Date, hourFloat: number) => SceneAtmosphere | null;
  getAtmosphereAcrossDay: (date: Date, samples?: number) => SceneAtmosphere[] | null;
  getDiscreteCrossfade: (date: Date, hourFloat: number) => DiscreteCrossfade | null;
  getDayMeta: (date: Date) => DayMeta | null;
  // Authoritative source from backend. 'unavailable' covers both the
  // backend-explicit signal and any fetch failure on the frontend side.
  source: WeatherSource;
  isEstimate: boolean;
  isUnavailable: boolean;
  // True when source !== 'forecast' — the trip is in the climate-fallback
  // regime (or worse).
  isOutOfForecastRange: boolean;
  // Distinct from isUnavailable: true ONLY when the network/parse/auth
  // chain failed. A backend response of source='unavailable' does NOT set
  // this flag — it's an explicit, expected signal, not a frontend fallback.
  isMockFallback: boolean;
}

const EMPTY_DAYS = new Map<string, DayWeather>();

function ttlForSource(source: WeatherSource): number {
  if (source === 'forecast') return FORECAST_TTL_MS;
  if (source === 'estimate') return ESTIMATE_TTL_MS;
  return 0; // unavailable is never cached
}

function buildCacheKey(
  lat: number, lon: number, start: string, end: string, source: WeatherSource,
): string {
  return `${STORAGE_PREFIX}${lat.toFixed(2)}:${lon.toFixed(2)}:${start}:${end}:${source}`;
}

function buildInflightKey(
  lat: number, lon: number, start: string, end: string,
): string {
  return `${lat.toFixed(2)}:${lon.toFixed(2)}:${start}:${end}`;
}

function parseWireDays(wire: DayWeatherWire[]): Map<string, DayWeather> {
  const out = new Map<string, DayWeather>();
  for (const d of wire) {
    out.set(d.date, {
      date: d.date,
      hourly: d.hourly,
      daily: {
        sunrise: new Date(d.daily.sunrise),
        sunset: new Date(d.daily.sunset),
        maxTempC: d.daily.maxTempC,
        minTempC: d.daily.minTempC,
      },
    });
  }
  return out;
}

interface StoredCache {
  fetchedAt: number; // ms
  wire: WeatherResponseWire;
}

// Try cached forecast (shorter TTL) first, then estimate. Returns the
// freshest cache entry that's within its source-specific TTL, or null.
function readLocalCache(
  lat: number, lon: number, start: string, end: string,
): WeatherResponseWire | null {
  if (typeof window === 'undefined') return null;
  for (const source of ['forecast', 'estimate'] as const) {
    const key = buildCacheKey(lat, lon, start, end, source);
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed: StoredCache = JSON.parse(raw);
      if (typeof parsed?.fetchedAt !== 'number' || !parsed.wire) continue;
      const ttl = ttlForSource(source);
      if (ttl <= 0) continue;
      if (Date.now() - parsed.fetchedAt > ttl) continue;
      // Source field MUST match the cache slot we read from. Defense
      // against tampered/legacy cache entries.
      if (parsed.wire.source !== source) continue;
      return parsed.wire;
    } catch {
      continue;
    }
  }
  return null;
}

function writeLocalCache(
  lat: number, lon: number, start: string, end: string,
  wire: WeatherResponseWire,
): void {
  if (typeof window === 'undefined') return;
  if (wire.source === 'unavailable') return; // never cache failures
  try {
    const key = buildCacheKey(lat, lon, start, end, wire.source);
    const payload: StoredCache = { fetchedAt: Date.now(), wire };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Quota errors etc. — non-fatal.
  }
}

// Module-level in-flight promise singleton. Both SkyStrip and the
// AnnotationStrip's WeatherSourceIndicator call useTripWeather, so without
// dedupe each cold mount fires an independent request and the two
// consumers can briefly disagree on source. With this map, the first
// caller's promise is shared by all subsequent callers until it settles.
const inFlight = new Map<string, Promise<WeatherResponseWire>>();

async function fetchWeatherShared(
  lat: number, lon: number, start: string, end: string,
): Promise<WeatherResponseWire> {
  const key = buildInflightKey(lat, lon, start, end);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const params = new URLSearchParams({
    lat: lat.toFixed(2),
    lon: lon.toFixed(2),
    start_date: start,
    end_date: end,
  });

  const promise = (async () => {
    try {
      const wire = await api.get<WeatherResponseWire>(
        `/weather?${params.toString()}`,
        { skipAuth: true },
      );
      // The spec mandates frontend MUST reject responses without source.
      if (!wire || typeof wire !== 'object' || typeof wire.source !== 'string') {
        throw new Error('Backend response missing required `source` field');
      }
      if (wire.source !== 'forecast' && wire.source !== 'estimate' && wire.source !== 'unavailable') {
        throw new Error(`Backend returned unknown source: ${wire.source}`);
      }
      writeLocalCache(lat, lon, start, end, wire);
      return wire;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

interface HookState {
  daysData: Map<string, DayWeather>;
  source: WeatherSource;
  isMockFallback: boolean;
}

const EMPTY_STATE: HookState = {
  daysData: EMPTY_DAYS,
  source: 'forecast', // sentinel; will be overwritten before first read
  isMockFallback: false,
};

function applyWire(
  wire: WeatherResponseWire,
  startDate: string,
  endDate: string,
): HookState {
  if (wire.source === 'unavailable' || wire.days.length === 0) {
    // Backend explicitly signaled unavailable, OR an empty days payload.
    // Synthesize mock so the scene still renders. NOT a frontend fallback.
    return {
      daysData: makeMockTripWeather(startDate, endDate),
      source: 'unavailable',
      isMockFallback: false,
    };
  }
  return {
    daysData: parseWireDays(wire.days),
    source: wire.source,
    isMockFallback: false,
  };
}

export function useTripWeather(tripId: string | null | undefined): UseTripWeatherReturn {
  const tripPlan = useTripStore((s) => s.tripPlan);

  const lat = tripPlan?.destination_latitude ?? null;
  const lon = tripPlan?.destination_longitude ?? null;
  const startDate = tripPlan?.start_date ?? null;
  const endDate = tripPlan?.end_date ?? null;
  const planMatchesTripId = tripPlan?.id === tripId;

  const [state, setState] = useState<HookState>(() => {
    if (lat == null || lon == null || !startDate || !endDate) return EMPTY_STATE;
    const cached = readLocalCache(lat, lon, startDate, endDate);
    if (!cached) return EMPTY_STATE;
    return applyWire(cached, startDate, endDate);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!tripId || !planMatchesTripId || lat == null || lon == null || !startDate || !endDate) {
      setState(EMPTY_STATE);
      setError(null);
      setLoading(false);
      return;
    }

    // Cheap path: localStorage fresh hit.
    const cached = readLocalCache(lat, lon, startDate, endDate);
    if (cached) {
      setState(applyWire(cached, startDate, endDate));
      setError(null);
      setLoading(false);
      return;
    }

    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    fetchWeatherShared(lat, lon, startDate, endDate)
      .then((wire) => {
        if (reqId !== requestIdRef.current) return;
        setState(applyWire(wire, startDate, endDate));
        setError(null);
      })
      .catch((err: unknown) => {
        if (reqId !== requestIdRef.current) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setState({
          daysData: makeMockTripWeather(startDate, endDate),
          source: 'unavailable',
          isMockFallback: true,
        });
      })
      .finally(() => {
        if (reqId !== requestIdRef.current) return;
        setLoading(false);
      });
  }, [tripId, planMatchesTripId, lat, lon, startDate, endDate]);

  const lookupKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return useMemo<UseTripWeatherReturn>(() => {
    const { daysData, source, isMockFallback } = state;
    return {
      loading,
      error,
      daysData,
      source,
      isMockFallback,
      isEstimate: source === 'estimate',
      isUnavailable: source === 'unavailable',
      isOutOfForecastRange: source !== 'forecast',
      getAtmosphereAtTime: (date, hourFloat) => {
        const day = daysData.get(lookupKey(date));
        if (!day) return null;
        return deriveAtTime(day, hourFloat);
      },
      getAtmosphereAcrossDay: (date, samples = 48) => {
        const day = daysData.get(lookupKey(date));
        if (!day) return null;
        return deriveAcrossDay(day, samples);
      },
      getDiscreteCrossfade: (date, hourFloat) => {
        const day = daysData.get(lookupKey(date));
        if (!day) return null;
        return deriveCrossfade(day, hourFloat);
      },
      getDayMeta: (date) => daysData.get(lookupKey(date))?.daily ?? null,
    };
  }, [loading, error, state]);
}
