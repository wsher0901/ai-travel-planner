'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useTripStore } from '@/store/tripStore';
import ActivityList from './itinerary/ActivityList';
import AddActivityDialog from './itinerary/AddActivityDialog';
import ScrollArea, { type ScrollAreaHandle } from '@/components/ui/ScrollArea';

function formatDayLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// Shared slide variant config — avoids duplication between header and list AnimatePresence
const slideVariants = {
  enter: (direction: number) => ({ x: direction * 120, opacity: 0.2 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction * -120, opacity: 0 }),
};

const slideTransition = {
  x: { duration: 0.44, ease: [0.4, 0, 0.2, 1] as const },
  opacity: { duration: 0.22, ease: 'easeOut' as const },
};

export default function ItineraryTab() {
  const selectedDate = useUIStore((s) => s.selectedDate);
  const dateChangeDirection = useUIStore((s) => s.dateChangeDirection);
  const setItineraryScrollHandle = useUIStore((s) => s.setItineraryScrollHandle);
  const { tripPlan, planItems } = useTripStore();
  const [addOpen, setAddOpen] = useState(false);
  const scrollAreaRef = useRef<ScrollAreaHandle | null>(null);

  const handleScrollAreaRef = useCallback((handle: ScrollAreaHandle | null) => {
    if (handle) {
      scrollAreaRef.current = handle;
      setItineraryScrollHandle(handle);
    }
  }, [setItineraryScrollHandle]);

  useEffect(() => {
    return () => {
      setItineraryScrollHandle(null);
    };
  }, [setItineraryScrollHandle]);

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
          <div style={{
            position: 'relative',
            overflow: 'hidden',
            minWidth: 320,
            height: 22,
          }}>
            <AnimatePresence mode="sync" custom={dateChangeDirection} initial={false}>
              <motion.div
                key={selectedDate ?? 'no-date'}
                custom={dateChangeDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={slideTransition}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  whiteSpace: 'nowrap',
                }}
              >
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
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <motion.button
          onClick={() => setAddOpen(true)}
          whileHover={{
            backgroundColor: 'rgba(6,182,212,0.15)',
            borderColor: 'rgba(6,182,212,0.45)',
          }}
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
          }}
        >
          <Plus size={12} />
          Add activity
        </motion.button>
      </div>

      {/* Activity list */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence mode="sync" custom={dateChangeDirection} initial={false}>
          <motion.div
            key={selectedDate ?? 'no-date-list'}
            custom={dateChangeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            style={{
              position: 'absolute',
              inset: 0,
            }}
          >
            <ScrollArea ref={handleScrollAreaRef} style={{ width: '100%', height: '100%' }}>
              <ActivityList key={selectedDate ?? 'no-date'} dayItems={dayItems} selectedDate={selectedDate} tripPlan={tripPlan} />
            </ScrollArea>
          </motion.div>
        </AnimatePresence>
      </div>

      <AddActivityDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        selectedDate={selectedDate}
      />
    </div>
  );
}
