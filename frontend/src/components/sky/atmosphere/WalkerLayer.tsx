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

  // Fixed figure geometry — do NOT recompute analytically.
  // ViewBox 0 0 36 36. Head at (18,5) r=4. Shoulder (18,9). Hip (18,22).
  const S = 'rgba(255,255,255,0.78)';

  // Line helper — all limbs share these stroke attributes.
  const L = (x1: number, y1: number, x2: number, y2: number) => (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={S} strokeWidth={1.4} strokeLinecap="round"
    />
  );

  const Head  = <circle cx={18} cy={5} r={4} fill={S} />;
  const Torso = L(18, 9, 18, 22);

  const poseAnim = (name: string) => ({
    animation: `${name} 1.4s step-end infinite`,
  });

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        bottom: 0,
        left: `${xPercent}%`,
        transform: 'translateX(-50%)',
        width: 36,
        height: 36,
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

      {/* Three-pose walking cycle — hard cuts via step-end timing: only one pose visible at a time.
          Cycle: Max(0-25%) → Half(25-50%) → Neutral(50-75%) → Half(75-100%) → loop @ 1.4s.
          No translateX/translateY on any wrapper — horizontal position is xPercent only. */}
      <svg
        width="36"
        height="36"
        viewBox="0 0 36 36"
        fill="none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          zIndex: 1,
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
        }}
      >
        {/* PoseMax — full stride: arms ±6x/+6y, legs ±8x/+10y from pivots */}
        <g style={poseAnim('walkerPoseMax')}>
          {Head}
          {Torso}
          {L(18, 9,  24, 15)}  {/* forward arm */}
          {L(18, 9,  12, 15)}  {/* back arm */}
          {L(18, 22, 26, 32)}  {/* forward leg */}
          {L(18, 22, 10, 32)}  {/* back leg */}
        </g>

        {/* PoseHalf — half stride: arms ±3x/+7y, legs ±4x/+10.5y from pivots */}
        <g style={poseAnim('walkerPoseHalf')}>
          {Head}
          {Torso}
          {L(18, 9,  21, 16)}    {/* forward arm */}
          {L(18, 9,  15, 16)}    {/* back arm */}
          {L(18, 22, 22, 32.5)}  {/* forward leg */}
          {L(18, 22, 14, 32.5)}  {/* back leg */}
        </g>

        {/* PoseNeutral — legs together, arms slightly forward (+1x/+8y).
            Both arms and both legs each stack two identical lines so visual
            weight reads consistent — no sudden thinning at neutral. */}
        <g style={poseAnim('walkerPoseNeutral')}>
          {Head}
          {Torso}
          {L(18, 9,  19, 17)}  {/* arm 1 (stacked) */}
          {L(18, 9,  19, 17)}  {/* arm 2 (stacked) */}
          {L(18, 22, 18, 33)}  {/* leg 1 (stacked) */}
          {L(18, 22, 18, 33)}  {/* leg 2 (stacked) */}
        </g>
      </svg>
    </div>
  );
}
