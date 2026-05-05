'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSceneWeather } from '../SceneAtmosphere';
import {
  buildConditionTintGradient,
  buildConditionDimmingGradient,
} from '../maskUtils';
import type { SceneAtmosphere } from '@/lib/weather/types';

// Overcast-tier ambient overlay. Cleanup: the wavy ceiling band path was
// removed; the layer now renders only tier-scoped tint + dimming so an
// overcast x-region reads as "muted, dim" without an explicit cloud-shape
// silhouette. Cloud rendering is deferred indefinitely.

function isOvercast(atmo: SceneAtmosphere): boolean {
  return atmo.conditionTier === 'overcast';
}

export default function OvercastLayer() {
  const { samples48 } = useSceneWeather();

  const { anyOvercast, tintGradient, dimmingGradient } = useMemo(() => {
    const any = samples48.some(isOvercast);
    return {
      anyOvercast:     any,
      tintGradient:    buildConditionTintGradient(samples48, 'overcast'),
      dimmingGradient: buildConditionDimmingGradient(samples48, 'overcast'),
    };
  }, [samples48]);

  if (!anyOvercast) return null;

  return (
    <>
      {/* Overcast-scoped tint — gray-blue, multiply blend */}
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
        }}
        animate={{ backgroundImage: tintGradient }}
        initial={false}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
      {/* Overcast-scoped dimming */}
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
        animate={{ backgroundImage: dimmingGradient }}
        initial={false}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
    </>
  );
}
