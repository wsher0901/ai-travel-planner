'use client';
import { useMemo, useId } from 'react';
import { useSceneWeather } from '../SceneAtmosphere';
import { buildWhiteMaskGradient } from '../maskUtils';
import type { SceneAtmosphere } from '@/lib/weather/types';

// Sunny-tier ambient overlay = warm wash + 5 parallel sunbeam ray sheets.
// The rays read as soft volumetric beams (per the user reference image),
// NOT as a halo or radial fan from the sun position. They're authored as
// parallelograms tilted ~75° from horizontal (i.e. 15° off vertical) and
// blurred for soft edges. CelestialBodies remains the canonical sun disc.

const VIEWBOX_W = 100;
const VIEWBOX_H = 100;

// 5 ray strips, ~75° from horizontal, downward-right. Each strip:
//   width  ≈ 4 vb-x units (4% of strip width)
//   slant  ≈ 5.4 vb-x units of horizontal drift over full vb-y height
//            (matches a 75° rendered angle on a typical 5:1 strip)
// Spacing center-to-center ≈ 11 vb-x → 7 vb-x gap, 4 vb-x width.
interface RaySpec {
  x: number;     // top-left corner x (viewBox units)
  width: number; // horizontal width at top (viewBox units)
}

const RAY_SLANT = 5.4;
const RAY_WIDTH = 4;
const RAY_TOP_Y = 0;
const RAY_BOTTOM_Y = VIEWBOX_H;

const RAYS: ReadonlyArray<RaySpec> = [
  { x: 24, width: RAY_WIDTH },
  { x: 35, width: RAY_WIDTH },
  { x: 46, width: RAY_WIDTH },
  { x: 57, width: RAY_WIDTH },
  { x: 68, width: RAY_WIDTH },
];

function rayPath(spec: RaySpec): string {
  const xTopLeft = spec.x;
  const xTopRight = spec.x + spec.width;
  const xBotLeft = xTopLeft + RAY_SLANT;
  const xBotRight = xTopRight + RAY_SLANT;
  return `M ${xTopLeft} ${RAY_TOP_Y} L ${xTopRight} ${RAY_TOP_Y} L ${xBotRight} ${RAY_BOTTOM_Y} L ${xBotLeft} ${RAY_BOTTOM_Y} Z`;
}

function isSunnyDaylight(atmo: SceneAtmosphere): boolean {
  return atmo.conditionTier === 'sunny' && atmo.sunVisible;
}

export default function SunnyLayer() {
  const { samples48 } = useSceneWeather();
  const uid = useId().replace(/:/g, '-');
  const gradId = `sunny-ray-grad-${uid}`;
  const blurId = `sunny-ray-blur-${uid}`;

  const maskImage = useMemo(() => {
    const any = samples48.some(isSunnyDaylight);
    return any ? buildWhiteMaskGradient(samples48, isSunnyDaylight) : null;
  }, [samples48]);

  if (!maskImage) return null;

  return (
    <>
      {/* (a) Warm wash — vertical CSS gradient masked by sunny daylight regions. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(to bottom, rgba(255,224,130,0.06) 0%, rgba(255,192,100,0.10) 100%)',
          maskImage,
          WebkitMaskImage: maskImage,
        }}
      />

      {/* (b) Parallel sunbeam rays — 5 diagonal strips at ~75°.
          Soft edges via feGaussianBlur; vertical gradient fades each ray
          from top (warm visible) to bottom (transparent at the ground). */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          maskImage,
          WebkitMaskImage: maskImage,
        }}
      >
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(255,224,130,0.20)" />
              <stop offset="100%" stopColor="rgba(255,224,130,0)" />
            </linearGradient>
            <filter id={blurId} x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="1.5" />
            </filter>
          </defs>
          <g filter={`url(#${blurId})`}>
            {RAYS.map((spec, i) => (
              <path
                key={i}
                d={rayPath(spec)}
                fill={`url(#${gradId})`}
              />
            ))}
          </g>
        </svg>
      </div>
    </>
  );
}
