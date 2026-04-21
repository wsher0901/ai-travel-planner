'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type PlanItem } from '@/store/tripStore';
import { getActivityColor } from '@/lib/activityColors';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface Props {
  tripStartDate: string;
  tripEndDate: string;
  planItems: PlanItem[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

export default function TripCalendar({
  tripStartDate,
  tripEndDate,
  planItems,
  selectedDate,
  onSelectDate,
}: Props) {
  const tripStart = useMemo(() => new Date(tripStartDate + 'T00:00:00'), [tripStartDate]);
  const [viewYear, setViewYear] = useState(tripStart.getFullYear());
  const [viewMonth, setViewMonth] = useState(tripStart.getMonth());
  useEffect(() => {
    setViewYear(tripStart.getFullYear());
    setViewMonth(tripStart.getMonth());
  }, [tripStart]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
  });
  const yearLabel = String(viewYear);

  const itemsByDate = useMemo(() => {
    const map: Record<string, PlanItem[]> = {};
    planItems.forEach((item) => {
      if (item.date) {
        const key = item.date.slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(item);
      }
    });
    return map;
  }, [planItems]);

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const startPad = firstDayOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayISO = toISO(new Date());

  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: 8,
        borderRadius: 20,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        transition: 'border-color 200ms ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        .trip-calendar-panel:hover {
          background: linear-gradient(180deg, rgba(245,158,11,0.04) 0%, rgba(255,255,255,0.01) 100%) !important;
          border-color: rgba(245,158,11,0.28) !important;
        }
        .trip-calendar-panel:hover .trip-calendar-bloom {
          opacity: 1 !important;
        }
      `}</style>
      <div
        className="trip-calendar-panel"
        style={{
          flex: 1,
          padding: 12,
          borderRadius: 16,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: 'inset 0 2px 1.5px 0 rgba(165,174,184,0.1)',
          transition: 'background 300ms ease, border-color 300ms ease',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          className="trip-calendar-bloom"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.22) 0%, rgba(245,158,11,0.08) 30%, transparent 65%)',
            opacity: 0,
            transition: 'opacity 300ms ease',
            pointerEvents: 'none',
            zIndex: 0,
            borderRadius: 16,
          }}
        />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.9)',
              fontFamily: 'var(--font-sora)',
            }}>
              {monthLabel},
            </span>
            <span style={{
              fontSize: 15,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.65)',
              fontFamily: 'var(--font-sora)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {yearLabel}
            </span>
            <span style={{
              width: 3, height: 3, borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              marginLeft: 4,
            }} />
            <span style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.55)',
              fontFamily: 'var(--font-sora)',
            }}>
              {tripStartDate.slice(5).replace('-', '/')} – {tripEndDate.slice(5).replace('-', '/')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              onClick={prevMonth}
              style={{
                width: 24, height: 24, borderRadius: 6,
                background: 'transparent',
                border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.85)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)';
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={nextMonth}
              style={{
                width: 24, height: 24, borderRadius: 6,
                background: 'transparent',
                border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.85)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)';
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Weekdays */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
          padding: '4px 8px 0',
          position: 'relative',
          zIndex: 1,
        }}>
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.5)',
                fontFamily: 'var(--font-sora)',
                textAlign: 'center',
              }}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
          padding: '0 8px',
          flex: 1,
          minHeight: 0,
          position: 'relative',
          zIndex: 1,
        }}>
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`pad-${idx}`} />;
            }

            const dateStr = toISO(new Date(viewYear, viewMonth, day));
            const inTrip = dateStr >= tripStartDate && dateStr <= tripEndDate;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayISO;
            const items = itemsByDate[dateStr] ?? [];
            const dots = items.slice(0, 4);

            return (
              <div
                key={dateStr}
                onClick={() => inTrip && onSelectDate(dateStr)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 32,
                  cursor: inTrip ? 'pointer' : 'default',
                  padding: 2,
                }}
              >
                {/* Filled circle for in-trip or selected */}
                {inTrip && (
                  <>
                    {isSelected ? (
                      <AnimatePresence mode="popLayout">
                        <motion.div
                          key={dateStr}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.12, ease: 'easeOut' }}
                          style={{
                            position: 'absolute',
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: 'rgb(245,158,11)',
                            boxShadow: '0 0 20px rgba(245,158,11,0.45), 0 2px 8px rgba(245,158,11,0.3)',
                            zIndex: 1,
                          }}
                        />
                        <motion.div
                          key={`${dateStr}-echo-1`}
                          initial={{ scale: 1, opacity: 0.55 }}
                          animate={{ scale: 1.8, opacity: 0 }}
                          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                          style={{
                            position: 'absolute',
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            border: '2px solid rgba(245,158,11,0.85)',
                            pointerEvents: 'none',
                            zIndex: 0,
                          }}
                        />
                        <motion.div
                          key={`${dateStr}-echo-2`}
                          initial={{ scale: 1, opacity: 0 }}
                          animate={{ scale: 1.55, opacity: [0, 0.45, 0] }}
                          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                          style={{
                            position: 'absolute',
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            border: '1.5px solid rgba(245,158,11,0.55)',
                            pointerEvents: 'none',
                            zIndex: 0,
                          }}
                        />
                      </AnimatePresence>
                    ) : (
                      <div
                        className="day-circle"
                        style={{
                          position: 'absolute',
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: 'rgba(245,158,11,0.85)',
                          transition: 'all 200ms ease',
                          zIndex: 1,
                        }}
                      />
                    )}
                  </>
                )}

                {/* Today ring on non-trip dates */}
                {isToday && !inTrip && (
                  <div style={{
                    position: 'absolute',
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.25)',
                    zIndex: 1,
                  }} />
                )}

                {/* Day number */}
                <span style={{
                  position: 'relative',
                  zIndex: 2,
                  fontSize: 15,
                  fontWeight: inTrip ? 600 : 500,
                  color: inTrip
                    ? (isSelected ? 'rgb(10,10,10)' : 'rgb(255,255,255)')
                    : 'rgba(255,255,255,0.7)',
                  fontFamily: 'var(--font-sora)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}>
                  {day}
                </span>

                {/* Activity dots */}
                {dots.length > 0 && inTrip && (
                  <div style={{
                    position: 'relative',
                    zIndex: 2,
                    display: 'flex',
                    gap: 2,
                    marginTop: 2,
                  }}>
                    {dots.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          width: 2.5,
                          height: 2.5,
                          borderRadius: '50%',
                          background: isSelected
                            ? 'rgba(10,10,10,0.55)'
                            : getActivityColor(item.activity_type ?? ''),
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
