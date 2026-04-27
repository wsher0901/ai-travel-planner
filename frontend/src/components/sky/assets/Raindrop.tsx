'use client';

interface Props {
  leftPercent: number;
  delay?: number;
  speed?: number;
  /** Vertical offset from cloud base in px; defaults to 0 */
  topPx?: number;
  /** Width of the drop in px; defaults to 1 */
  size?: number;
}

export default function Raindrop({ leftPercent, delay = 0, speed = 0.9, topPx = 0, size = 1 }: Props) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: `${leftPercent}%`,
        top: topPx,
        width: size,
        height: size * 11,
        background: 'linear-gradient(180deg, transparent, rgba(185,215,255,0.95))',
        animation: `skyFall ${speed}s linear infinite`,
        animationDelay: `${delay}s`,
        pointerEvents: 'none',
        willChange: 'transform',
      }}
    />
  );
}
