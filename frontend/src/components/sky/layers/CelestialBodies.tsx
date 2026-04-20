'use client';
import { type SunTimes, minToPercent } from '@/lib/sunPosition';
import Sun from '../assets/Sun';
import Moon from '../assets/Moon';

interface Props { sunTimes: SunTimes; }

export default function CelestialBodies({ sunTimes }: Props) {
  const { sunriseMin, sunsetMin, solarNoonMin } = sunTimes;
  const risePct = minToPercent(sunriseMin);
  const setPct = minToPercent(sunsetMin);
  const noonPct = minToPercent(solarNoonMin);
  const morningPct = risePct + (noonPct - risePct) * 0.5;
  const afternoonPct = noonPct + (setPct - noonPct) * 0.5;

  return (
    <>
      <Moon leftPercent={4} topPx={28} size={38} />
      <Sun leftPercent={risePct} size={64} variant="rising" />
      <Sun leftPercent={morningPct} topPx={56} size={40} variant="full" />
      <Sun leftPercent={noonPct} topPx={18} size={48} variant="full" />
      <Sun leftPercent={afternoonPct} topPx={54} size={42} variant="full" />
      <Sun leftPercent={setPct} size={68} variant="setting" />
      <Moon leftPercent={92} topPx={78} size={32} opacity={0.78} />
    </>
  );
}
