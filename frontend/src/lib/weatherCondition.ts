import type { WeatherCondition } from '@/components/sky/types';

/**
 * Map an Open-Meteo WMO weather code to a coarser WeatherCondition.
 * Reference: https://open-meteo.com/en/docs (Weather variable WMO Weather interpretation codes)
 */
export function wmoToCondition(code: number): WeatherCondition {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2) return 'partly-cloudy';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if ([51, 53, 55, 61, 80].includes(code)) return 'rain-light';
  if ([63, 65, 81, 82].includes(code)) return 'rain-heavy';
  if (code === 95 || code === 96 || code === 99) return 'thunderstorm';
  if ([71, 73, 77, 85].includes(code)) return 'snow-light';
  if ([75, 86].includes(code)) return 'snow-heavy';
  return 'clear';
}
