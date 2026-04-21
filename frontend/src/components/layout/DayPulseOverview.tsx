'use client';

import { useMemo, useState, useRef, useLayoutEffect, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plane, BedDouble, UtensilsCrossed, Landmark, Ticket,
  Mountain, Martini, ShoppingBag, Flower2, TreePine,
  type LucideIcon
} from 'lucide-react';
import { type PlanItem, useTripStore } from '@/store/tripStore';
import { getActivityColor } from '@/lib/activityColors';
import SkyStrip from '@/components/sky/SkyStrip';
import { type WeatherSegment } from '@/components/sky/types';
import { getSunTimes, minToPercent } from '@/lib/sunPosition';
import { useUIStore } from '@/store/uiStore';
import AddActivityDialog from '@/components/tabs/itinerary/AddActivityDialog';

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
const SUNRISE_MIN = 6 * 60;
const SUNSET_MIN = 20 * 60;
const GAP_THRESHOLD_MIN = 60;

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatDayLabel(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDuration(totalMin: number): string {
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function DayPulseOverview({ selectedDate, planItems }: Props) {
  const hoveredActivityId = useUIStore((s) => s.hoveredActivityId);
  const expandedActivityId = useUIStore((s) => s.expandedActivityId);
  const setHoveredActivityId = useUIStore((s) => s.setHoveredActivityId);
  const toggleExpandedActivityId = useUIStore((s) => s.toggleExpandedActivityId);
  const dateChangeDirection = useUIStore((s) => s.dateChangeDirection);
  const tripPlan = useTripStore((s) => s.tripPlan);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [prefillStart, setPrefillStart] = useState<string | undefined>();
  const [prefillDuration, setPrefillDuration] = useState<number>(60);

  const [peekItem, setPeekItem] = useState<{
    item: PlanItem;
    leftPercent: number;
  } | null>(null);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePeek = (item: PlanItem, leftPercent: number) => {
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    peekTimerRef.current = setTimeout(() => {
      setPeekItem({ item, leftPercent });
    }, 200);
  };

  const cancelPeek = () => {
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    setPeekItem(null);
  };

  const dayItems = useMemo(() => {
    if (!selectedDate) return [];
    return planItems
      .filter((i) => i.date?.slice(0, 10) === selectedDate && i.start_time)
      .sort((a, b) => timeToMin(a.start_time!) - timeToMin(b.start_time!));
  }, [planItems, selectedDate]);

  const dayNumber = useMemo(() => {
    if (!selectedDate || planItems.length === 0) return 1;
    const item = planItems.find((i) => i.date?.slice(0, 10) === selectedDate);
    return item?.day_number ?? 1;
  }, [planItems, selectedDate]);

  const stats = useMemo(() => {
    const count = dayItems.length;
    const totalMin = dayItems.reduce((s, i) => {
      if (i.duration_minutes) return s + i.duration_minutes;
      if (i.start_time && i.end_time) return s + (timeToMin(i.end_time) - timeToMin(i.start_time));
      return s;
    }, 0);
    const totalCost = dayItems.reduce((s, i) => s + (i.cost_estimate ?? 0), 0);
    return { count, totalMin, totalCost };
  }, [dayItems]);

  const LAT = tripPlan?.destination_latitude ?? 34.0522;
  const LNG = tripPlan?.destination_longitude ?? -118.2437;
  const TIMEZONE = tripPlan?.destination_timezone ?? 'America/Los_Angeles';
  const weatherSegments: WeatherSegment[] = [];

  const tripDays = useMemo(() => {
    if (!tripPlan?.start_date || !tripPlan?.end_date) {
      return selectedDate ? [selectedDate] : [];
    }
    const start = new Date(tripPlan.start_date + 'T00:00:00');
    const end = new Date(tripPlan.end_date + 'T00:00:00');
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
  }, [tripPlan?.start_date, tripPlan?.end_date, selectedDate]);

  const selectedDayIndex = useMemo(() => {
    if (!selectedDate) return 0;
    const idx = tripDays.indexOf(selectedDate);
    return idx < 0 ? 0 : idx;
  }, [tripDays, selectedDate]);

  const buildRailGradient = (date: string) => {
    const st = getSunTimes(date, LAT, LNG, TIMEZONE);
    const { astronomicalDawnMin, dawnMin, sunriseMin, solarNoonMin, sunsetMin, duskMin, astronomicalDuskMin } = st;
    const stops: string[] = [];
    const add = (pct: number, color: string) => stops.push(`${color} ${Math.max(0, Math.min(100, pct)).toFixed(2)}%`);
    add(0, 'rgba(4,7,20,0.9)');
    add(minToPercent(astronomicalDawnMin), 'rgba(14,24,56,0.8)');
    add(minToPercent(dawnMin), 'rgba(106,58,88,0.75)');
    add(minToPercent(sunriseMin), 'rgba(236,170,106,0.75)');
    add(minToPercent(sunriseMin) + 3, 'rgba(142,194,232,0.7)');
    add(minToPercent(solarNoonMin), 'rgba(114,182,232,0.7)');
    add(minToPercent(sunsetMin) - 3, 'rgba(164,200,220,0.7)');
    add(minToPercent(sunsetMin), 'rgba(232,131,62,0.75)');
    add(minToPercent(duskMin), 'rgba(122,46,72,0.8)');
    add(minToPercent(astronomicalDuskMin), 'rgba(22,24,56,0.85)');
    add(100, 'rgba(6,10,28,0.9)');
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  };

  const railGradient = useMemo(() => {
    if (!selectedDate) return 'transparent';
    return buildRailGradient(selectedDate);
  }, [selectedDate, LAT, LNG, TIMEZONE]);

  const skyViewportRef = useRef<HTMLDivElement>(null);
  const pillsViewportRef = useRef<HTMLDivElement>(null);
  const [skyViewportWidth, setSkyViewportWidth] = useState(0);
  const [pillsViewportWidth, setPillsViewportWidth] = useState(0);

  type AnimState =
    | { kind: 'idle'; current: string | null }
    | { kind: 'animating'; outgoing: string; incoming: string; direction: 1 | -1 };

  const [animState, setAnimState] = useState<AnimState>({ kind: 'idle', current: selectedDate });
  const prevDateRef = useRef<string | null>(selectedDate);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      if (skyViewportRef.current) setSkyViewportWidth(skyViewportRef.current.offsetWidth);
      if (pillsViewportRef.current) setPillsViewportWidth(pillsViewportRef.current.offsetWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (skyViewportRef.current) ro.observe(skyViewportRef.current);
    if (pillsViewportRef.current) ro.observe(pillsViewportRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    const prev = prevDateRef.current;
    if (!selectedDate || prev === selectedDate) return;
    if (prev) {
      const direction: 1 | -1 = dateChangeDirection === -1 ? -1 : 1;
      setAnimState({ kind: 'animating', outgoing: prev, incoming: selectedDate, direction });
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
      animTimeoutRef.current = setTimeout(() => {
        setAnimState({ kind: 'idle', current: selectedDate });
      }, 400);
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

  const addSlots = useMemo(() => {
    if (dayItems.length === 0) return [] as { midMin: number; label: string }[];
    const slots: { midMin: number; label: string }[] = [];
    const sorted = [...dayItems].sort((a, b) => timeToMin(a.start_time!) - timeToMin(b.start_time!));
    for (let i = 0; i < sorted.length - 1; i++) {
      const curEnd = sorted[i].end_time
        ? timeToMin(sorted[i].end_time!)
        : timeToMin(sorted[i].start_time!) + (sorted[i].duration_minutes ?? 60);
      const nextStart = timeToMin(sorted[i + 1].start_time!);
      const gapMin = nextStart - curEnd;
      if (gapMin >= 30) {
        slots.push({ midMin: curEnd + gapMin / 2, label: `${curEnd}` });
      }
    }
    return slots;
  }, [dayItems]);

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
  }, [selectedDate]);

  const gaps = useMemo(() => {
    if (dayItems.length === 0) return [];
    const result: { startMin: number; endMin: number; durationMin: number }[] = [];
    const firstStart = timeToMin(dayItems[0].start_time!);
    if (firstStart - SUNRISE_MIN >= GAP_THRESHOLD_MIN) {
      result.push({ startMin: SUNRISE_MIN, endMin: firstStart, durationMin: firstStart - SUNRISE_MIN });
    }
    for (let i = 0; i < dayItems.length - 1; i++) {
      const curEnd = dayItems[i].end_time
        ? timeToMin(dayItems[i].end_time!)
        : timeToMin(dayItems[i].start_time!) + (dayItems[i].duration_minutes ?? 60);
      const nextStart = timeToMin(dayItems[i + 1].start_time!);
      if (nextStart - curEnd >= GAP_THRESHOLD_MIN) {
        result.push({ startMin: curEnd, endMin: nextStart, durationMin: nextStart - curEnd });
      }
    }
    return result;
  }, [dayItems]);

  const renderPillsForDay = (date: string) => {
    const dayPills = pillsByDay[date] ?? [];
    const daySlots: { midMin: number }[] = [];
    if (dayPills.length >= 2) {
      const sorted = [...dayPills].sort((a, b) => timeToMin(a.start_time!) - timeToMin(b.start_time!));
      for (let i = 0; i < sorted.length - 1; i++) {
        const curEnd = sorted[i].end_time
          ? timeToMin(sorted[i].end_time!)
          : timeToMin(sorted[i].start_time!) + (sorted[i].duration_minutes ?? 60);
        const nextStart = timeToMin(sorted[i + 1].start_time!);
        const gapMin = nextStart - curEnd;
        if (gapMin >= 30) daySlots.push({ midMin: curEnd + gapMin / 2 });
      }
    }

    return (
      <>
        {daySlots.map((slot, i) => (
          <button
            key={`add-${date}-${i}`}
            onClick={() => {
              const startH = Math.floor(slot.midMin / 60);
              const startM = slot.midMin % 60;
              setPrefillStart(`${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`);
              setPrefillDuration(60);
              setAddDialogOpen(true);
            }}
            style={{
              position: 'absolute',
              top: '50%',
              left: `${(slot.midMin / DAY_MINUTES) * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 28,
              height: 28,
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.95)',
              fontSize: 28,
              fontWeight: 300,
              lineHeight: 1,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              textShadow: '0 1px 3px rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.5)',
              zIndex: 4,
              transition: 'all 160ms ease',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = 'rgb(245,158,11)';
              el.style.textShadow = '0 0 12px rgba(245,158,11,0.8), 0 1px 3px rgba(0,0,0,0.7)';
              el.style.transform = 'translate(-50%, -50%) scale(1.25)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = 'rgba(255,255,255,0.95)';
              el.style.textShadow = '0 1px 3px rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.5)';
              el.style.transform = 'translate(-50%, -50%) scale(1)';
            }}
          >+</button>
        ))}

        {dayPills.map((item, idx) => {
          const startMin = timeToMin(item.start_time!);
          const durMin = item.end_time
            ? timeToMin(item.end_time) - startMin
            : item.duration_minutes ?? 60;
          const left = (startMin / DAY_MINUTES) * 100;
          const width = Math.max((durMin / DAY_MINUTES) * 100, 2);
          const color = getActivityColor(item.activity_type);
          const title = (item.title?.length ?? 0) > 22 ? item.title!.slice(0, 22) + '…' : item.title ?? '';
          const Icon = TYPE_ICONS[item.activity_type ?? 'sightseeing'] ?? Landmark;
          const isNarrow = durMin < 50;
          const isTiny = durMin < 30;
          const itemIdStr = item.id ? String(item.id) : '';
          const isActive = itemIdStr !== '' && (itemIdStr === hoveredActivityId || itemIdStr === expandedActivityId);
          const priority = item.priority ?? 'flexible';
          const isMustDo = priority === 'must_do';
          const isFlexible = priority === 'flexible';

          if (isTiny) {
            return (
              <div
                key={item.id ? String(item.id) : `dot-${date}-${idx}`}
                onClick={() => { if (item.id) toggleExpandedActivityId(String(item.id)); }}
                onMouseEnter={() => {
                  console.log('[DOT HOVER]', item.title, 'id=', item.id);
                  if (item.id) setHoveredActivityId(String(item.id));
                  schedulePeek(item, left);
                }}
                onMouseLeave={() => {
                  setHoveredActivityId(null);
                  cancelPeek();
                }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: `${left}%`,
                  transform: 'translate(-50%, -50%)',
                  width: isActive ? 18 : 12,
                  height: isActive ? 18 : 12,
                  borderRadius: '50%',
                  background: color,
                  border: `2px solid rgba(12,15,22,0.95)`,
                  boxShadow: `0 0 0 1.5px ${color}, 0 0 12px ${color}99`,
                  cursor: 'pointer',
                  zIndex: 3,
                  transition: 'all 180ms ease',
                }}
              />
            );
          }

          return (
            <div
              key={item.id ? String(item.id) : `block-${date}-${idx}`}
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                height: isActive ? 40 : 36,
                left: `${left}%`,
                minWidth: 40,
                width: `${Math.max(width, (40 / DAY_MINUTES) * 100 * (DAY_MINUTES / 1440))}%`,
                background: isActive
                  ? `linear-gradient(180deg, rgba(16,20,30,0.96) 0%, rgba(12,15,22,0.94) 100%)`
                  : `linear-gradient(180deg, rgba(12,15,22,0.94) 0%, rgba(12,15,22,0.88) 100%)`,
                border: `${isMustDo ? 2 : 1.5}px ${isFlexible ? 'dashed' : 'solid'} ${color}`,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                boxShadow: isActive
                  ? (isMustDo
                      ? `inset 0 1px 0 ${color}, 0 0 0 1px rgba(245,158,11,0.4), 0 4px 14px rgba(0,0,0,0.5), 0 0 18px ${color}`
                      : `inset 0 1px 0 ${color}, 0 0 0 1px rgba(0,0,0,0.5), 0 4px 14px rgba(0,0,0,0.5), 0 0 16px ${color}aa`)
                  : (isMustDo
                      ? `inset 0 1px 0 ${color}99, 0 0 0 1px rgba(245,158,11,0.25), 0 2px 10px rgba(0,0,0,0.45), 0 0 12px ${color}66`
                      : `inset 0 1px 0 ${color}66, 0 0 0 1px rgba(0,0,0,0.4), 0 2px 10px rgba(0,0,0,0.45), 0 0 10px ${color}55`),
                cursor: 'pointer',
                transition: 'height 180ms ease, box-shadow 180ms ease, background 180ms ease',
              }}
              onMouseEnter={() => {
                console.log('[PILL HOVER]', item.title, 'id=', item.id, 'left=', left);
                if (item.id) setHoveredActivityId(String(item.id));
                schedulePeek(item, left);
              }}
              onMouseLeave={() => {
                setHoveredActivityId(null);
                cancelPeek();
              }}
              onClick={() => {
                if (item.id) toggleExpandedActivityId(String(item.id));
              }}
            >
              {isMustDo && (
                <div style={{
                  position: 'absolute',
                  top: 0, right: 0,
                  width: 0, height: 0,
                  borderStyle: 'solid',
                  borderWidth: '0 8px 8px 0',
                  borderColor: `transparent rgb(245,158,11) transparent transparent`,
                  filter: 'drop-shadow(0 0 3px rgba(245,158,11,0.7))',
                  pointerEvents: 'none',
                }} />
              )}
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
  };

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
      style={{
        width: '100%', height: '100%',
        background: 'rgba(6,182,212,0.03)',
        border: '1px solid rgba(6,182,212,0.2)',
        borderRadius: 16,
        padding: 12,
        display: 'flex', flexDirection: 'column', gap: 8,
        overflow: 'hidden',
      }}>
      {/* Bar */}
      <div style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        width: '100%',
      }}>
        {/* Sky two-slot viewport */}
        <div
          ref={skyViewportRef}
          style={{
            position: 'relative',
            flex: '0 0 60%',
            minHeight: 0,
            width: '100%',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {(() => {
            const [slot0, slot1] = getSlotOrder(animState);
            const { initial, animate } = getTrackAnim(animState, skyViewportWidth);
            const trackKey = animState.kind === 'animating'
              ? `sky-${animState.outgoing}->${animState.incoming}-${animState.direction}`
              : `sky-${animState.current ?? 'null'}`;
            return (
              <motion.div
                key={trackKey}
                initial={initial}
                animate={animate}
                transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
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
                <div style={{ width: skyViewportWidth, height: '100%', flexShrink: 0 }}>
                  {slot0 && skyViewportWidth > 0 && (
                    <SkyStrip
                      date={slot0}
                      lat={LAT}
                      lng={LNG}
                      timezone={TIMEZONE}
                      scenery="mountainscape"
                      weatherSegments={weatherSegments}
                    />
                  )}
                </div>
                <div style={{ width: skyViewportWidth, height: '100%', flexShrink: 0 }}>
                  {slot1 && skyViewportWidth > 0 && (
                    <SkyStrip
                      date={slot1}
                      lat={LAT}
                      lng={LNG}
                      timezone={TIMEZONE}
                      scenery="mountainscape"
                      weatherSegments={weatherSegments}
                    />
                  )}
                </div>
              </motion.div>
            );
          })()}
        </div>

        {/* Hour labels — STATIC */}
        <div style={{
          flex: '0 0 5%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 13,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.65)',
          fontFamily: 'monospace',
          letterSpacing: '0.04em',
          width: '100%',
        }}>
          <span>12 AM</span>
          <span>3 AM</span>
          <span>6 AM</span>
          <span>9 AM</span>
          <span>12 PM</span>
          <span>3 PM</span>
          <span>6 PM</span>
          <span>9 PM</span>
          <span>12 AM</span>
        </div>

        {/* Activity track — STATIC container with two-slot pills inside */}
        <div
          ref={pillsViewportRef}
          style={{
            position: 'relative',
            flex: '0 0 35%',
            minHeight: 0,
            width: '100%',
            background: 'transparent',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {nowPercent !== null && (
            <>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: `${nowPercent}%`,
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
                left: `${nowPercent}%`,
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

          {/* Rail — STATIC container, gradient crossfades with selectedDate */}
          <motion.div
            animate={{ background: railGradient }}
            transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              transform: 'translateY(-50%)',
              height: 22,
              background: railGradient,
              borderRadius: 4,
              boxShadow: '0 0 32px rgba(6,182,212,0.12), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.3)',
              pointerEvents: 'none',
            }}
          />

          {/* Tick dots — STATIC */}
          {[25, 50, 75].map((pct) => (
            <div key={pct} style={{
              position: 'absolute',
              top: 'calc(50% + 10px)',
              left: `${pct}%`,
              transform: 'translateX(-50%)',
              width: 2,
              height: 2,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.35)',
              pointerEvents: 'none',
            }} />
          ))}

          {(() => {
            const [slot0, slot1] = getSlotOrder(animState);
            const { initial, animate } = getTrackAnim(animState, pillsViewportWidth);
            const trackKey = animState.kind === 'animating'
              ? `pills-${animState.outgoing}->${animState.incoming}-${animState.direction}`
              : `pills-${animState.current ?? 'null'}`;
            const activeDate = animState.kind === 'idle' ? animState.current : animState.incoming;
            return (
              <motion.div
                key={trackKey}
                initial={initial}
                animate={animate}
                transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
                onMouseEnter={() => console.log('[TRACK HOVER] reached the pill filmstrip track')}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  display: 'flex',
                  height: '100%',
                  width: pillsViewportWidth * 2,
                  willChange: 'transform',
                }}
              >
                <div style={{
                  width: pillsViewportWidth,
                  height: '100%',
                  flexShrink: 0,
                  position: 'relative',
                  pointerEvents: slot0 === activeDate ? 'auto' : 'none',
                }}>
                  {slot0 && pillsViewportWidth > 0 && renderPillsForDay(slot0)}
                </div>
                <div style={{
                  width: pillsViewportWidth,
                  height: '100%',
                  flexShrink: 0,
                  position: 'relative',
                  pointerEvents: slot1 === activeDate ? 'auto' : 'none',
                }}>
                  {slot1 && pillsViewportWidth > 0 && renderPillsForDay(slot1)}
                </div>
              </motion.div>
            );
          })()}

          {peekItem && (() => {
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
            const clampedLeft = Math.max(3, Math.min(97, peekItem.leftPercent));

            return (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  left: `${clampedLeft}%`,
                  bottom: 'calc(100% + 10px)',
                  transform: 'translateX(-50%)',
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
                  zIndex: 20,
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
                  gap: 3,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: 'rgba(255,255,255,0.6)',
                }}>
                  <div>{fmt(hrs, mins)} – {fmt(eh, em)} · {formatDuration(durMin)}</div>
                  {(it.cost_estimate ?? 0) > 0 && (
                    <div>${it.cost_estimate}</div>
                  )}
                  {it.location_name && (
                    <div style={{
                      fontFamily: 'var(--font-sora)',
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.45)',
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
        </div>
      </div>

      {selectedDate && (
        <AddActivityDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          selectedDate={selectedDate}
          prefillStartTime={prefillStart}
          prefillDurationMinutes={prefillDuration}
        />
      )}

    </div>
  );
}
