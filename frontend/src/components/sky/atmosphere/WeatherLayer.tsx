'use client';
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
  // Threaded through for the Prompt 3b sun-bloom layer; unused at present.
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
//   4. SunnyLayer        — placeholder (Prompt 3b — replaces deleted SunnyGlow)
//   5. GoldenHourWash    — horizontal golden-hour wash (gated to sunny/partly-cloudy)
//   6. WalkerLayer       — "now" figure; above scenery, below precipitation
//   7. RainLayer         — rain particles + rain tint/dimming
//   8. SnowLayer         — snow particles
//   9. StormLayer        — storm rain + lightning + storm tint/dimming
//  10. WindyLayer        — placeholder (Prompt 3)
export default function WeatherLayer({ sunPositionPct: _sunPositionPct, walkerXPercent, walkerPreset }: Props) {
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
      <GoldenHourWash />
      <WalkerLayer xPercent={walkerXPercent} preset={walkerPreset} />
      <RainLayer />
      <SnowLayer />
      <StormLayer />
      <WindyLayer />
    </div>
  );
}
