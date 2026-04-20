'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useTripStore } from '@/store/tripStore';
import ActivityList from './itinerary/ActivityList';
import AddActivityDialog from './itinerary/AddActivityDialog';

function formatDayLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function ItineraryTab() {
  const { selectedDate } = useUIStore();
  const { tripPlan, planItems } = useTripStore();
  const [addOpen, setAddOpen] = useState(false);

  const dayItems = useMemo(() => {
    if (!selectedDate) return [];
    return planItems.filter((i) => i.date?.slice(0, 10) === selectedDate);
  }, [planItems, selectedDate]);

  const dayNumber = useMemo(() => {
    if (!selectedDate) return 1;
    const item = planItems.find((i) => i.date?.slice(0, 10) === selectedDate);
    return item?.day_number ?? 1;
  }, [planItems, selectedDate]);

  const dayStats = useMemo(() => {
    const count = dayItems.length;
    const totalCost = dayItems.reduce((s, i) => s + (i.cost_estimate ?? 0), 0);
    return { count, totalCost };
  }, [dayItems]);

  if (!selectedDate || !tripPlan) {
    return (
      <div style={{
        height: '100%',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sora)',
        fontSize: 13,
        color: 'rgba(255,255,255,0.3)',
      }}>
        Select a date to view itinerary
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 14,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{
            fontSize: 13, fontWeight: 600, letterSpacing: '0.08em',
            color: 'rgb(245,158,11)', fontFamily: 'var(--font-sora)',
          }}>
            DAY {dayNumber}
          </span>
          <span style={{
            fontSize: 20, fontWeight: 600,
            color: 'rgba(255,255,255,0.9)',
            fontFamily: 'var(--font-sora)',
          }}>
            {formatDayLabel(selectedDate)}
          </span>
          <span style={{
            fontSize: 13, fontWeight: 500,
            color: 'rgba(255,255,255,0.4)',
            fontFamily: 'var(--font-sora)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            · {dayStats.count} activities · ${dayStats.totalCost}
          </span>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(6,182,212,0.08)',
            border: '1px solid rgba(6,182,212,0.25)',
            borderRadius: 8,
            padding: '6px 12px',
            color: 'rgb(6,182,212)',
            fontSize: 12, fontWeight: 500,
            fontFamily: 'var(--font-sora)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(6,182,212,0.15)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(6,182,212,0.45)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(6,182,212,0.08)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(6,182,212,0.25)';
          }}
        >
          <Plus size={12} />
          Add activity
        </button>
      </div>

      {/* Activity list */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <ActivityList dayItems={dayItems} selectedDate={selectedDate} tripPlan={tripPlan} />
      </div>

      {selectedDate && (
        <AddActivityDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}
