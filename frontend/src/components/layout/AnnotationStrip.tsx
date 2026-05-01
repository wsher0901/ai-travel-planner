'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  BarChart3,
  CloudRain,
  PersonStanding,
  Snowflake,
  Sunrise,
  Sunset,
  type LucideProps,
} from 'lucide-react';
import { DAY_MINUTES } from '@/lib/timeAxis';
import { useTripStore } from '@/store/tripStore';
import { useTripWeather } from '@/hooks/useTripWeather';
import { mapToConditionTier } from '@/lib/weather/mapping';
import type { DayWeather, WeatherCondition } from '@/lib/weather/types';

const ICON_SIZE = 22;
const GAP = 5;
// Approximate width of a Sora-10px tabular-nums clock label like "11:00 AM" — used
// only for collision detection so labels don't overlap. ResizeObserver isn't needed;
// the worst case is a one-frame jitter at the boundary which we don't care about.
const LABEL_WIDTH_APPROX = 50;
// Visual overlap threshold: when |static.x − walker.x| < this, walker would crash
// into the static icon (or vice versa) once the right-side time labels are drawn.
const COLLISION_DETECT_PX = ICON_SIZE / 2 + GAP + LABEL_WIDTH_APPROX + ICON_SIZE / 2;
// In side-by-side mode walker stays put with its time flipped to the LEFT, leaving
// only the icon on its right; static icon center sits one icon-width + small gap right.
const SIDE_BY_SIDE_GAP_PX = ICON_SIZE + GAP;
const WALKER_TICK_MS = 300_000;

const SUNRISE_COLOR = '#fbbf24';
const SUNSET_COLOR = '#f97316';
const RAIN_COLOR = '#06b6d4';
const SNOW_COLOR = '#a5b4fc';

interface StaticAnnotation {
  id: string;
  Icon: ComponentType<LucideProps>;
  color: string;
  label: string;
  time: string;
  truePercent: number;
}

