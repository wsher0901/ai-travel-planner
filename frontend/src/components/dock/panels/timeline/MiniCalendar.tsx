'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type PlanItem } from '@/store/tripStore';

interface MiniCalendarProps {
  startDate: string;
  endDate: string;
  planItems: PlanItem[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TYPE_COLORS: Record<string, string> = {
  transport: '#3b82f6',
  accommodation: '#a855f7',
  food: '#f59e0b',
  activity: '#22c55e',
  sightseeing: '#06b6d4',
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function MiniCalendar({
  startDate,
  endDate,
  planItems,
  selectedDate,
  onSelectDate,
}: MiniCalendarProps) {
  const anchor = new Date(startDate + 'T00:00:00');

  const [viewYear, setViewYear] = useState(anchor.getFullYear());
  const [viewMonth, setViewMonth] = useState(anchor.getMonth());

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Group activity types per date
  const typesByDate = planItems.reduce<Record<string, string[]>>((acc, item) => {
    if (item.date) {
      if (!acc[item.date]) acc[item.date] = [];
      acc[item.date].push(item.activity_type ?? 'activity');
    }
    return acc;
  }, {});

  const todayStr = toDateString(new Date());

  // Build full month grid
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const startPad = firstDayOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const allCells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (allCells.length % 7 !== 0) allCells.push(null);

  const allRows: (number | null)[][] = [];
  for (let i = 0; i < allCells.length; i += 7) {
    allRows.push(allCells.slice(i, i + 7));
  }

  // Find which rows contain trip dates
  const tripRowIndices = allRows.reduce<number[]>((acc, row, i) => {
    const hasTripDate = row.some((day) => {
      if (!day) return false;
      const ds = toDateString(new Date(viewYear, viewMonth, day));
      return ds >= startDate && ds <= endDate;
    });
    if (hasTripDate) acc.push(i);
    return acc;
  }, []);

  // Compute the row range to display
  let loRow: number;
  let hiRow: number;

  if (tripRowIndices.length === 0) {
    // No trip dates in this month view — show all rows
    loRow = 0;
    hiRow = allRows.length - 1;
  } else {
    loRow = Math.min(...tripRowIndices);
    hiRow = Math.max(...tripRowIndices);

    // Guarantee at least 3 rows
    while (hiRow - loRow + 1 < 3) {
      if (loRow > 0) loRow--;
      else if (hiRow < allRows.length - 1) hiRow++;
      else break;
    }

    // Add one context row above and below for orientation
    if (loRow > 0) loRow--;
    if (hiRow < allRows.length - 1) hiRow++;
  }

  const visibleRows = allRows.slice(loRow, hiRow + 1);

  // Month navigation
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '10px 8px',
      }}
    >
      {/* ── Month header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <button
          onClick={prevMonth}
          style={{
            background: 'none',
            border: 'none',
            padding: '2px 4px',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            lineHeight: 1,
          }}
        >
          <ChevronLeft size={14} />
        </button>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.5)',
            fontFamily: 'var(--font-sora)',
          }}
        >
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          style={{
            background: 'none',
            border: 'none',
            padding: '2px 4px',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            lineHeight: 1,
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ── Weekday labels ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          marginBottom: 2,
        }}
      >
        {WEEKDAYS.map((wd, i) => (
          <div
            key={i}
            style={{
              height: 28,
              fontSize: 10,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.25)',
              textAlign: 'center',
              fontFamily: 'var(--font-sora)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* ── Day rows ── */}
      {visibleRows.map((row, rowIdx) => {
        // Find the column span of trip dates within this row
        const rangeColIndices = row.reduce<number[]>((acc, day, colIdx) => {
          if (!day) return acc;
          const ds = toDateString(new Date(viewYear, viewMonth, day));
          if (ds >= startDate && ds <= endDate) acc.push(colIdx);
          return acc;
        }, []);
        const rangeStart = rangeColIndices.length > 0 ? Math.min(...rangeColIndices) : -1;
        const rangeEnd   = rangeColIndices.length > 0 ? Math.max(...rangeColIndices) : -1;

        // Strip border-radius: no rounding on calendar edge sides
        const stripBR = rangeStart >= 0
          ? `${rangeStart === 0 ? 0 : 4}px ${rangeEnd === 6 ? 0 : 4}px ${rangeEnd === 6 ? 0 : 4}px ${rangeStart === 0 ? 0 : 4}px`
          : '0';

        return (
          <div
            key={rowIdx}
            style={{ position: 'relative', marginBottom: 2 }}
          >
            {/* Range highlight strip — percentage-based to match 1fr grid */}
            {rangeStart >= 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${(rangeStart / 7) * 100}%`,
                  width: `${((rangeEnd - rangeStart + 1) / 7) * 100}%`,
                  height: 28,
                  background: 'rgba(245,158,11,0.05)',
                  borderRadius: stripBR,
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              />
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {row.map((day, colIdx) => {
                if (day === null) {
                  return (
                    <div
                      key={`pad-${rowIdx}-${colIdx}`}
                      style={{ height: 28 }}
                    />
                  );
                }

                const dateStr = toDateString(new Date(viewYear, viewMonth, day));
                const isInRange  = dateStr >= startDate && dateStr <= endDate;
                const isSelected = dateStr === selectedDate;
                const isToday    = dateStr === todayStr;
                const types      = typesByDate[dateStr] ?? [];
                const actCount   = types.length;
                const visibleTypes = types.slice(0, 4);
                const hasMore    = actCount > 4;

                let cellBg = 'transparent';
                if (isSelected) cellBg = 'rgb(245,158,11)';
                else if (isInRange) cellBg = 'rgba(255,255,255,0.04)';

                const dayColor = isSelected
                  ? '#0a0a0a'
                  : isInRange
                  ? 'rgba(255,255,255,0.8)'
                  : 'rgba(255,255,255,0.15)';

                return (
                  <div
                    key={dateStr}
                    onClick={() => isInRange && onSelectDate(dateStr)}
                    style={{
                      height: 28,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      cursor: isInRange ? 'pointer' : 'default',
                      background: cellBg,
                      position: 'relative',
                      transition: 'background 150ms',
                      boxShadow: isToday && !isSelected
                        ? 'inset 0 0 0 1px rgba(255,255,255,0.18)'
                        : undefined,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: 'var(--font-sora)',
                        fontWeight: isSelected ? 700 : 500,
                        color: dayColor,
                        lineHeight: 1,
                      }}
                    >
                      {day}
                    </span>

                    {/* Colored activity dots */}
                    {actCount > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 2,
                          marginTop: 2,
                        }}
                      >
                        {hasMore ? (
                          <>
                            {visibleTypes.slice(0, 3).map((type, di) => (
                              <div
                                key={di}
                                style={{
                                  width: 3,
                                  height: 3,
                                  borderRadius: '50%',
                                  background: isSelected
                                    ? 'rgba(10,10,10,0.5)'
                                    : (TYPE_COLORS[type] ?? '#f59e0b'),
                                }}
                              />
                            ))}
                            <span
                              style={{
                                fontSize: 6,
                                lineHeight: '3px',
                                color: isSelected ? 'rgba(10,10,10,0.5)' : 'rgba(255,255,255,0.35)',
                              }}
                            >
                              ···
                            </span>
                          </>
                        ) : (
                          visibleTypes.map((type, di) => (
                            <div
                              key={di}
                              style={{
                                width: 3,
                                height: 3,
                                borderRadius: '50%',
                                background: isSelected
                                  ? 'rgba(10,10,10,0.5)'
                                  : (TYPE_COLORS[type] ?? '#f59e0b'),
                              }}
                            />
                          ))
                        )}
                      </div>
                    )}

                    {/* Today indicator dot */}
                    {isToday && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 2,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 3,
                          height: 3,
                          borderRadius: '50%',
                          background: isSelected ? 'rgba(10,10,10,0.5)' : 'rgb(245,158,11)',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
