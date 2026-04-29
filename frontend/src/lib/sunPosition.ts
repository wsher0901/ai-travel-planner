import SunCalc from 'suncalc';

export interface SunTimes {
  sunriseMin: number;
  sunsetMin: number;
  solarNoonMin: number;
  dawnMin: number;
  duskMin: number;
  astronomicalDawnMin: number;
  astronomicalDuskMin: number;
  nadirMin: number;
}

export interface SeasonalPalette {
  dayPrimary: string;
  dayDeep: string;
  dawnAmber: string;
  duskAmber: string;
  nightDeep: string;
  starColor: string;
}

function dateToDayMin(d: Date, timezone: string): number {
  if (isNaN(d.getTime())) return NaN; // SunCalc returns Invalid Date at polar extremes
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
  } catch {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
  }
  const parts = fmt.formatToParts(d);
  const hPart = parts.find(p => p.type === 'hour')?.value ?? '0';
  const mPart = parts.find(p => p.type === 'minute')?.value ?? '0';
  const h = parseInt(hPart, 10) % 24;
  const m = parseInt(mPart, 10);
  return h * 60 + m;
}

// Returns UTC timestamp of midnight in the given timezone on the given date.
// Noon UTC is used as a reference, adjusted ±24h for UTC+13/+14 where noon UTC
// falls on the next local calendar day.
function localMidnightAsUTC(date: string, timezone: string): number {
  const noonUTC = new Date(date + 'T12:00:00Z');
  let dateFmt: Intl.DateTimeFormat;
  let timeFmt: Intl.DateTimeFormat;
  try {
    dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: 'numeric', hour12: false });
  } catch {
    dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
    timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', hour: 'numeric', minute: 'numeric', hour12: false });
  }
  // If noon UTC lands on a different local date, shift reference by 24 h
  let refUTC = noonUTC;
  const localDate = dateFmt.format(noonUTC);
  if (localDate !== date) {
    refUTC = new Date(noonUTC.getTime() + (localDate > date ? -86400000 : 86400000));
  }
  const parts = timeFmt.formatToParts(refUTC);
  const localH = parseInt(parts.find(p => p.type === 'hour')?.value ?? '12', 10) % 24;
  const localM = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
  return refUTC.getTime() - (localH * 60 + localM) * 60000;
}

// Module-level cache keyed by "date|lat|lng|timezone" — eliminates 8x Intl.DateTimeFormat
// construction per call. Two SkyStrip slots are live simultaneously during a swipe, so this
// cuts 16 DateTimeFormat constructions per swipe down to near-zero on warm cache.
const sunTimesCache = new Map<string, SunTimes>();

export function getSunTimes(date: string, lat: number, lng: number, timezone: string = 'UTC'): SunTimes {
  const key = `${date}|${lat}|${lng}|${timezone}`;
  const cached = sunTimesCache.get(key);
  if (cached !== undefined) return cached;

  // Use 'Z' suffix to force UTC parsing, avoiding local-timezone offset bugs.
  const d = new Date(date + 'T12:00:00Z');
  const t = SunCalc.getTimes(d, lat, lng);
  const result: SunTimes = {
    sunriseMin: dateToDayMin(t.sunrise, timezone),
    sunsetMin: dateToDayMin(t.sunset, timezone),
    solarNoonMin: dateToDayMin(t.solarNoon, timezone),
    dawnMin: dateToDayMin(t.dawn, timezone),
    duskMin: dateToDayMin(t.dusk, timezone),
    // t.nightEnd = astronomical dawn; t.night = astronomical dusk.
    astronomicalDawnMin: dateToDayMin(t.nightEnd, timezone),
    astronomicalDuskMin: dateToDayMin(t.night, timezone),
    nadirMin: dateToDayMin(t.nadir, timezone),
  };

  if (sunTimesCache.size >= 200) {
    const firstKey = sunTimesCache.keys().next().value;
    if (firstKey !== undefined) sunTimesCache.delete(firstKey);
  }
  sunTimesCache.set(key, result);
  return result;
}

export function minToPercent(min: number): number {
  return Math.max(0, Math.min(100, (min / 1440) * 100));
}

// 24 hourly samples of solar altitude (radians) and azimuth in destination timezone.
// Module-level cache keyed by "date|lat|lng|timezone" — eliminates recompute on slot remount.
const hourlyElevationCache = new Map<string, { hour: number; altitude: number; azimuth: number }[]>();

