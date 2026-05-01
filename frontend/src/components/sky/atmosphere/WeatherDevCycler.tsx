'use client';
import { motion } from 'framer-motion';
import type { AtmosphereCondition, MockWeather } from './SceneAtmosphere';

// First entry is null = "auto" (use real data from useTripWeather).
// Remaining entries cycle through every visual condition for QA.
const CYCLE: (AtmosphereCondition | null)[] = [
  null,
  'sunny',
  'cloudy',
  'foggy',
  'light_rain',
  'moderate_rain',
  'heavy_rain',
  'thunderstorm',
];

const DEFAULT_WIND = { angleDeg: 15, speedMps: 4 };

interface Props {
  weather: MockWeather | null;
  onChange: (next: MockWeather | null) => void;
}

export default function WeatherDevCycler({ weather, onChange }: Props) {
  if (process.env.NODE_ENV === 'production') return null;

  const currentCondition = weather?.condition ?? null;
  const idx = CYCLE.indexOf(currentCondition);
  const nextEntry = CYCLE[(idx + 1) % CYCLE.length];

  const handleClick = () => {
    if (nextEntry === null) {
      onChange(null);
    } else {
      onChange({
        condition: nextEntry,
        windVector: weather?.windVector ?? DEFAULT_WIND,
      });
    }
  };

  const label = currentCondition ?? 'auto';
  const nextLabel = nextEntry ?? 'auto';

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileHover={{ backgroundColor: 'rgba(6,182,212,0.16)', borderColor: 'rgba(6,182,212,0.7)' }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        bottom: 8,
        right: 8,
        zIndex: 50,
        pointerEvents: 'auto',
        padding: '4px 12px',
        fontFamily: 'Sora, system-ui, sans-serif',
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '0.04em',
        color: currentCondition === null ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.9)',
        backgroundColor: 'rgba(6,182,212,0.08)',
        border: '1px solid rgba(6,182,212,0.45)',
        borderRadius: 999,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      aria-label={`Cycle weather, currently ${label}, click for ${nextLabel}`}
    >
      {label}
    </motion.button>
  );
}
