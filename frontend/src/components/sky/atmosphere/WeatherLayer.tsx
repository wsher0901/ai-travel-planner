'use client';
import SunnyGlow from './SunnyGlow';
import GoldenHourWash from './GoldenHourWash';
import FoggyLayer from './conditions/FoggyLayer';
import PartlyCloudyLayer from './conditions/PartlyCloudyLayer';
import OvercastLayer from './conditions/OvercastLayer';
import SunnyLayer from './conditions/SunnyLayer';
import RainLayer from './conditions/RainLayer';
import SnowLayer from './conditions/SnowLayer';
import StormLayer from './conditions/StormLayer';
import WindyLayer from './conditions/WindyLayer';

interface Props {
  sunPositionPct: { x: number; y: number };
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
//   7. RainLayer         — rain particles + rain tint/dimming
//   8. SnowLayer         — snow particles
//   9. StormLayer        — storm rain + lightning + storm tint/dimming
//  10. WindyLayer        — placeholder (Prompt 3)
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
      <FoggyLayer />
      <PartlyCloudyLayer />
      <OvercastLayer />
      <SunnyLayer />
      <SunnyGlow sunPositionPct={sunPositionPct} />
      <GoldenHourWash />
      <RainLayer />
      <SnowLayer />
      <StormLayer />
      <WindyLayer />
    </div>
  );
}
