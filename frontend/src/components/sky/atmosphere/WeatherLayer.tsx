'use client';
import FoggyLayer from './conditions/FoggyLayer';
import PartlyCloudyLayer from './conditions/PartlyCloudyLayer';
import OvercastLayer from './conditions/OvercastLayer';
import SunnyLayer from './conditions/SunnyLayer';
import RainLayer from './conditions/RainLayer';
import SnowLayer from './conditions/SnowLayer';
import StormLayer from './conditions/StormLayer';
import WindyLayer from './conditions/WindyLayer';

// Layer 3: weather. Sits above Layer 1 (diorama) and Layer 2 (landscape).
// pointer-events:none — never blocks interactions.
//
// Render order (back → front):
//   1. FoggyLayer        — fog tint/dimming wash (ambient only)
//   2. PartlyCloudyLayer — partly-cloudy tint wash (ambient only)
//   3. OvercastLayer     — overcast tint/dimming wash (ambient only)
//   4. SunnyLayer        — sunny warm wash (ambient only)
//   5. RainLayer         — rain particles + rain tint/dimming
//   6. SnowLayer         — snow particles
//   7. StormLayer        — storm rain + lightning + gust spikes
//   8. WindyLayer        — placeholder (parked to weather panel)
export default function WeatherLayer() {
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
      <RainLayer />
      <SnowLayer />
      <StormLayer />
      <WindyLayer />
    </div>
  );
}
