'use client';
import SunnyGlow from './SunnyGlow';
import GoldenHourWash from './GoldenHourWash';
import WalkerLayer from './WalkerLayer';
import FoggyLayer from './conditions/FoggyLayer';
import PartlyCloudyLayer from './conditions/PartlyCloudyLayer';
import OvercastLayer from './conditions/OvercastLayer';
import SunnyLayer from './conditions/SunnyLayer';
import RainLayer from './conditions/RainLayer';
import SnowLayer from './conditions/SnowLayer';
import StormLayer from './conditions/StormLayer';
import WindyLayer from './conditions/WindyLayer';
import type { WalkerPreset } from '@/components/sky/types';

interface Props {
  sunPositionPct: { x: number; y: number };
  walkerXPercent: number | null;
  walkerPreset: WalkerPreset;
}

// Layer 3: weather. Sits above Layer 1 (diorama) and Layer 2 (landscape).
// pointer-events:none — never blocks interactions.
//
// Render order (back → front):
//   1. FoggyLayer        — fog bands + fog tint/dimming
//   2. PartlyCloudyLayer — placeholder (Prompt 4)
//   3. OvercastLayer     — placeholder (Prompt 4)
//   4. SunnyLayer        — placeholder (Prompt 3)
//   5. SunnyGlow         — sun-position-anchored radial glow
//   6. GoldenHourWash    — horizontal golden-hour wash
//   7. WalkerLayer       — "now" figure; above scenery, below precipitation
//   8. RainLayer         — rain particles + rain tint/dimming
//   9. SnowLayer         — snow particles
//  10. StormLayer        — storm rain + lightning + storm tint/dimming
//  11. WindyLayer        — placeholder (Prompt 3)
export default function WeatherLayer({ sunPositionPct, walkerXPercent, walkerPreset }: Props) {
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
      <FoggyLayer />
      <PartlyCloudyLayer />
      <OvercastLayer />
      <SunnyLayer />
      <SunnyGlow sunPositionPct={sunPositionPct} />
      <GoldenHourWash />
      <WalkerLayer xPercent={walkerXPercent} preset={walkerPreset} />
      <RainLayer />
      <SnowLayer />
      <StormLayer />
      <WindyLayer />
    </div>
  );
}
