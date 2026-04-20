'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import { User, Sparkles } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useTripStore } from '@/store/tripStore';

const RADAR_DATA = [
  { axis: 'Budget', value: 78 },
  { axis: 'Pace', value: 65 },
  { axis: 'Variety', value: 82 },
  { axis: 'Walk', value: 60 },
  { axis: 'Cover', value: 70 },
  { axis: 'Culture', value: 75 },
];

const PLACEHOLDER_SCORE = 72;
const PLACEHOLDER_DELTA = 5;

interface ChangeEntry {
  actor: 'H' | 'AI';
  text: string;
  timestamp: string;
}

const PLACEHOLDER_CHANGES: ChangeEntry[] = [
  { actor: 'H', text: 'Added Griffith Observatory', timestamp: '2m' },
  { actor: 'AI', text: 'Shifted lunch to 2:00 PM', timestamp: '5m' },
  { actor: 'H', text: 'Removed Santa Monica Pier', timestamp: '12m' },
  { actor: 'AI', text: 'Suggested Food Tour', timestamp: '18m' },
  { actor: 'H', text: 'Set budget to $250/day', timestamp: '25m' },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', JPY: '¥',
};

export default function MetaColumn() {
  const { selectedDate } = useUIStore();
  const { tripPlan, planItems } = useTripStore();

  const dayFacts = useMemo(() => {
    if (!selectedDate) return { count: 0, cost: 0, budgetMax: 0 };
    const items = planItems.filter((i) => i.date?.slice(0, 10) === selectedDate);
    const cost = items.reduce((s, i) => s + (i.cost_estimate ?? 0), 0);
    const budgetMax = (tripPlan?.budget_range as { max?: number } | undefined)?.max ?? 0;
    const daysTotal = tripPlan
      ? Math.max(1, Math.round(
          (new Date(tripPlan.end_date).getTime() - new Date(tripPlan.start_date).getTime()) / 86400000
        ) + 1)
      : 1;
    const dayBudget = budgetMax > 0 ? Math.round(budgetMax / daysTotal) : 0;
    return { count: items.length, cost, budgetMax: dayBudget };
  }, [planItems, selectedDate, tripPlan]);

  const currency = CURRENCY_SYMBOLS[tripPlan?.currency ?? 'USD'] ?? '$';
  const budgetPct = dayFacts.budgetMax > 0
    ? Math.min(100, (dayFacts.cost / dayFacts.budgetMax) * 100)
    : 0;
  const overBudget = dayFacts.cost > dayFacts.budgetMax && dayFacts.budgetMax > 0;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'rgba(6,182,212,0.03)',
      border: '1px solid rgba(6,182,212,0.15)',
      borderRadius: 12,
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
        color: 'rgba(6,182,212,0.9)',
        fontFamily: 'var(--font-sora)',
        paddingBottom: 6,
        borderBottom: '1px solid rgba(6,182,212,0.12)',
      }}>
        TRIP SCORE & DETAILS
      </div>

      {/* Radar section */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 8,
          padding: '10px 8px 6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}>
        <div style={{ width: '100%', height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={RADAR_DATA} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
              <PolarGrid stroke="rgba(6,182,212,0.2)" strokeWidth={0.6} />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 9, fontFamily: 'var(--font-sora)' }}
              />
              <Radar
                dataKey="value"
                stroke="rgb(245,158,11)"
                strokeWidth={1.5}
                fill="rgba(245,158,11,0.22)"
                dot={{ fill: 'rgb(245,158,11)', r: 2 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{
            fontSize: 22, fontWeight: 700,
            color: 'rgb(245,158,11)',
            fontFamily: 'var(--font-sora)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {PLACEHOLDER_SCORE}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 500,
            color: 'rgba(255,255,255,0.4)',
            fontFamily: 'var(--font-sora)',
          }}>
            / 100
          </span>
          {PLACEHOLDER_DELTA !== 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: PLACEHOLDER_DELTA > 0 ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
              fontFamily: 'var(--font-sora)',
              marginLeft: 2,
            }}>
              {PLACEHOLDER_DELTA > 0 ? '+' : ''}{PLACEHOLDER_DELTA}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 9, fontWeight: 500, letterSpacing: '0.08em',
          color: 'rgba(255,255,255,0.35)',
          fontFamily: 'var(--font-sora)',
        }}>
          TRIP SCORE
        </div>
      </motion.div>

      {/* Day Facts */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 8,
          padding: 10,
        }}>
        <div style={{
          fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
          color: 'rgba(255,255,255,0.35)',
          fontFamily: 'var(--font-sora)',
          marginBottom: 6,
        }}>
          DAY FACTS
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--font-sora)', marginBottom: 3 }}>
          <span>Activities</span>
          <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontVariantNumeric: 'tabular-nums' }}>{dayFacts.count}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--font-sora)', marginBottom: 6 }}>
          <span>Total cost</span>
          <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontVariantNumeric: 'tabular-nums' }}>{currency}{dayFacts.cost}</span>
        </div>
        {dayFacts.budgetMax > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sora)', marginBottom: 4 }}>
              <span>Budget</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{currency}{dayFacts.cost} / {currency}{dayFacts.budgetMax}</span>
            </div>
            <div style={{
              height: 5,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 3,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${budgetPct}%`,
                background: overBudget ? 'rgb(239,68,68)' : 'rgb(245,158,11)',
                borderRadius: 3,
                transition: 'width 300ms ease',
              }} />
            </div>
          </>
        )}
      </motion.div>

      {/* Recent Changes */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.46, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 8,
          padding: 10,
        }}>
        <div style={{
          fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
          color: 'rgba(255,255,255,0.35)',
          fontFamily: 'var(--font-sora)',
          marginBottom: 6,
        }}>
          RECENT CHANGES
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PLACEHOLDER_CHANGES.map((c, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.5 + idx * 0.04 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                color: 'rgba(255,255,255,0.7)',
                fontFamily: 'var(--font-sora)',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 4,
                background: c.actor === 'H' ? 'rgba(6,182,212,0.15)' : 'rgba(245,158,11,0.15)',
                color: c.actor === 'H' ? 'rgb(6,182,212)' : 'rgb(245,158,11)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {c.actor === 'H' ? <User size={10} /> : <Sparkles size={10} />}
              </div>
              <span style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {c.text}
              </span>
              <span style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.3)',
                fontFamily: 'monospace',
                flexShrink: 0,
              }}>
                {c.timestamp}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
