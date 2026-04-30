'use client';

import { useMemo, useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, BedDouble, UtensilsCrossed, Landmark, Ticket,
  Mountain, Martini, ShoppingBag, Flower2, TreePine,
  type LucideIcon
} from 'lucide-react';
import { type PlanItem, useTripStore } from '@/store/tripStore';
import { getActivityColor } from '@/lib/activityColors';
import SkyStrip from '@/components/sky/SkyStrip';
import { TimeLabelsStrip } from '@/components/sky/TimeLabelsStrip';
import { type WeatherSegment } from '@/components/sky/types';
import { getIsToday } from '@/lib/sunPosition';
import { inferScenery } from '@/lib/inferScenery';
import type { SceneryPreset } from '@/components/sky/types';
import { useUIStore } from '@/store/uiStore';

const TYPE_ICONS: Record<string, LucideIcon> = {
  transport: Plane,
  accommodation: BedDouble,
  food: UtensilsCrossed,
  sightseeing: Landmark,
  entertainment: Ticket,
  outdoor: Mountain,
  nightlife: Martini,
  shopping: ShoppingBag,
  wellness: Flower2,
  nature: TreePine,
};

interface Props {
  selectedDate: string | null;
  planItems: PlanItem[];
}

const DAY_MINUTES = 1440;

// Stubbed multi-day weather patterns — cycled by trip-day index until the real
// Open-Meteo wiring lands. Each pattern is an array of WeatherSegments covering
// 0-24h. Codes follow Open-Meteo WMO convention.
const STUB_WEATHER_PATTERNS: WeatherSegment[][] = [
  // Pattern 0 — Sunny all day
  [{ startHour: 0, endHour: 24, wmoCode: 1, tempC: 22, precipMm: 0, cloudCover: 10 }],
  // Pattern 1 — Clear morning, partly cloudy afternoon, overcast evening
  [
    { startHour: 0,  endHour: 12, wmoCode: 1, tempC: 18, precipMm: 0, cloudCover: 15 },
    { startHour: 12, endHour: 18, wmoCode: 2, tempC: 22, precipMm: 0, cloudCover: 45 },
    { startHour: 18, endHour: 24, wmoCode: 3, tempC: 19, precipMm: 0, cloudCover: 70 },
  ],
  // Pattern 2 — Rainy afternoon
  [
    { startHour: 0,  endHour: 10, wmoCode: 3,  tempC: 14, precipMm: 0, cloudCover: 80 },
    { startHour: 10, endHour: 16, wmoCode: 63, tempC: 13, precipMm: 4, cloudCover: 95 },
    { startHour: 16, endHour: 20, wmoCode: 61, tempC: 14, precipMm: 1, cloudCover: 85 },
    { startHour: 20, endHour: 24, wmoCode: 3,  tempC: 12, precipMm: 0, cloudCover: 75 },
  ],
  // Pattern 3 — Stormy evening
  [
    { startHour: 0,  endHour: 14, wmoCode: 2,  tempC: 24, precipMm: 0, cloudCover: 35 },
    { startHour: 14, endHour: 18, wmoCode: 3,  tempC: 23, precipMm: 0, cloudCover: 75 },
    { startHour: 18, endHour: 22, wmoCode: 95, tempC: 21, precipMm: 8, cloudCover: 95 },
    { startHour: 22, endHour: 24, wmoCode: 61, tempC: 18, precipMm: 1, cloudCover: 80 },
  ],
];


