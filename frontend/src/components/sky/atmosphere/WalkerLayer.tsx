'use client';
import type { WalkerPreset } from '@/components/sky/types';

interface Props {
  xPercent: number | null;
  preset: WalkerPreset;
}

// Walker sits between Layer 2b (scenery) and Layer 3b (rain/snow particles)
// so precipitation falls visually in front of the character.
// No internal timer — xPercent is the single time-driven input, derived from
// SkyStrip's currentMinute so timezone handling stays in one place.
export default function WalkerLayer({ xPercent, preset }: Props) {
  if (xPercent === null || preset === 'none') return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: '50%',
        left: `${xPercent}%`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 0, // stacking within WeatherLayer managed by DOM order
      }}
    >
      {/* Pulsing ambient ring */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 26,
          height: 26,
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(245,158,11,0.28) 0%, transparent 70%)',
          animation: 'travelerRingPulse 2s ease-in-out infinite',
        }}
      />
      {/* Silhouette with bob */}
      <div
        style={{
          position: 'relative',
          transformOrigin: 'center bottom',
          animation: 'travelerSway 1.4s ease-in-out infinite',
          filter: 'drop-shadow(0 0 5px rgba(245,158,11,0.65))',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="5" r="2.5" />
          <path d="M9 22l1-7 2-3 2 3 1 7" />
          <path d="M10 15l-3-3" />
          <path d="M14 15l3-4" />
        </svg>
      </div>
    </div>
  );
}
