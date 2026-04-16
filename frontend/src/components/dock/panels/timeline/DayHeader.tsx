'use client';

import { motion } from 'framer-motion';

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

interface DayHeaderProps {
  dayNumber: number;
  date: string | null;
  totalCost: number;
  currency: string;
}

export default function DayHeader({ dayNumber, date, totalCost, currency }: DayHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        background: 'rgba(8,8,8,0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Left: diamond + day label + date */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            background: '#f59e0b',
            borderRadius: 2,
            transform: 'rotate(45deg)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.8)',
            fontFamily: 'var(--font-sora)',
          }}
        >
          Day {dayNumber}
        </span>
        {date && (
          <span
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.35)',
              fontFamily: 'var(--font-sora)',
            }}
          >
            — {formatDate(date)}
          </span>
        )}
      </div>

      {/* Right: total cost */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'var(--font-sora)',
        }}
      >
        {formatCost(totalCost, currency)}
      </span>
    </motion.div>
  );
}
