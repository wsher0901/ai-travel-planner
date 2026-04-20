'use client';
import { type SceneryPreset } from '../types';

const CLIP_PATHS: Record<SceneryPreset, string> = {
  mountainscape: 'polygon(0 100%, 3% 75%, 7% 88%, 11% 62%, 16% 82%, 22% 48%, 28% 72%, 34% 55%, 40% 70%, 46% 38%, 52% 58%, 58% 42%, 64% 65%, 70% 32%, 76% 55%, 82% 42%, 88% 68%, 94% 52%, 100% 78%, 100% 100%)',
  cityscape: 'polygon(0 100%, 4% 70%, 4% 50%, 10% 50%, 10% 65%, 16% 65%, 16% 40%, 22% 40%, 22% 60%, 28% 60%, 28% 30%, 36% 30%, 36% 55%, 44% 55%, 44% 45%, 52% 45%, 52% 60%, 60% 60%, 60% 35%, 68% 35%, 68% 55%, 76% 55%, 76% 50%, 84% 50%, 84% 65%, 92% 65%, 92% 45%, 100% 45%, 100% 100%)',
  oceanscape: 'polygon(0 100%, 0 85%, 10% 88%, 20% 85%, 30% 88%, 40% 86%, 50% 89%, 60% 86%, 70% 88%, 80% 85%, 90% 88%, 100% 85%, 100% 100%)',
  plains: 'polygon(0 100%, 0 80%, 8% 82%, 14% 75%, 20% 80%, 28% 78%, 36% 82%, 44% 76%, 52% 80%, 60% 78%, 68% 82%, 76% 76%, 84% 80%, 92% 78%, 100% 82%, 100% 100%)',
};

interface Props { preset: SceneryPreset; }

export default function Scenery({ preset }: Props) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: 0, right: 0,
      height: 30,
      zIndex: 8,
      background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 100%)',
      clipPath: CLIP_PATHS[preset],
    }} />
  );
}
