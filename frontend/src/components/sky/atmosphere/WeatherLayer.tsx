'use client';
import ColorTintOverlay from './ColorTintOverlay';
import DimmingOverlay from './DimmingOverlay';
import SunnyGlow from './SunnyGlow';
import GoldenHourWash from './GoldenHourWash';
import FogLayer from './FogLayer';
import RainField from './RainField';
import LightningFlash from './LightningFlash';

interface Props {
  sunPositionPct: { x: number; y: number };
}

// Layer 3: weather. Sits above Layer 1 (diorama) and Layer 2 (landscape).
// pointer-events:none — never blocks interactions.
export default function WeatherLayer({ sunPositionPct }: Props) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 20,
      }}
    >
      {/* Render order: back → front */}
      <ColorTintOverlay />
      <DimmingOverlay />
      <SunnyGlow sunPositionPct={sunPositionPct} />
      <GoldenHourWash sunPositionPct={sunPositionPct} />
      <FogLayer />
      {/* TODO 2B: <CloudField /> */}
      {/* TODO 2B: <SunGodRays sunPositionPct={sunPositionPct} /> */}
      <RainField />
      <LightningFlash />
    </div>
  );
}
