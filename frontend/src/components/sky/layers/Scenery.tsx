'use client';
import { useId, useMemo } from 'react';
import { type SceneryPreset } from '../types';

function mulberry32(a: number) {
  return (): number => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CITY_PATH =
  'M 0 200 L 0 175' +
  ' L 60 175 L 60 158 L 100 158 L 100 175' +
  ' L 140 175 L 140 145 L 175 145 L 175 130 L 195 130 L 195 145 L 220 145 L 220 175' +
  ' L 280 175 L 280 152 L 320 152 L 320 138 L 350 138 L 350 152 L 390 152 L 390 175' +
  ' L 450 175 L 450 162 L 490 162 L 490 175' +
  ' L 540 175 L 540 140 L 575 140 L 575 125 L 610 125 L 610 140 L 645 140 L 645 175' +
  ' L 700 175 L 700 158 L 740 158 L 740 175' +
  ' L 790 175 L 790 148 L 830 148 L 830 132 L 865 132 L 865 148 L 900 148 L 900 175' +
  ' L 950 175 L 950 165 L 1000 165 L 1000 200 Z';

interface Props { preset: SceneryPreset; }

export default function Scenery({ preset }: Props) {
  const uid = useId().replace(/:/g, '');
  const clipId = `city-${uid}`;

  const windowLights = useMemo(() => {
    if (preset !== 'cityscape') return [];
    const rand = mulberry32(0xCA1C1A7E);
    const pts: [number, number][] = [];
    for (let i = 0; i < 160; i++) {
      pts.push([rand() * 1000, rand() * 60 + 130]);
    }
    return pts;
  }, [preset]);

  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        zIndex: 8,
        pointerEvents: 'none',
      }}
      viewBox="0 0 1000 200"
      preserveAspectRatio="none"
    >
      {preset === 'mountainscape' && (
        <>
          <path
            d="M 0 200 L 0 165 Q 80 145 160 158 T 320 152 Q 410 138 500 148 T 700 142 Q 820 155 920 150 L 1000 158 L 1000 200 Z"
            fill="#1a2030" opacity="0.78"
          />
          <path
            d="M 0 200 L 0 178 Q 100 168 200 174 T 400 170 Q 540 162 680 172 T 900 168 L 1000 175 L 1000 200 Z"
            fill="#0f1420" opacity="0.6"
          />
        </>
      )}

      {preset === 'cityscape' && (
        <>
          <defs>
            <clipPath id={clipId}>
              <path d={CITY_PATH} />
            </clipPath>
          </defs>
          <path d={CITY_PATH} fill="#0e1420" opacity="0.85" />
          <g clipPath={`url(#${clipId})`}>
            {windowLights.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={0.6} fill="#FFD56B" opacity="0.5" />
            ))}
          </g>
        </>
      )}

      {preset === 'oceanscape' && (
        <>
          <path
            d="M 0 200 L 0 188 Q 100 184 200 188 T 400 188 Q 550 184 700 188 T 900 188 L 1000 188 L 1000 200 Z"
            fill="#0a1828" opacity="0.7"
          />
          <path
            d="M 0 200 L 0 195 Q 150 193 300 195 T 600 195 Q 800 193 1000 195 L 1000 200 Z"
            fill="#152838" opacity="0.5"
          />
        </>
      )}

      {preset === 'forestscape' && (
        <path
          d="M 0 200 L 0 158 Q 20 148 40 154 Q 60 138 80 148 Q 100 132 120 142 Q 145 122 165 135 Q 190 118 210 130 Q 235 120 260 128 Q 285 112 310 124 Q 335 130 355 120 Q 380 110 405 122 Q 430 128 450 118 Q 475 108 500 120 Q 525 128 545 118 Q 570 110 590 120 Q 615 128 635 118 Q 660 110 685 120 Q 710 128 730 118 Q 755 108 780 120 Q 805 130 825 120 Q 850 112 875 122 Q 900 132 920 122 Q 945 115 970 124 L 1000 128 L 1000 200 Z"
          fill="#0d1a14" opacity="0.82"
        />
      )}

      {preset === 'plains' && (
        <path
          d="M 0 200 L 0 185 Q 250 182 500 184 T 1000 183 L 1000 200 Z"
          fill="#1a2030" opacity="0.65"
        />
      )}
    </svg>
  );
}