function timeToMin(t: string): number {
  if (!t || !t.includes(':')) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatDuration(totalMin: number): string {
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function DayPulseOverview({ selectedDate, planItems }: Props) {
  const hoverExpandedId = useUIStore((s) => s.hoverExpandedId);
  const lockedExpandedIds = useUIStore((s) => s.lockedExpandedIds);
  const suppressHoverUntilLeaveId = useUIStore((s) => s.suppressHoverUntilLeaveId);
  const setHoverExpandedId = useUIStore((s) => s.setHoverExpandedId);
  const dateChangeDirection = useUIStore((s) => s.dateChangeDirection);
  const tripPlan = useTripStore((s) => s.tripPlan);
  const recentlyAddedIds = useTripStore((s) => s.recentlyAddedIds);

  const [peekItem, setPeekItem] = useState<{
    item: PlanItem;
    leftPercent: number;
  } | null>(null);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [peekRect, setPeekRect] = useState<{ pillCenterX: number; pillTopY: number } | null>(null);

  const schedulePeek = useCallback((item: PlanItem, pillEl: HTMLElement) => {
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    peekTimerRef.current = setTimeout(() => {
      const rect = pillEl.getBoundingClientRect();
      setPeekRect({
        pillCenterX: rect.left + rect.width / 2,
        pillTopY: rect.top,
      });
      setPeekItem({ item, leftPercent: 0 });
    }, 200);
  }, []);

  const cancelPeek = useCallback(() => {
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    setPeekItem(null);
    setPeekRect(null);
  }, []);

  const LAT = tripPlan?.destination_latitude ?? 34.0522;
  const LNG = tripPlan?.destination_longitude ?? -118.2437;
  const TIMEZONE = tripPlan?.destination_timezone ?? 'America/Los_Angeles';

  // Per-slot lookup so the outgoing day keeps its own weather during the slide
  // animation (otherwise both slots would show the incoming day's pattern).
  // Returns one of STUB_WEATHER_PATTERNS' module-scope arrays, so the reference
  // is stable across calls with the same date — preserves WeatherLayers memos.
  const tripStartDateForWeather = tripPlan?.start_date;
  const getWeatherForDate = useCallback((date: string | null): WeatherSegment[] => {
    if (!date || !tripStartDateForWeather) return STUB_WEATHER_PATTERNS[0];
    const start = new Date(tripStartDateForWeather + 'T00:00:00');
    const current = new Date(date + 'T00:00:00');
    const dayIndex = Math.max(
      0,
      Math.round((current.getTime() - start.getTime()) / 86_400_000),
    );
    return STUB_WEATHER_PATTERNS[dayIndex % STUB_WEATHER_PATTERNS.length];
  }, [tripStartDateForWeather]);

  const isToday = useMemo(
    () => (selectedDate ? getIsToday(selectedDate, TIMEZONE) : false),
    [selectedDate, TIMEZONE]
  );

  const tripStartDate = tripPlan?.start_date;
  const tripEndDate = tripPlan?.end_date;
  const tripDays = useMemo(() => {
    if (!tripStartDate || !tripEndDate) {
      return [];
    }
    const start = new Date(tripStartDate + 'T00:00:00');
    const end = new Date(tripEndDate + 'T00:00:00');
    const days: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      days.push(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [tripStartDate, tripEndDate]);

  const rawScenery = useTripStore((s) => s.tripPlan?.destination_scenery);
  const destination = useTripStore((s) => s.tripPlan?.destination ?? '');
  // TODO TEMP: hardcoded for forestscape visual testing — revert after verification.
  // Revert to `rawScenery ?? inferScenery(destination)` (or 'cityscape') after review.
  const scenery: SceneryPreset = 'mountainscape';

  const outerRef = useRef<HTMLDivElement>(null);
  const skyViewportRef = useRef<HTMLDivElement>(null);
  const [skyViewportWidth, setSkyViewportWidth] = useState(0);
  const [aspectScale, setAspectScale] = useState(1);

  type AnimState =
    | { kind: 'idle'; current: string | null }
    | { kind: 'animating'; outgoing: string; incoming: string; direction: 1 | -1 };

  const [animState, setAnimState] = useState<AnimState>({ kind: 'idle', current: selectedDate });
  const prevDateRef = useRef<string | null>(selectedDate);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (!selectedDate) return;

    const measure = () => {
      if (skyViewportRef.current) {
        const w = skyViewportRef.current.offsetWidth;
        const h = skyViewportRef.current.offsetHeight;
        setSkyViewportWidth(prev => prev === w ? prev : w);
        if (w > 0 && h > 0) {
          const as = (h / 200) / (w / 1000);
          setAspectScale(prev => Math.abs(prev - as) > 0.01 ? as : prev);
        }
      }
    };

    measure();

    const raf = requestAnimationFrame(measure);

    const ro = new ResizeObserver(measure);
    if (outerRef.current) ro.observe(outerRef.current);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [selectedDate]);

  useLayoutEffect(() => {
    const prev = prevDateRef.current;
    if (!selectedDate || prev === selectedDate) return;
    if (prev) {
      const direction: 1 | -1 = dateChangeDirection === -1 ? -1 : 1;
      setAnimState({ kind: 'animating', outgoing: prev, incoming: selectedDate, direction });
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
      animTimeoutRef.current = setTimeout(() => {
        setAnimState({ kind: 'idle', current: selectedDate });
      }, 460);
    } else {
      setAnimState({ kind: 'idle', current: selectedDate });
    }
    prevDateRef.current = selectedDate;
    return () => {
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    };
  }, [selectedDate, dateChangeDirection]);

  useEffect(() => {
    return () => {
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    };
  }, []);

  // Track geometry: always 2 slots wide. Outgoing + incoming physically adjacent.
  // - Forward (direction 1): [outgoing, incoming]. Start x=0, animate to x=-viewportWidth.
  // - Backward (direction -1): [incoming, outgoing]. Start x=-viewportWidth, animate to x=0.
  // - Idle: [current]. Single slot. x=0.
  function getSlotOrder(state: AnimState): [string | null, string | null] {
    if (state.kind === 'idle') return [state.current, null];
    if (state.direction === 1) return [state.outgoing, state.incoming];
    return [state.incoming, state.outgoing];
  }

  function getTrackAnim(state: AnimState, viewportWidth: number) {
    if (state.kind === 'idle') {
      return { initial: { x: 0 }, animate: { x: 0 } };
    }
    if (state.direction === 1) {
      return { initial: { x: 0 }, animate: { x: -viewportWidth } };
    }
    return { initial: { x: -viewportWidth }, animate: { x: 0 } };
  }

  const pillsByDay = useMemo(() => {
    const map: Record<string, PlanItem[]> = {};
    for (const d of tripDays) map[d] = [];
    for (const item of planItems) {
      const d = item.date?.slice(0, 10);
      if (d && map[d] !== undefined && item.start_time) {
        map[d].push(item);
      }
    }
    for (const d of tripDays) {
      map[d].sort((a, b) => timeToMin(a.start_time!) - timeToMin(b.start_time!));
    }
    return map;
  }, [tripDays, planItems]);

  const nowPercent = useMemo(() => {
    if (!selectedDate) return null;
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    if (selectedDate !== todayStr) return null;
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE, hour: 'numeric', minute: 'numeric', hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10) % 24;
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
    return ((h * 60 + m) / DAY_MINUTES) * 100;
  }, [selectedDate, TIMEZONE]);

  const renderPillsForDay = useCallback((date: string) => {
    const dayPills = pillsByDay[date] ?? [];

    return (
      <>
        {dayPills.map((item, idx) => {
          const startMin = timeToMin(item.start_time!);
          const durMin = item.end_time
            ? timeToMin(item.end_time) - startMin
            : item.duration_minutes ?? 60;
          const left = (startMin / DAY_MINUTES) * 100;
          const width = Math.max((durMin / DAY_MINUTES) * 100, 2);
          const color = getActivityColor(item.activity_type);
          const Icon = TYPE_ICONS[item.activity_type ?? 'sightseeing'] ?? Landmark;
          const isTiny = durMin < 30;
          const itemIdStr = item.id ? String(item.id) : '';
          const isActive = itemIdStr !== ''
            && (itemIdStr === hoverExpandedId || lockedExpandedIds.has(itemIdStr))
            && itemIdStr !== suppressHoverUntilLeaveId;
          const isNew = itemIdStr !== '' && recentlyAddedIds.has(itemIdStr);
          const priority = item.priority ?? 'flexible';
          const isMustDo = priority === 'must_do';

          const onPillEnter = (e: React.MouseEvent<HTMLElement>) => {
            if (!itemIdStr) return;
            if (useUIStore.getState().suppressHoverUntilLeaveId === itemIdStr) return;
            useUIStore.getState().itineraryScrollHandle?.scrollToElement(itemIdStr);
            setHoverExpandedId(itemIdStr);
            schedulePeek(item, e.currentTarget as HTMLElement);
          };
          const onPillLeave = () => {
            if (itemIdStr) {
              useUIStore.setState((s) => {
                const patch: Partial<typeof s> = {};
                if (s.hoverExpandedId === itemIdStr) patch.hoverExpandedId = null;
                if (s.suppressHoverUntilLeaveId === itemIdStr) patch.suppressHoverUntilLeaveId = null;
                return patch;
              });
            }
            cancelPeek();
          };
          const onPillClick = () => {
            if (!itemIdStr) return;
            const store = useUIStore.getState();
            if (store.lockedExpandedIds.has(itemIdStr)) {
              store.toggleLockedExpanded(itemIdStr);
              useUIStore.setState({ hoverExpandedId: null, suppressHoverUntilLeaveId: itemIdStr });
            } else {
              store.itineraryScrollHandle?.scrollToElement(itemIdStr);
              store.toggleLockedExpanded(itemIdStr);
              useUIStore.setState({ hoverExpandedId: null });
            }
          };

          if (isTiny) {
            const tinyStyle: React.CSSProperties = {
              position: 'absolute',
              top: '50%',
              left: `${left}%`,
              width: isActive ? 18 : 12,
              height: isActive ? 18 : 12,
              borderRadius: '50%',
              background: color,
              border: `2px solid rgba(12,15,22,0.95)`,
              boxShadow: `0 0 0 1.5px ${color}, 0 0 12px ${color}99`,
              cursor: 'pointer',
              zIndex: 3,
              transition: 'all 180ms ease',
            };
            const tinyKey = item.id ? String(item.id) : `dot-${date}-${idx}`;
            return isNew ? (
              <motion.div
                key={tinyKey}
                initial={{
                  opacity: 0,
                  scale: 0.4,
                  filter: 'blur(4px)',
                  rotate: 0,
                  x: '-50%',
                  y: '-50%',
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  filter: 'blur(0px)',
                  x: '-50%',
                  y: '-50%',
                  rotate: [0, -8, 8, -8, 8, -4, 4, 0],
                }}
                transition={{
                  opacity: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
                  scale: { duration: 0.48, ease: [0.22, 1, 0.36, 1] },
                  filter: { duration: 0.34 },
                  rotate: {
                    duration: 0.6,
                    delay: 0.5,
                    times: [0, 0.14, 0.28, 0.42, 0.57, 0.71, 0.85, 1],
                    ease: 'linear',
                  },
                }}
                onClick={onPillClick}
                onMouseEnter={onPillEnter}
                onMouseLeave={onPillLeave}
                style={{ ...tinyStyle, transformOrigin: 'center center' }}
              />
            ) : (
              <div
                key={tinyKey}
                onClick={onPillClick}
                onMouseEnter={onPillEnter}
                onMouseLeave={onPillLeave}
                style={{ ...tinyStyle, transform: 'translate(-50%, -50%)' }}
              />
            );
          }

          const blockStyle: React.CSSProperties = {
            position: 'absolute',
            top: '50%',
            height: isActive ? 40 : 36,
            left: `${left}%`,
            minWidth: 40,
            width: `${Math.max(width, (40 / DAY_MINUTES) * 100 * (DAY_MINUTES / 1440))}%`,
            background: isActive
              ? `linear-gradient(180deg, rgba(16,20,30,0.96) 0%, rgba(12,15,22,0.94) 100%)`
              : `linear-gradient(180deg, rgba(12,15,22,0.94) 0%, rgba(12,15,22,0.88) 100%)`,
            border: `1.5px solid ${color}`,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
            boxShadow: [
              isMustDo ? 'inset 0 0 0 2px rgba(12,15,22,0.95), inset 0 0 0 3px rgba(245,158,11,0.85)' : null,
              isActive
                ? `inset 0 1px 0 ${color}, 0 0 0 1px rgba(0,0,0,0.5), 0 4px 14px rgba(0,0,0,0.5), 0 0 16px ${color}aa`
                : `inset 0 1px 0 ${color}66, 0 0 0 1px rgba(0,0,0,0.4), 0 2px 10px rgba(0,0,0,0.45), 0 0 10px ${color}55`,
            ].filter(Boolean).join(', '),
            cursor: 'pointer',
            transition: 'height 180ms ease, box-shadow 180ms ease, background 180ms ease',
          };
          const blockKey = item.id ? String(item.id) : `block-${date}-${idx}`;

          return isNew ? (
            <motion.div
              key={blockKey}
              initial={{
                opacity: 0,
                scale: 0.4,
                filter: 'blur(4px)',
                rotate: 0,
                y: '-50%',
              }}
              animate={{
                opacity: 1,
                scale: 1,
                filter: 'blur(0px)',
                y: '-50%',
                rotate: [0, -8, 8, -8, 8, -4, 4, 0],
              }}
              transition={{
                opacity: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
                scale: { duration: 0.48, ease: [0.22, 1, 0.36, 1] },
                filter: { duration: 0.34 },
                rotate: {
                  duration: 0.6,
                  delay: 0.5,
                  times: [0, 0.14, 0.28, 0.42, 0.57, 0.71, 0.85, 1],
                  ease: 'linear',
                },
              }}
              style={{ ...blockStyle, transformOrigin: 'center center' }}
              onMouseEnter={onPillEnter}
              onMouseLeave={onPillLeave}
              onClick={onPillClick}
            >
              <Icon
                size={20}
                color={color}
                strokeWidth={2.2}
                style={{ flexShrink: 0, filter: `drop-shadow(0 0 3px ${color}80)` }}
              />
            </motion.div>
          ) : (
            <div
              key={blockKey}
              style={{ ...blockStyle, transform: 'translateY(-50%)' }}
              onMouseEnter={onPillEnter}
              onMouseLeave={onPillLeave}
              onClick={onPillClick}
            >
              <Icon
                size={20}
                color={color}
                strokeWidth={2.2}
                style={{ flexShrink: 0, filter: `drop-shadow(0 0 3px ${color}80)` }}
              />
            </div>
          );
        })}
      </>
    );
  }, [pillsByDay, hoverExpandedId, lockedExpandedIds, suppressHoverUntilLeaveId, recentlyAddedIds, setHoverExpandedId, schedulePeek, cancelPeek]);

  if (!selectedDate) {
    return (
      <div style={{
        width: '100%', height: '100%',
        background: 'rgba(6,182,212,0.03)',
        border: '1px solid rgba(6,182,212,0.2)',
        borderRadius: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-sora)', fontSize: 13,
        color: 'rgba(255,255,255,0.3)',
      }}>
        Select a date
      </div>
    );
  }

  return (
    <div
      ref={outerRef}
      style={{
        width: '100%', height: '100%',
        background: 'rgba(6,182,212,0.03)',
        border: '1px solid rgba(6,182,212,0.2)',
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
      }}>
      {/* Measurement probes — invisible, preserve ref-based dimension tracking */}
      <div
        ref={skyViewportRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '70%',
          pointerEvents: 'none', visibility: 'hidden',
        }}
      />
      {/* Combined viewport — single overflow container, all 4 layers slide as one unit */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}>
        {(() => {
          const [slot0, slot1] = getSlotOrder(animState);
          const { initial, animate } = getTrackAnim(animState, skyViewportWidth);
          const trackKey = animState.kind === 'animating'
            ? `combined-${animState.outgoing}->${animState.incoming}-${animState.direction}`
            : `combined-${animState.current ?? 'null'}`;
          const activeDate = animState.kind === 'idle' ? animState.current : animState.incoming;

          const renderSlot = (slotDate: string | null) => {
            if (!slotDate) return null;
            const slotNowPercent = slotDate === selectedDate ? nowPercent : null;
            const isActive = slotDate === activeDate;

            return (
              <div style={{
                width: skyViewportWidth,
                height: '100%',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
              }}>
                {/* Layer 1 — Sky (70%) */}
                <div style={{ flex: '70 1 0', minHeight: 0, position: 'relative' }}>
                  {slotDate && skyViewportWidth > 0 && (
                    <SkyStrip
                      date={slotDate}
                      lat={LAT}
                      lng={LNG}
                      timezone={TIMEZONE}
                      scenery={scenery}
                      weatherSegments={getWeatherForDate(slotDate)}
                      isToday={isToday && slotDate === selectedDate}
                      aspectScale={aspectScale}
                    />
                  )}
                </div>

                {/* Layer 2 — Time labels (7%) */}
                <div style={{ flex: '7 1 0', minHeight: 0, position: 'relative' }}>
                  <TimeLabelsStrip />
                </div>

                {/* Layer 3 — Annotation placeholder (8%) */}
                <div style={{ flex: '8 1 0', minHeight: 0, position: 'relative' }}>
                  <div style={{
                    width: '100%', height: '100%',
                    borderTop: '0.5px dashed rgba(6, 182, 212, 0.1)',
                    background: 'rgba(6, 182, 212, 0.02)',
                  }} />
                </div>

                {/* Layer 4 — Pills (15%) */}
                <div style={{
                  flex: '15 1 0',
                  minHeight: 0,
                  padding: '4px 0',
                  display: 'flex',
                  alignItems: 'center',
                  position: 'relative',
                  pointerEvents: isActive ? 'auto' : 'none',
                }}>
                  {slotNowPercent !== null && (
                    <>
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: `${slotNowPercent}%`,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(245,158,11,0.35) 0%, transparent 70%)',
                        animation: 'travelerRingPulse 2s ease-in-out infinite',
                        pointerEvents: 'none',
                        zIndex: 5,
                      }} />
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: `${slotNowPercent}%`,
                        transformOrigin: 'center bottom',
                        animation: 'travelerBob 1.4s ease-in-out infinite',
                        filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.75))',
                        pointerEvents: 'none',
                        zIndex: 6,
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(245,158,11)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="5" r="2.5"/>
                          <path d="M9 22l1-7 2-3 2 3 1 7"/>
                          <path d="M10 15l-3-3"/>
                          <path d="M14 15l3-4"/>
                        </svg>
                      </div>
                    </>
                  )}

                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      right: 0,
                      transform: 'translateY(-50%)',
                      height: 22,
                      background: 'rgba(4, 6, 18, 0.88)',
                      borderRadius: 4,
                      boxShadow: '0 0 32px rgba(6,182,212,0.12), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.3)',
                      pointerEvents: 'none',
                    }}
                  />

                  {slotDate && skyViewportWidth > 0 && renderPillsForDay(slotDate)}
                </div>
              </div>
            );
          };

          return (
            <motion.div
              key={trackKey}
              initial={initial}
              animate={animate}
              transition={{ duration: 0.44, ease: [0.63, 0.5, 0.15, 1] }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                display: 'flex',
                height: '100%',
                width: skyViewportWidth * 2,
                willChange: 'transform',
              }}
            >
              {renderSlot(slot0)}
              {renderSlot(slot1)}
            </motion.div>
          );
        })()}
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {peekItem && peekRect && (() => {
            const it = peekItem.item;
            const startMin = timeToMin(it.start_time!);
            const durMin = it.end_time ? timeToMin(it.end_time) - startMin : it.duration_minutes ?? 60;
            const hrs = Math.floor(startMin / 60);
            const mins = startMin % 60;
            const endMin = startMin + durMin;
            const eh = Math.floor(endMin / 60);
            const em = endMin % 60;
            const fmt = (h: number, m: number) => {
              const ampm = h >= 12 ? 'PM' : 'AM';
              const hr12 = h % 12 === 0 ? 12 : h % 12;
              return `${hr12}:${String(m).padStart(2, '0')} ${ampm}`;
            };
            const color = getActivityColor(it.activity_type);
            const priority = it.priority ?? 'flexible';
            const isMustDo = priority === 'must_do';
            const costSymbol = it.currency ?? '$';

            const peekLeft = peekRect.pillCenterX;
            const peekTop = peekRect.pillTopY;

            return (
              <motion.div
                key={`peek-${it.id ?? 'item'}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  left: peekLeft,
                  top: peekTop - 8,
                  transform: 'translate(-50%, -100%)',
                  minWidth: 200,
                  maxWidth: 260,
                  padding: '10px 12px',
                  background: 'rgba(12,15,22,0.96)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: `1px solid ${color}66`,
                  borderRadius: 10,
                  boxShadow: `0 8px 28px rgba(0,0,0,0.6), 0 0 20px ${color}40`,
                  pointerEvents: 'none',
                  zIndex: 9999,
                  fontFamily: 'var(--font-sora)',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  marginBottom: 6,
                }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.96)',
                    lineHeight: 1.3,
                    flex: 1,
                  }}>
                    {it.title}
                  </span>
                  {isMustDo && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: 'rgb(245,158,11)',
                      background: 'rgba(245,158,11,0.12)',
                      border: '1px solid rgba(245,158,11,0.35)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}>MUST</span>
                  )}
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'monospace',
                  color: 'rgba(255,255,255,0.92)',
                }}>
                  <div>{fmt(hrs, mins)} – {fmt(eh, em)} · {formatDuration(durMin)}</div>
                  {(it.cost_estimate ?? 0) > 0 && (
                    <div>{costSymbol}{it.cost_estimate}</div>
                  )}
                  {it.location_name && (
                    <div style={{
                      fontFamily: 'var(--font-sora)',
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'rgba(255,255,255,0.7)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>{it.location_name}</div>
                  )}
                </div>
                <div style={{
                  position: 'absolute',
                  bottom: -5,
                  left: '50%',
                  transform: 'translateX(-50%) rotate(45deg)',
                  width: 10,
                  height: 10,
                  background: 'rgba(12,15,22,0.96)',
                  borderRight: `1px solid ${color}66`,
                  borderBottom: `1px solid ${color}66`,
                }} />
              </motion.div>
            );
          })()}
        </AnimatePresence>,
        document.body
      )}

    </div>
  );
}
