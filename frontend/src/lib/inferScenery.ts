import type { SceneryPreset } from '@/components/sky/types';

export function inferScenery(destination: string): SceneryPreset {
  const n = destination.toLowerCase();
  if (/beach|island|coast|bay|reef|lagoon|maldives|bali|hawaii|phuket/.test(n)) return 'oceanscape';
  if (/mountain|alps|peak|highland|hokkaido|whistler|queenstown|himalayas/.test(n)) return 'mountainscape';
  if (/forest|jungle|rainforest|amazon|borneo|costa rica/.test(n)) return 'forestscape';
  if (/plains|prairie|savanna|desert|serengeti|patagonia|sahara/.test(n)) return 'plains';
  return 'cityscape';
}