export function getHourlySolarElevation(
  date: string, lat: number, lng: number, timezone: string
): { hour: number; altitude: number; azimuth: number }[] {
  const key = `${date}|${lat}|${lng}|${timezone}`;
  const cached = hourlyElevationCache.get(key);
  if (cached !== undefined) return cached;

  const midnight = localMidnightAsUTC(date, timezone);
  const result = Array.from({ length: 24 }, (_, hour) => {
    const t = new Date(midnight + hour * 3600000);
    const pos = SunCalc.getPosition(t, lat, lng);
    return { hour, altitude: pos.altitude, azimuth: pos.azimuth };
  });

  if (hourlyElevationCache.size >= 200) {
    const firstKey = hourlyElevationCache.keys().next().value;
    if (firstKey !== undefined) hourlyElevationCache.delete(firstKey);
  }
  hourlyElevationCache.set(key, result);
  return result;
}

// Moon position and phase at a specific minute (0–1439) in destination timezone.
export function getMoonPositionAtMinute(
  date: string, minute: number, lat: number, lng: number, timezone: string
): { altitude: number; azimuth: number; phase: number; illumination: number } {
  const midnight = localMidnightAsUTC(date, timezone);
  const t = new Date(midnight + minute * 60000);
  const pos = SunCalc.getMoonPosition(t, lat, lng);
  const illum = SunCalc.getMoonIllumination(t);
  return {
    altitude: pos.altitude,
    azimuth: pos.azimuth,
    phase: illum.phase,
    illumination: illum.fraction,
  };
}

// Returns minute (0–1439) at the midpoint of the longest night zone, or null if no night.
export function getMoonRenderTime(
  date: string, lat: number, lng: number, timezone: string
): number | null {
  const st = getSunTimes(date, lat, lng, timezone);
  if (!Number.isFinite(st.duskMin) || !Number.isFinite(st.dawnMin)) return null;
  const nightDuration = (1440 - st.duskMin) + st.dawnMin;
  if (nightDuration <= 30) return null;
  const midpoint = st.duskMin + nightDuration / 2;
  return Math.round(midpoint >= 1440 ? midpoint - 1440 : midpoint);
}

// Module-level cache for moon peak altitude minute.
const moonPeakCache = new Map<string, number | null>();

// Returns the minute (hour * 60) of the moon's peak altitude during the given date,
// or null if the moon never rises (peak altitude ≤ 0). Checked hourly for performance.
export function getMoonPeakMinute(
  date: string, lat: number, lng: number, timezone: string
): number | null {
  const key = `${date}|${lat}|${lng}|${timezone}`;
  const cached = moonPeakCache.get(key);
  if (cached !== undefined) return cached;

  const midnight = localMidnightAsUTC(date, timezone);
  let peakAltitude = -Infinity;
  let peakHour = 0;

  for (let hour = 0; hour < 24; hour++) {
    const t = new Date(midnight + hour * 3600000);
    const pos = SunCalc.getMoonPosition(t, lat, lng);
    if (pos.altitude > peakAltitude) {
      peakAltitude = pos.altitude;
      peakHour = hour;
    }
  }

  const result = peakAltitude > 0 ? peakHour * 60 : null;

  if (moonPeakCache.size >= 200) {
    const firstKey = moonPeakCache.keys().next().value;
    if (firstKey !== undefined) moonPeakCache.delete(firstKey);
  }
  moonPeakCache.set(key, result);
  return result;
}

// Sky color palette that shifts by season. Southern hemisphere months are offset by 6.
export function getSeasonalPalette(date: string, lat: number): SeasonalPalette {
  const month = parseInt(date.split('-')[1], 10);
  const effMonth = lat >= 0 ? month : ((month - 1 + 6) % 12) + 1;

  const season =
    [12, 1, 2].includes(effMonth) ? 'winter' :
    [3, 4, 5].includes(effMonth) ? 'spring' :
    [6, 7, 8].includes(effMonth) ? 'summer' : 'autumn';

  const palettes: Record<string, SeasonalPalette> = {
    summer: { dayPrimary: '#7AB8E8', dayDeep: '#5A9BD3', dawnAmber: '#F4A460', duskAmber: '#E8804A', nightDeep: '#0A1228', starColor: '#E8E8FF' },
    winter: { dayPrimary: '#A8D0E8', dayDeep: '#7BA8C8', dawnAmber: '#E89866', duskAmber: '#C66E50', nightDeep: '#050A1F', starColor: '#FFFFFF' },
    autumn: { dayPrimary: '#9CB8D0', dayDeep: '#6F8FA8', dawnAmber: '#E8A050', duskAmber: '#D4763C', nightDeep: '#0F1530', starColor: '#F0E8D8' },
    spring: { dayPrimary: '#8BC4E8', dayDeep: '#6BA0CC', dawnAmber: '#F0B070', duskAmber: '#E08858', nightDeep: '#0C1428', starColor: '#E0E8F0' },
  };

  return palettes[season];
}

export function getIsToday(date: string, timezone: string): boolean {
  try {
    return date === new Date().toLocaleDateString('en-CA', { timeZone: timezone });
  } catch {
    return date === new Date().toLocaleDateString('en-CA', { timeZone: 'UTC' });
  }
}
