'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSceneWeather } from './SceneAtmosphere';
import { sampleIndexToPercent } from '@/lib/weather/spatial';

const ACTIVE_ALPHA = 0.10;
const WARM_R = 255;
const WARM_G = 175;
const WARM_B = 110;

// Per-stop alpha = ACTIVE_ALPHA when atmo.goldenHourActive at that hour,
// else 0. CSS gradient interpolation between adjacent stops naturally
// feathers the active window edges, since stops are at 30-min intervals
// and golden-hour spans ~90 min — neighbour samples ramp 0→active→0.
export default function GoldenHourWash() {
  const { samples48 } = useSceneWeather();

  const gradient = useMemo(() => {
    const parts: string[] = [];
    const n = samples48.length;
    for (let i = 0; i < n; i++) {
      const a = samples48[i].goldenHourActive ? ACTIVE_ALPHA : 0;
      const pct = sampleIndexToPercent(i, n).toFixed(3);
      parts.push(`rgba(${WARM_R}, ${WARM_G}, ${WARM_B}, ${a.toFixed(3)}) ${pct}%`);
    }
    return `linear-gradient(to right, ${parts.join(', ')})`;
  }, [samples48]);

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        mixBlendMode: 'soft-light',
      }}
      animate={{ backgroundImage: gradient }}
      initial={false}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
    />
  );
}
