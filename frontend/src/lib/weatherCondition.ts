import type { WeatherCondition } from '@/components/sky/types';

// Code-only WMO mapper kept aligned with the 11-tier union for consumers
// outside the atmosphere pipeline. The authoritative classifier
// (visibility-aware, cloud-cover promotion) lives at lib/weather/mapping.ts.
export function wmoToCondition(code: number): WeatherCondition {
  if (code === 0 || code === 1) return 'sunny';
  if (code === 2) return 'partly-cloudy';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'foggy';
  if (code === 51 || code === 56 || code === 61 || code === 66 || code === 80) return 'light-rain';
  if (code === 53 || code === 57 || code === 63 || code === 81) return 'moderate-rain';
  if (code === 55 || code === 65 || code === 67 || code === 82) return 'heavy-rain';
  if (code === 71 || code === 77 || code === 85) return 'light-snow';
  if (code === 73 || code === 86) return 'moderate-snow';
  if (code === 75) return 'heavy-snow';
  if (code === 95 || code === 96 || code === 99) return 'thunderstorm';
  return 'partly-cloudy';
}
