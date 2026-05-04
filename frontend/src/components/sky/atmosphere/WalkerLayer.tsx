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

  // Shared SVG props — three poses stack absolutely inside a 18×36 wrapper.
  // Motion is purely opacity crossfade via walkerPoseA/B/C keyframes; no translateX
  // or translateY anywhere in the walker render path.
  const poseSvgStyle = (animName: string) => ({
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    animation: `${animName} 1.2s linear infinite`,
  });

  // Head is identical across all poses.
  const head = <circle cx="10" cy="4" r="3" />;

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
      {/* Pulsing ambient ring — behind silhouette via zIndex.
          No inline transform: travelerRingPulse bakes translate(-50%,-50%) into
          both keyframe stops, so centering is guaranteed for the animation duration. */}
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

      {/* Three-pose walking cycle. Poses crossfade A→B→C via opacity keyframes.
          All three SVGs are stacked at bottom:0/left:0 inside a fixed 18×36 box. */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          marginLeft: -9,
          width: 18,
          height: 36,
          zIndex: 1,
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
        }}
      >
        {/* WalkerPoseA: right arm forward (high-right), left leg forward, right leg back */}
        <svg
          width="18"
          height="36"
          viewBox="0 0 18 36"
          fill="rgba(255,255,255,0.78)"
          style={poseSvgStyle('walkerPoseA')}
        >
          {head}
          <path d="M12,7.5 L15,9 L16.5,14 L15,15.5 L13.5,13 L13.5,21 L15.5,28 L17,35 L15,36 L13.5,35 L12.5,28 L10.5,22 L8,28 L6,34 L4,34 L5.5,27.5 L7,21 L7,15 L5,17.5 L6.5,19 L7.5,16 L8,7.5 Z" />
        </svg>

        {/* WalkerPoseB: arms vertical (mid-swing), legs nearly together (mid-stride) */}
        <svg
          width="18"
          height="36"
          viewBox="0 0 18 36"
          fill="rgba(255,255,255,0.78)"
          style={poseSvgStyle('walkerPoseB')}
        >
          {head}
          <path d="M12,7.5 L14,9 L14.5,15.5 L13.5,17 L12.5,15 L12.5,21 L13.5,28 L14,35 L12,36 L11,35 L10.5,28 L9.5,22 L8.5,28 L8,35 L6,35 L7,28 L7.5,21 L7,15 L5.5,16 L7,17 L7.5,15.5 L8,7.5 Z" />
        </svg>

        {/* WalkerPoseC: right arm back, left arm forward (near body-front), right leg forward, left leg back */}
        <svg
          width="18"
          height="36"
          viewBox="0 0 18 36"
          fill="rgba(255,255,255,0.78)"
          style={poseSvgStyle('walkerPoseC')}
        >
          {head}
          <path d="M12,7.5 L13.5,9 L14.5,15 L13.5,16.5 L12.5,14 L13.5,21 L15.5,28 L17,35 L15,36 L13.5,35 L12.5,28 L10.5,22 L8,28 L6,34 L4,34 L5.5,27.5 L7,21 L6.5,14.5 L9,12 L8.5,10.5 L7.5,13.5 L8,7.5 Z" />
        </svg>
      </div>
    </div>
  );
}