function formatClock(date: Date): string {
  const h24 = date.getHours();
  const m = date.getMinutes();
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

function formatHourClock(hour: number): string {
  const h24 = ((hour % 24) + 24) % 24;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:00 ${period}`;
}

function dateMinuteToPercent(d: Date): number {
  return ((d.getHours() * 60 + d.getMinutes()) / DAY_MINUTES) * 100;
}

interface PrecipTransition {
  hour: number;
  mode: 'rain' | 'snow';
}

// Walk hourly entries in order, emitting one transition each time the tier
// flips from non-rain → rain (or non-snow → snow). prevTier=null at hour 0
// means hour-0 rain still counts as a fresh "rain begins" marker.
function detectPrecipTransitions(day: DayWeather): PrecipTransition[] {
  const out: PrecipTransition[] = [];
  const sorted = [...day.hourly].sort((a, b) => a.hour - b.hour);
  let prevTier: WeatherCondition | null = null;
  for (const h of sorted) {
    const tier = mapToConditionTier(h);
    const isRainNow = tier === 'rain' || tier === 'storm';
    const isSnowNow = tier === 'snow';
    const wasRain = prevTier === 'rain' || prevTier === 'storm';
    const wasSnow = prevTier === 'snow';
    if (isRainNow && !wasRain) out.push({ hour: h.hour, mode: 'rain' });
    if (isSnowNow && !wasSnow) out.push({ hour: h.hour, mode: 'snow' });
    prevTier = tier;
  }
  return out;
}

interface Props {
  // Slot date (YYYY-MM-DD). Drives sunrise/sunset and rain transition icons.
  date: string;
}

export default function AnnotationStrip({ date }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const tripId = useTripStore((s) => s.tripPlan?.id ?? null);
  const weather = useTripWeather(tripId);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), WALKER_TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Look up the day directly from the hook's daysData. AnnotationStrip is
  // outside the SceneAtmosphereProvider tree, so we go straight to the hook.
  const dayWeather = weather.daysData.get(date) ?? null;

  // Sunrise/sunset come from real (or mock-synthesized) weather data.
  // Rain/snow transitions detected by walking the hourly tier.
  const annotations: StaticAnnotation[] = useMemo(() => {
    if (!dayWeather) return [];
    const out: StaticAnnotation[] = [];

    const meta = dayWeather.daily;
    const sunrisePct = dateMinuteToPercent(meta.sunrise);
    const sunsetPct = dateMinuteToPercent(meta.sunset);
    out.push({
      id: 'sunrise',
      Icon: Sunrise,
      color: SUNRISE_COLOR,
      label: 'Sunrise',
      time: formatClock(meta.sunrise),
      truePercent: sunrisePct,
    });
    out.push({
      id: 'sunset',
      Icon: Sunset,
      color: SUNSET_COLOR,
      label: 'Sunset',
      time: formatClock(meta.sunset),
      truePercent: sunsetPct,
    });

    const transitions = detectPrecipTransitions(dayWeather);
    for (const t of transitions) {
      out.push({
        id: `${t.mode}-${t.hour}`,
        Icon: t.mode === 'snow' ? Snowflake : CloudRain,
        color: t.mode === 'snow' ? SNOW_COLOR : RAIN_COLOR,
        label: t.mode === 'snow' ? 'Snow begins' : 'Rain begins',
        time: formatHourClock(t.hour),
        truePercent: (t.hour / 24) * 100,
      });
    }
    return out;
  }, [dayWeather]);

  const walkerMinutes = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const walkerPercent = (walkerMinutes / DAY_MINUTES) * 100;

  // Only the chronologically closest static within the threshold gets the
  // side-by-side treatment — keeps the layout unambiguous when walker
  // happens to be near several.
  let collidingStaticId: string | null = null;
  if (now && containerWidth > 0) {
    const walkerPx = (walkerPercent / 100) * containerWidth;
    let closestDist = COLLISION_DETECT_PX;
    for (const a of annotations) {
      const truePx = (a.truePercent / 100) * containerWidth;
      const dist = Math.abs(truePx - walkerPx);
      if (dist < closestDist) {
        closestDist = dist;
        collidingStaticId = a.id;
      }
    }
  }

  const positions = annotations.map((a) => {
    if (a.id === collidingStaticId && containerWidth > 0) {
      const walkerPx = (walkerPercent / 100) * containerWidth;
      const shiftedPx = walkerPx + SIDE_BY_SIDE_GAP_PX;
      return { ...a, displayPercent: (shiftedPx / containerWidth) * 100 };
    }
    return { ...a, displayPercent: a.truePercent };
  });

  const walkerInCollision = collidingStaticId !== null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        zIndex: 10,
      }}
    >
      {positions.map((a) => (
        <AnnotationIcon
          key={a.id}
          Icon={a.Icon}
          displayPercent={a.displayPercent}
          color={a.color}
          label={a.label}
          time={a.time}
          labelSide="right"
          isHovered={hoveredId === a.id}
          onHoverStart={() => setHoveredId(a.id)}
          onHoverEnd={() => setHoveredId((prev) => (prev === a.id ? null : prev))}
          zIndex={2}
        />
      ))}

      {now && (
        <AnnotationIcon
          Icon={PersonStanding}
          displayPercent={walkerPercent}
          color="rgba(255,255,255,0.85)"
          label="Now"
          time={formatClock(now)}
          labelSide={walkerInCollision ? 'left' : 'right'}
          isHovered={hoveredId === 'walker'}
          onHoverStart={() => setHoveredId('walker')}
          onHoverEnd={() => setHoveredId((prev) => (prev === 'walker' ? null : prev))}
          zIndex={3}
        />
      )}
      <WeatherSourceIndicator />
    </div>
  );
}

// Subtle indicator reflecting the weather data class for the active trip.
// Three states:
//   - forecast      → renders nothing (default, no clutter)
//   - estimate      → BarChart3 + "estimate" label, climate-fallback
//   - unavailable   → AlertCircle + "unavailable", both APIs failed OR
//                     frontend fetch failed entirely
function WeatherSourceIndicator() {
  const tripId = useTripStore((s) => s.tripPlan?.id ?? null);
  const { source, isUnavailable, isEstimate, isMockFallback } = useTripWeather(tripId);

  if (source === 'forecast') return null;

  const showUnavailable = isUnavailable || isMockFallback;
  const showEstimate = isEstimate && !showUnavailable;
  if (!showEstimate && !showUnavailable) return null;

  const Icon = showEstimate ? BarChart3 : AlertCircle;
  const label = showEstimate ? 'estimate' : 'unavailable';
  const tooltip = showEstimate
    ? 'Based on historical averages — actual weather may vary'
    : 'Weather data unavailable for this date';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        bottom: 2,
        right: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        pointerEvents: 'none',
        fontFamily: 'var(--font-sora)',
        fontSize: 9,
        letterSpacing: '0.04em',
        color: 'rgba(255,255,255,0.4)',
        zIndex: 4,
      }}
      title={tooltip}
    >
      <Icon size={10} strokeWidth={2} />
      <span>{label}</span>
    </motion.div>
  );
}

interface IconProps {
  Icon: ComponentType<LucideProps>;
  displayPercent: number;
  color: string;
  label: string;
  time: string;
  labelSide: 'left' | 'right';
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  zIndex: number;
}

function AnnotationIcon({
  Icon,
  displayPercent,
  color,
  label,
  time,
  labelSide,
  isHovered,
  onHoverStart,
  onHoverEnd,
  zIndex,
}: IconProps) {
  const labelStyle: CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    fontFamily: 'var(--font-sora)',
    fontSize: 10,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.02em',
    color,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    ...(labelSide === 'left'
      ? { right: '100%', marginRight: GAP }
      : { left: '100%', marginLeft: GAP }),
  };

  return (
    <motion.div
      initial={false}
      animate={{ left: `${displayPercent}%` }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      style={{
        position: 'absolute',
        top: '50%',
        x: -ICON_SIZE / 2,
        y: -ICON_SIZE / 2,
        width: ICON_SIZE,
        height: ICON_SIZE,
        zIndex: isHovered ? 100 : zIndex,
      }}
    >
      <Icon size={ICON_SIZE} strokeWidth={2} color={color} />
      <span style={labelStyle}>{time}</span>
      {isHovered && (
        <div
          style={{
            position: 'absolute',
            left: ICON_SIZE / 2,
            top: 0,
            transform: 'translate(-50%, calc(-100% - 6px))',
            background: 'rgba(12,15,22,0.96)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(6,182,212,0.2)',
            borderRadius: 4,
            padding: '6px 10px',
            fontFamily: 'var(--font-sora)',
            fontSize: 11,
            lineHeight: 1,
            color: 'rgba(255,255,255,0.9)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 50,
          }}
        >
          {label} · {time}
        </div>
      )}
    </motion.div>
  );
}
