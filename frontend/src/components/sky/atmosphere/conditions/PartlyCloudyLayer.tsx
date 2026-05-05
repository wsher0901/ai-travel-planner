'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSceneWeather } from '../SceneAtmosphere';
import {
  buildConditionTintGradient,
  buildConditionDimmingGradient,
  buildWhiteMaskGradient,
} from '../maskUtils';
import CloudShapes from './CloudShapes';
import type { SceneAtmosphere } from '@/lib/weather/types';

// Partly-cloudy ambient overlay = tier-scoped tint + dimming + cumulus
// silhouettes from the CloudShapes strategy renderer (`basic` set today;
// `detailed` / `wispy` are scaffolded for future passes).

function isPartlyCloudy(atmo: SceneAtmosphere): boolean {
  return atmo.conditionTier === 'partly-cloudy';
}

export default function PartlyCloudyLayer() {
  const { samples48 } = useSceneWeather();

  const { anyPartlyCloudy, tintGradient, dimmingGradient, cloudMask } = useMemo(() => {
    const any = samples48.some(isPartlyCloudy);
    return {
      anyPartlyCloudy: any,
      tintGradient:    buildConditionTintGradient(samples48, 'partly-cloudy'),
      dimmingGradient: buildConditionDimmingGradient(samples48, 'partly-cloudy'),
      cloudMask:       any ? buildWhiteMaskGradient(samples48, isPartlyCloudy) : null,
    };
  }, [samples48]);

  if (!anyPartlyCloudy || !cloudMask) return null;

  return (
    <>
      {/* Partly-cloudy-scoped tint — cool blue, multiply blend */}
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
      {/* Partly-cloudy-scoped dimming */}
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
      {/* Cumulus silhouettes — scoped via the same partly-cloudy mask */}
      <CloudShapes cloudSet="basic" maskGradient={cloudMask} />
    </>
  );
}
