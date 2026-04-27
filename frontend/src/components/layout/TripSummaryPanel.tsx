'use client'

import { motion } from 'framer-motion'
import { TripPlan, PlanItem } from '@/store/tripStore'

interface TripSummaryPanelProps {
  tripPlan: TripPlan | null
  planItems: PlanItem[]
  onScoreClick: () => void
}

// Replace this export when real scoring logic is wired up
export const PLACEHOLDER_SCORE = 72

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
  JPY: '¥',
}

function getCurrencySymbol(code: string) {
  return CURRENCY_SYMBOLS[code] ?? `${code} `
}

function formatDateRange(start: string, end: string) {
  const startDate = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '—'
  const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  return `${fmt.format(startDate)} – ${fmt.format(endDate)} · ${diffDays} day${diffDays !== 1 ? 's' : ''}`
}

export default function TripSummaryPanel({ tripPlan, planItems, onScoreClick }: TripSummaryPanelProps) {
  const score = PLACEHOLDER_SCORE
  const scoreAngle = (score / 100) * 360

  if (!tripPlan) {
    return (
      <div
        style={{
          background: 'rgba(6,182,212,0.03)',
          border: '1px solid rgba(6,182,212,0.1)',
          borderRadius: 12,
          padding: 20,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          fontFamily: 'var(--font-sora)',
          fontSize: 13,
          color: 'rgba(255,255,255,0.3)',
        }}
      >
        No trip loaded
      </div>
    )
  }

  const totalCost = planItems.reduce((sum, item) => sum + (item.cost_estimate ?? 0), 0)
  const currency = planItems[0]?.currency ?? 'USD'
  const costDisplay = planItems.length > 0
    ? `${getCurrencySymbol(currency)}${totalCost.toLocaleString()}`
    : '—'

  return (
    <div
      style={{
        background: 'rgba(6,182,212,0.03)',
        border: '1px solid rgba(6,182,212,0.1)',
        borderRadius: 12,
        padding: 20,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Destination + date range */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontFamily: 'var(--font-sora)', fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,0.9)', lineHeight: 1.2 }}>
          {tripPlan.destination}
        </span>
        <span style={{ fontFamily: 'var(--font-sora)', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>
          {formatDateRange(tripPlan.start_date, tripPlan.end_date)}
        </span>
      </div>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { label: 'ACTIVITIES', value: String(planItems.length) },
          { label: 'TOTAL COST', value: costDisplay },
          { label: 'TRAVELERS', value: String(tripPlan.number_of_travelers ?? 1) },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <span style={{ fontFamily: 'var(--font-sora)', fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
              {label}
            </span>
            <span style={{ fontFamily: 'var(--font-sora)', fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

      {/* Score badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Circular badge */}
        <motion.div
          onClick={onScoreClick}
          whileHover={{ boxShadow: '0 0 24px rgba(245,158,11,0.3)' }}
          style={{
            width: 68,
            height: 68,
            borderRadius: '50%',
            flexShrink: 0,
            position: 'relative',
            cursor: 'pointer',
            background: `conic-gradient(rgb(245,158,11) 0deg ${scoreAngle}deg, rgba(245,158,11,0.08) ${scoreAngle}deg 360deg)`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 4,
              borderRadius: '50%',
              background: '#0c0f16',
              border: '1px solid rgba(245,158,11,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontFamily: 'var(--font-sora)', fontSize: 20, fontWeight: 700, color: 'rgb(245,158,11)' }}>
              {score}
            </span>
          </div>
        </motion.div>

        {/* Score labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: 'var(--font-sora)', fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
            TRIP SCORE
          </span>
          <span style={{ fontFamily: 'var(--font-sora)', fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
            {score} / 100
          </span>
          <button
            type="button"
            onClick={onScoreClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onScoreClick() } }}
            style={{
              fontFamily: 'var(--font-sora)',
              fontSize: 11,
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: 0,
              textAlign: 'left',
            }}
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500/60 focus-visible:rounded"
          >
            View details →
          </button>
        </div>
      </div>
    </div>
  )
}
