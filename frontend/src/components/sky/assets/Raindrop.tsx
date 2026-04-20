'use client';

interface Props {
  leftPercent: number;
  delay?: number;
  speed?: number;
}

export default function Raindrop({ leftPercent, delay = 0, speed = 0.9 }: Props) {
  return (
    <div style={{
      position: 'absolute',
      left: `${leftPercent}%`,
      top: 0,
      width: 1,
      height: 11,
      background: 'linear-gradient(180deg, transparent, rgba(185,215,255,0.95))',
      animation: `skyFall ${speed}s linear infinite`,
      animationDelay: `${delay}s`,
      pointerEvents: 'none',
    }} />
  );
}
