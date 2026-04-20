import SunCalc from 'suncalc';

export interface SunTimes {
  sunriseMin: number;
  sunsetMin: number;
  solarNoonMin: number;
  dawnMin: number;
  duskMin: number;
  astronomicalDawnMin: number;
  astronomicalDuskMin: number;
}

function dateToDayMin(d: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const hPart = parts.find(p => p.type === 'hour')?.value ?? '0';
  const mPart = parts.find(p => p.type === 'minute')?.value ?? '0';
  const h = parseInt(hPart, 10) % 24;
  const m = parseInt(mPart, 10);
  return h * 60 + m;
}

export function getSunTimes(date: string, lat: number, lng: number, timezone: string = 'UTC'): SunTimes {
  const d = new Date(date + 'T12:00:00');
  const t = SunCalc.getTimes(d, lat, lng);
  return {
    sunriseMin: dateToDayMin(t.sunrise, timezone),
    sunsetMin: dateToDayMin(t.sunset, timezone),
    solarNoonMin: dateToDayMin(t.solarNoon, timezone),
    dawnMin: dateToDayMin(t.dawn, timezone),
    duskMin: dateToDayMin(t.dusk, timezone),
    astronomicalDawnMin: dateToDayMin(t.nauticalDawn, timezone),
    astronomicalDuskMin: dateToDayMin(t.nauticalDusk, timezone),
  };
}

export function minToPercent(min: number): number {
  return (min / 1440) * 100;
}
