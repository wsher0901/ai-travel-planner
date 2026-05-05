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
  walkerXPercent: number | null;
  walkerPreset: WalkerPreset;
}

// Layer 3: weather. Sits above Layer 1 (diorama) and Layer 2 (landscape).
// pointer-events:none — never blocks interactions.
//
// After the cleanup pass, all sun-anchored / cloud-shape / band geometry was
// dropped — the four ambient tiers (sunny / partly-cloudy / overcast / foggy)
// render only horizontal tint/wash overlays. Particle layers (rain / snow /
// storm) remain intact.
//
// Render order (back → front):
//   1. FoggyLayer        — fog tint/dimming wash (ambient only)
//   2. PartlyCloudyLayer — partly-cloudy tint wash (ambient only)
//   3. OvercastLayer     — overcast tint/dimming wash (ambient only)
//   4. SunnyLayer        — sunny warm wash (ambient only)
//   5. GoldenHourWash    — horizontal golden-hour wash (sunny/partly-cloudy)
//   6. WalkerLayer       — "now" figure; above scenery, below precipitation
//   7. RainLayer         — rain particles + rain tint/dimming
//   8. SnowLayer         — snow particles
//   9. StormLayer        — storm rain + lightning + gust spikes
//  10. WindyLayer        — placeholder (parked to weather panel)
export default function WeatherLayer({ walkerXPercent, walkerPreset }: Props) {
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
