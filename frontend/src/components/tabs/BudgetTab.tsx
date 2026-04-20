'use client'

import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { useTripStore } from '@/store/tripStore'
import { useUIStore } from '@/store/uiStore'
import { getActivityColor } from '@/lib/activityColors'

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', JPY: '¥' }

function formatCost(amount: number, currency: string) {
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `
  return `${sym}${amount.toLocaleString()}`
}

function parseBudgetCap(budgetRange: string | null | undefined): number | null {
  if (!budgetRange) return null
  try {
    const parsed = JSON.parse(budgetRange)
    if (typeof parsed?.max === 'number') return parsed.max
  } catch {
    // not JSON
  }
  return null
}

export default function BudgetTab() {
  const { tripPlan, planItems } = useTripStore()
  const { setSelectedDate, setActiveTab } = useUIStore()

  const currency = planItems[0]?.currency ?? 'USD'

  const stats = useMemo(() => {
    if (!tripPlan || planItems.length === 0) return null

    const totalBudget = planItems.reduce((s, i) => s + (i.cost_estimate ?? 0), 0)
    const budgetCap = parseBudgetCap(tripPlan.budget_range)
    const startDate = new Date(tripPlan.start_date + 'T00:00:00')
    const endDate = new Date(tripPlan.end_date + 'T00:00:00')
    const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const avgPerDay = totalDays > 0 ? totalBudget / totalDays : 0

    const categoryMap = new Map<string, { total: number; count: number }>()
    for (const item of planItems) {
      const entry = categoryMap.get(item.activity_type) ?? { total: 0, count: 0 }
      entry.total += item.cost_estimate ?? 0
      entry.count += 1
      categoryMap.set(item.activity_type, entry)
    }
    const byCategory = Array.from(categoryMap.entries())
      .map(([type, { total, count }]) => ({ type, total, count }))
      .sort((a, b) => b.total - a.total)

    const dayMap = new Map<string, { total: number; count: number }>()
    for (const item of planItems) {
      if (!item.date) continue
      const entry = dayMap.get(item.date) ?? { total: 0, count: 0 }
      entry.total += item.cost_estimate ?? 0
      entry.count += 1
      dayMap.set(item.date, entry)
    }
    const byDay = Array.from(dayMap.entries())
      .map(([date, { total, count }]) => ({ date, total, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return { totalBudget, budgetCap, totalDays, avgPerDay, byCategory, byDay }
  }, [tripPlan, planItems])

  if (!tripPlan) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-sora)', fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>No trip loaded</span>
      </div>
    )
  }

  if (!stats || planItems.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-sora)', fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>No activities to budget for</span>
      </div>
    )
  }

  const { totalBudget, budgetCap, totalDays, avgPerDay, byCategory, byDay } = stats
  const capPct = budgetCap ? Math.min((totalBudget / budgetCap) * 100, 100) : 0
  const overBudget = budgetCap ? totalBudget > budgetCap : false
  const gaugeColor = overBudget ? 'rgb(239,68,68)' : 'rgb(245,158,11)'
  const maxDayTotal = Math.max(...byDay.map(d => d.total), 1)

  const CARD_STYLE = {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between' as const,
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
      {/* Section 1: Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr', gap: 12, height: 120, flexShrink: 0 }}>
        {[
          { label: 'TOTAL BUDGET', value: formatCost(totalBudget, currency), sub: `${planItems.length} activities` },
          { label: 'AVG / DAY', value: formatCost(Math.round(avgPerDay), currency), sub: `${totalDays} days` },
          { label: 'CATEGORIES', value: String(byCategory.length), sub: 'activity types' },
        ].map(({ label, value, sub }) => (
          <div key={label} style={CARD_STYLE}>
            <span style={{ fontFamily: 'var(--font-sora)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)' }}>{label}</span>
            <span style={{ fontFamily: 'var(--font-sora)', fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
            <span style={{ fontFamily: 'var(--font-sora)', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>{sub}</span>
          </div>
        ))}
        {/* Budget gauge card */}
        <div style={CARD_STYLE}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-sora)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)' }}>BUDGET USAGE</span>
            <span style={{ fontFamily: 'var(--font-sora)', fontSize: 10, color: budgetCap ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)' }}>
              {budgetCap ? `${formatCost(totalBudget, currency)} / ${formatCost(budgetCap, currency)}` : 'No cap set'}
            </span>
          </div>
          {budgetCap ? (
            <>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${capPct}%`, borderRadius: 4, background: gaugeColor, transition: 'width 400ms ease' }} />
              </div>
              <span style={{ fontFamily: 'var(--font-sora)', fontSize: 11, fontWeight: 600, color: gaugeColor }}>
                {Math.round(capPct)}%
              </span>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-sora)', fontSize: 11, fontStyle: 'italic', color: 'rgba(255,255,255,0.3)' }}>Set a budget cap to track usage</span>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Category breakdown */}
      <div style={{ background: 'rgba(6,182,212,0.03)', border: '1px solid rgba(6,182,212,0.08)', borderRadius: 12, padding: 20, flexShrink: 0 }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-sora)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
          By Category
        </span>
        {byCategory.map(({ type, total, count }) => {
          const color = getActivityColor(type)
          const barWidth = totalBudget > 0 ? (total / totalBudget) * 100 : 0
          return (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 160, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, boxShadow: `0 0 8px ${color}66`, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-sora)', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.8)', textTransform: 'capitalize' }}>{type}</span>
                <span style={{ fontFamily: 'var(--font-sora)', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>({count})</span>
              </div>
              <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.04)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${barWidth}%`, borderRadius: 5, backgroundColor: color, opacity: 0.8, transition: 'width 400ms ease' }} />
              </div>
              <span style={{ fontFamily: 'var(--font-sora)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', width: 70, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {formatCost(total, currency)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Section 3: Per-day spending */}
      <div style={{ background: 'rgba(6,182,212,0.03)', border: '1px solid rgba(6,182,212,0.08)', borderRadius: 12, padding: 20, flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--font-sora)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>Per Day</span>
          <span style={{ fontFamily: 'var(--font-sora)', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Click a day to view activities →</span>
        </div>
        {byDay.map(({ date, total, count }) => {
          const dateObj = new Date(date + 'T00:00:00')
          const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
          const dayMonth = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
          const barWidth = (total / maxDayTotal) * 100

          return (
            <div
              key={date}
              onClick={() => { setSelectedDate(date); setActiveTab('itinerary') }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement
                el.style.backgroundColor = 'rgba(6,182,212,0.05)'
                el.style.borderColor = 'rgba(6,182,212,0.1)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement
                el.style.backgroundColor = 'rgba(255,255,255,0.02)'
                el.style.borderColor = 'rgba(255,255,255,0.04)'
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 6, cursor: 'pointer', transition: 'background-color 150ms, border-color 150ms' }}
            >
              <div style={{ width: 100, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: 'var(--font-sora)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)' }}>{weekday}</span>
                <span style={{ fontFamily: 'var(--font-sora)', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{dayMonth}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ height: 8, borderRadius: 5, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barWidth}%`, borderRadius: 5, background: 'rgba(245,158,11,0.7)', transition: 'width 400ms ease' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-sora)', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{count} activities</span>
              </div>
              <span style={{ fontFamily: 'var(--font-sora)', fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {formatCost(total, currency)}
              </span>
              <ChevronRight size={14} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0 }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
