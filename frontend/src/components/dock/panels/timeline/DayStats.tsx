'use client';

import { motion } from 'framer-motion';
import { type PlanItem } from '@/store/tripStore';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
  JPY: '¥',
};

function formatCost(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  return `${symbol}${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
}

function formatMinutes(total: number): string {
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface StatCardProps {
  label: string;
  value: string;
  empty?: boolean;
}

function StatCard({ label, value, empty = false }: StatCardProps) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.25)',
          fontFamily: 'var(--font-sora)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: empty ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.85)',
          fontFamily: 'var(--font-sora)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

interface DayStatsProps {
  items: PlanItem[];
  currency: string;
}

export default function DayStats({ items, currency }: DayStatsProps) {
  const isEmpty = items.length === 0;

  const activityCount = items.length;
  const totalCost = items.reduce((sum, item) => sum + (item.cost_estimate ?? 0), 0);
  const totalMinutes = items.reduce((sum, item) => sum + (item.duration_minutes ?? 0), 0);

  // Re-animate when the day changes by keying on first item's date
  const animationKey = items[0]?.date ?? 'empty';

  return (
    <motion.div
      key={animationKey}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <StatCard
        label="Activities"
        value={isEmpty ? '—' : String(activityCount)}
        empty={isEmpty}
      />
      <StatCard
        label="Estimated Cost"
        value={isEmpty ? '—' : formatCost(totalCost, currency)}
        empty={isEmpty}
      />
      <StatCard
        label="Planned Time"
        value={isEmpty ? '—' : formatMinutes(totalMinutes)}
        empty={isEmpty}
      />
    </motion.div>
  );
}
