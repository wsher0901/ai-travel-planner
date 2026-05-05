'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSceneWeather } from '../SceneAtmosphere';
import {
  buildConditionTintGradient,
  buildConditionDimmingGradient,
  buildWhiteMaskGradient,
} from '../maskUtils';
import type { SceneAtmosphere } from '@/lib/weather/types';

// Foggy-tier ambient overlay = tier-scoped tint + dimming + a bottom-anchored
// density gradient. The bottom-density layer accumulates fog toward the
// ground (thin haze at top, denser at bottom) while keeping the upper sky
// just slightly tinted — matches how real ground fog reads visually.
// No discrete bands, no swirl motion (those were dropped in the earlier
// cleanup pass).

function isFoggy(atmo: SceneAtmosphere): boolean {
  return atmo.conditionTier === 'foggy';
}

export default function FoggyLayer() {
  const { samples48 } = useSceneWeather();

  const { anyFog, tintGradient, dimmingGradient, fogMask } = useMemo(() => {
    const any = samples48.some(isFoggy);
    return {
      anyFog:          any,
      tintGradient:    buildConditionTintGradient(samples48, 'foggy'),
      dimmingGradient: buildConditionDimmingGradient(samples48, 'foggy'),
      fogMask:         any ? buildWhiteMaskGradient(samples48, isFoggy) : null,
    };
  }, [samples48]);

  if (!anyFog || !fogMask) return null;

  return (
    <>
      {/* Foggy-scoped tint — neutral whitening, multiply blend */}
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
      {/* Foggy-scoped dimming */}
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
      {/* Bottom-anchored density: 65% of strip height, vertical gradient
          fading from transparent at top to alpha 0.50 at bottom. Masked
          horizontally by the foggy predicate so density only accumulates
          in foggy x-regions. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '65%',
          pointerEvents: 'none',
          background:
            'linear-gradient(to bottom, rgba(220,224,228,0) 0%, rgba(220,224,228,0.20) 50%, rgba(220,224,228,0.50) 100%)',
          maskImage: fogMask,
          WebkitMaskImage: fogMask,
        }}
      />
    </>
  );
}
