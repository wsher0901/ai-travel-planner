'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Landmark, Utensils, Music, Plane, Hotel } from 'lucide-react';
import { type PlanItem } from '@/store/tripStore';
import { getActivityColor } from '@/lib/activityColors';
import SkyStrip from '@/components/sky/SkyStrip';
import { type WeatherSegment } from '@/components/sky/types';
import { getSunTimes, minToPercent } from '@/lib/sunPosition';
import { useUIStore } from '@/store/uiStore';
import AddActivityDialog from '@/components/tabs/itinerary/AddActivityDialog';

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  sightseeing: Landmark,
  food: Utensils,
  activity: Music,
  transport: Plane,
  accommodation: Hotel,
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

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [prefillStart, setPrefillStart] = useState<string | undefined>();
  const [prefillDuration, setPrefillDuration] = useState<number>(60);

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

  // TEMPORARY: hardcoded for LA. Phase 3 wires tripPlan.destination_latitude/longitude + Open-Meteo API.
  const LAT = 34.0522;
  const LNG = -118.2437;
  const TIMEZONE = 'America/Los_Angeles';
  const weatherSegments: WeatherSegment[] = [];  // empty = sunny all day

  const sunTimes = useMemo(
    () => getSunTimes(selectedDate ?? '2026-05-24', LAT, LNG, TIMEZONE),
    [selectedDate]
  );

  const railGradient = useMemo(() => {
    const { astronomicalDawnMin, dawnMin, sunriseMin, solarNoonMin, sunsetMin, duskMin, astronomicalDuskMin } = sunTimes;
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
  }, [sunTimes]);

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
    <motion.div
      key={selectedDate}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
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
        paddingLeft: 0,
        paddingRight: 0,
      }}>
        {/* Top track: sky strip */}
        <div style={{
          position: 'relative',
          flex: '0 0 60%',
          minHeight: 0,
          width: '100%',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {selectedDate && (
            <SkyStrip
              date={selectedDate}
              lat={LAT}
              lng={LNG}
              timezone={TIMEZONE}
              scenery="mountainscape"
              weatherSegments={weatherSegments}
            />
          )}
        </div>

        {/* Hour labels */}
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

        {/* Bottom track: activities */}
        <div style={{
          position: 'relative',
          flex: '0 0 35%',
          minHeight: 0,
          width: '100%',
          background: 'transparent',
          borderRadius: 10,
          overflow: 'visible',
        }}>
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

          {/* Data band rail — time-of-day gradient */}
          <div style={{
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
          }} />

          {/* Subtle tick dots below rail at 6/12/18 */}
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

          {/* Always-visible + buttons between activities in gaps >= 30min */}
          {addSlots.map((slot, i) => (
            <button
              key={`add-${i}`}
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

          {/* Activity blocks */}
          {dayItems.map((item, idx) => {
            const startMin = timeToMin(item.start_time!);
            const durMin = item.end_time
              ? timeToMin(item.end_time) - startMin
              : item.duration_minutes ?? 60;
            const left = (startMin / DAY_MINUTES) * 100;
            const width = Math.max((durMin / DAY_MINUTES) * 100, 2);
            const color = getActivityColor(item.activity_type);
            const title = (item.title?.length ?? 0) > 22 ? item.title!.slice(0, 22) + '…' : item.title ?? '';
            const Icon = TYPE_ICONS[item.activity_type ?? 'activity'] ?? Music;
            const isNarrow = durMin < 50;
            const isTiny = durMin < 30;
            const itemIdStr = item.id ? String(item.id) : '';
            const isActive = itemIdStr !== '' && (itemIdStr === hoveredActivityId || itemIdStr === expandedActivityId);
            const priority = item.priority ?? 'flexible';
            const isMustDo = priority === 'must_do';
            const isFlexible = priority === 'flexible';

            if (isTiny) {
              const h = Math.floor(startMin / 60);
              const m = startMin % 60;
              const ampm = h >= 12 ? 'PM' : 'AM';
              const hr12 = h % 12 === 0 ? 12 : h % 12;
              const timeLabel = `${hr12}:${String(m).padStart(2, '0')} ${ampm}`;
              return (
                <div
                  key={item.id ? String(item.id) : `dot-${idx}`}
                  onClick={() => { if (item.id) toggleExpandedActivityId(String(item.id)); }}
                  onMouseEnter={() => { if (item.id) setHoveredActivityId(String(item.id)); }}
                  onMouseLeave={() => setHoveredActivityId(null)}
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
                    boxShadow: `0 0 0 1.5px ${color}, 0 0 14px ${color}99`,
                    cursor: 'pointer',
                    zIndex: 3,
                    transition: 'all 180ms ease',
                  }}
                  title={`${item.title} · ${timeLabel}`}
                />
              );
            }

            return (
              <div
                key={item.id ? String(item.id) : `block-${idx}`}
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  height: isActive ? 52 : 45,
                  left: `${left}%`,
                  width: `${width}%`,
                  background: isActive
                    ? `linear-gradient(180deg, rgba(16,20,30,0.95) 0%, rgba(12,15,22,0.92) 100%)`
                    : `linear-gradient(180deg, rgba(12,15,22,0.92) 0%, rgba(12,15,22,0.85) 100%)`,
                  border: `${isMustDo ? 2 : 1.5}px solid ${isFlexible ? `${color}77` : color}`,
                  borderRadius: 17,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 18px',
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  color: 'rgba(255,255,255,0.98)',
                  fontFamily: 'var(--font-sora)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  boxShadow: isActive
                    ? (isMustDo
                        ? `inset 0 1px 0 ${color}, inset 0 -1px 0 rgba(0,0,0,0.4), 0 0 0 1px rgba(245,158,11,0.4), 0 6px 24px rgba(0,0,0,0.6), 0 0 32px ${color}`
                        : `inset 0 1px 0 ${color}, inset 0 -1px 0 rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.5), 0 6px 22px rgba(0,0,0,0.6), 0 0 28px ${color}99`)
                    : (isMustDo
                        ? `inset 0 1px 0 ${color}99, inset 0 -1px 0 rgba(0,0,0,0.4), 0 0 0 1px rgba(245,158,11,0.25), 0 4px 18px rgba(0,0,0,0.5), 0 0 22px ${color}66`
                        : `inset 0 1px 0 ${color}66, inset 0 -1px 0 rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.5), 0 0 18px ${color}55`),
                  opacity: isFlexible ? 0.82 : 1,
                  cursor: 'pointer',
                  transition: 'height 180ms ease, box-shadow 180ms ease, background 180ms ease',
                }}
                onMouseEnter={() => {
                  if (item.id) setHoveredActivityId(String(item.id));
                }}
                onMouseLeave={() => {
                  setHoveredActivityId(null);
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
                    borderWidth: '0 10px 10px 0',
                    borderColor: 'transparent rgb(245,158,11) transparent transparent',
                    filter: 'drop-shadow(0 0 4px rgba(245,158,11,0.8))',
                    pointerEvents: 'none',
                  }} />
                )}
                <Icon size={isNarrow ? 16 : 20} color={color} strokeWidth={2.2} style={{ flexShrink: 0, filter: `drop-shadow(0 0 3px ${color}80)` }} />
                {!isNarrow && (
                  <span style={{
                    fontSize: 15, fontWeight: 600,
                    color: 'rgba(255,255,255,0.98)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {title}
                  </span>
                )}
              </div>
            );
          })}
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

    </motion.div>
  );
}
