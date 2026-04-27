'use client';

// top values are percentages of the strip height, not raw pixels
const STARS = [
  { left: 3, top: 22, big: false, delay: 0.2, opacity: 1 },
  { left: 8, top: 40, big: true, delay: 0.6, opacity: 1 },
  { left: 13, top: 20, big: false, delay: 1.1, opacity: 1 },
  { left: 18, top: 48, big: false, delay: 0.3, opacity: 0.6 },
  { left: 93, top: 22, big: true, delay: 0, opacity: 1 },
  { left: 96, top: 40, big: false, delay: 0.7, opacity: 1 },
  { left: 98, top: 28, big: false, delay: 1.2, opacity: 1 },
];

export default function Stars() {
  return (
    <>
      {STARS.map((s, i) => {
        const size = s.big ? 3 : 2;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: size, height: size,
            background: '#fff',
            borderRadius: '50%',
            boxShadow: s.big ? '0 0 5px #fff' : '0 0 3px #fff',
            animation: 'skyTwinkle 2.5s ease-in-out infinite',
            animationDelay: `${s.delay}s`,
            opacity: s.opacity,
            zIndex: 2,
            pointerEvents: 'none',
          }} />
        );
      })}
    </>
  );
}
