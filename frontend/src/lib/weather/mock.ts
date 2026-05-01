import type { DayWeather, HourlyWeather } from './types';

// Synthesize a sunny, mild DayWeather row. Used when the backend proxy fails
// so the scene still renders something instead of throwing. Hourly arrays
// are 24 entries (one per integer hour); values are intentionally bland so
// `getHourlyAtmosphere` resolves to 'sunny' / no-precipitation / wide
// visibility for every hour.
function makeMockHourly(hour: number): HourlyWeather {
  return {
    hour,
    weatherCode: 0,
    precipitationMmHr: 0,
    snowfallCmHr: 0,
    cloudCover: 20,
    cloudCoverLow: 10,
    cloudCoverMid: 5,
    cloudCoverHigh: 5,
    windSpeedMps: 3,
    windAngleDeg: 200,
    visibilityM: 16000,
    humidity: 50,
    apparentTempC: 18,
    uvIndex: hour >= 10 && hour <= 16 ? 5 : 1,
    usAqi: 35,
    pm25: 8,
    pm10: 14,
  };
}

function makeSunriseSunset(date: string): { sunrise: Date; sunset: Date } {
  const [y, m, d] = date.split('-').map(Number);
  // 6:00 AM and 7:00 PM destination-local clock. We construct as local Date;
  // atmosphere.ts only uses .getHours()/.getMinutes() so the absolute UTC
  // value never matters.
  const sunrise = new Date(y, (m ?? 1) - 1, d ?? 1, 6, 0, 0);
  const sunset = new Date(y, (m ?? 1) - 1, d ?? 1, 19, 0, 0);
  return { sunrise, sunset };
}

// Iterate YYYY-MM-DD strings inclusive between start and end.
export function eachDate(startDate: string, endDate: string): string[] {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const out: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const d = new Date(t);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    out.push(`${yyyy}-${mm}-${dd}`);
  }
  return out;
}

export function makeMockDay(date: string): DayWeather {
  const hourly: HourlyWeather[] = [];
  for (let h = 0; h < 24; h++) hourly.push(makeMockHourly(h));
  const { sunrise, sunset } = makeSunriseSunset(date);
  return {
    date,
    hourly,
    daily: {
      sunrise,
      sunset,
      maxTempC: 22,
      minTempC: 12,
    },
  };
}

export function makeMockTripWeather(
  startDate: string,
  endDate: string,
): Map<string, DayWeather> {
  const out = new Map<string, DayWeather>();
  for (const date of eachDate(startDate, endDate)) {
    out.set(date, makeMockDay(date));
  }
  return out;
}
