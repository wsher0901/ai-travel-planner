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
        bottom: 0,
        left: `${xPercent}%`,
        transform: 'translateX(-50%)',
        width: 44,
        height: 44,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* Pulsing ambient ring — behind silhouette via zIndex */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,158,11,0.28) 0%, transparent 70%)',
          animation: 'travelerRingPulse 2s ease-in-out infinite',
          zIndex: 0,
        }}
      />
      {/* Side-view walking silhouette */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          marginLeft: -9,
          zIndex: 1,
          animation: 'travelerSway 1s ease-in-out infinite',
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
        }}
      >
        <svg
          width="18"
          height="36"
          viewBox="0 0 18 36"
          fill="rgba(255,255,255,0.78)"
        >
          {/* Head */}
          <circle cx="11" cy="4" r="3.5" />
          {/* Body: torso, front arm (forward), front leg, back leg, back arm (backward) */}
          <path d="M13.5,8 L15.5,13 L14,14.5 L12.5,12 L13.5,20 L15.5,27 L17,35 L15,36 L13.5,35 L12.5,27 L10.5,22 L8.5,27 L7,34 L5,34 L6.5,27 L7.5,20 L7,14 L5.5,17.5 L7,18.5 L7.5,13.5 L8,8 Z" />
        </svg>
      </div>
    </div>
  );
}
