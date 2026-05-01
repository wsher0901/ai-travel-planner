import type { SceneryPreset } from '@/components/sky/types';

export function inferScenery(destination: string): SceneryPreset {
  const n = destination.toLowerCase();
  if (/beach|island|coast|bay|reef|lagoon|maldives|bali|hawaii|phuket/.test(n)) return 'beachscape';
  if (/mountain|alps|peak|highland|hokkaido|whistler|queenstown|himalayas/.test(n)) return 'mountainscape';
  return 'cityscape';
}
