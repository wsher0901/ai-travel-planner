'use client';
import { type SceneryPreset } from '../types';
import MountainScene from './MountainScene';
import CityScene from './CityScene';
import BeachScene from './BeachScene';
import DesertScene from './DesertScene';
import ForestScene from './ForestScene';

interface Props {
  preset: SceneryPreset;
}

export default function Scenery({ preset }: Props) {
  if (preset === 'mountainscape') return <MountainScene />;
  if (preset === 'cityscape') return <CityScene />;
  if (preset === 'beachscape') return <BeachScene />;
  if (preset === 'desertscape') return <DesertScene />;
  if (preset === 'forestscape') return <ForestScene />;
  // TypeScript exhaustiveness — unreachable for valid SceneryPreset values
  const _: never = preset;
  void _;
  return null;
}
