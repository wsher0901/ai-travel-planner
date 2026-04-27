'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { PanelLeft, PanelLeftClose, Plus } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useTripsIndexStore } from '@/store/tripsIndexStore'
import { useTripStore } from '@/store/tripStore'
import { useChatStore } from '@/store/chatStore'
import { createClient } from '@/lib/supabase'
import { SESSION_KEYS } from '@/lib/sessionKeys'
import TripRow from './TripRow'

interface Props {
  userId: string
}

const WIDTH_EXPANDED = 240
const WIDTH_COLLAPSED = 48
const EASE = [0.22, 1, 0.36, 1] as const

export default function TripSidebar({ userId }: Props) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggle = useUIStore((s) => s.toggleSidebar)
  const setLayoutMode = useUIStore((s) => s.setLayoutMode)

  const trips = useTripsIndexStore((s) => s.trips)
  const loading = useTripsIndexStore((s) => s.loading)
  const fetchTrips = useTripsIndexStore((s) => s.fetchTrips)
  const addTripToIndex = useTripsIndexStore((s) => s.addTripToIndex)
  const removeTripFromIndex = useTripsIndexStore((s) => s.removeTripFromIndex)
  const upsertTripInIndex = useTripsIndexStore((s) => s.upsertTripInIndex)

  const activeTripId = useTripStore((s) => s.tripPlan?.id ?? null)
  const clearTrip = useTripStore((s) => s.clearTrip)
  const clearMessages = useChatStore((s) => s.clearMessages)
  const setSessionId = useChatStore((s) => s.setSessionId)

  const loadControllerRef = useRef<AbortController | null>(null)
  const startLoad = useCallback((): AbortController => {
    loadControllerRef.current?.abort()
    const controller = new AbortController()
    loadControllerRef.current = controller
    return controller
  }, [])

  const [openMenuTripId, setOpenMenuTripId] = useState<string | null>(null)
  const [hideOnMobile, setHideOnMobile] = useState(false)
  const [btnHover, setBtnHover] = useState(false)

  useEffect(() => {
    fetchTrips(userId)
  }, [userId, fetchTrips])

  useEffect(() => {
    if (!openMenuTripId) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-menu-root]')) return
      setOpenMenuTripId(null)
    }
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuTripId])

  useEffect(() => {
    if (!openMenuTripId) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpenMenuTripId(null)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [openMenuTripId])

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`trip_plans:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_plans', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as {
            id: string; destination: string;
            start_date: string | null; end_date: string | null; created_at: string;
          }
          addTripToIndex({
            id: row.id,
            destination: row.destination,
            start_date: row.start_date,
            end_date: row.end_date,
            created_at: row.created_at,
            item_count: 0,
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'trip_plans', filter: `user_id=eq.${userId}` },
        (payload) => {
          const id = (payload.old as { id?: string }).id
          if (id) removeTripFromIndex(id)
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trip_plans', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as {
            id: string; destination?: string;
            start_date?: string | null; end_date?: string | null;
          }
          upsertTripInIndex({
            id: row.id,
            destination: row.destination,
            start_date: row.start_date ?? null,
            end_date: row.end_date ?? null,
          })
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[TripSidebar] realtime subscription error')
        }
      })
    return () => { supabase.removeChannel(channel) }
  }, [userId, addTripToIndex, removeTripFromIndex, upsertTripInIndex])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = () => setHideOnMobile(mq.matches)
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const handleNewPlan = () => {
    clearTrip()
    clearMessages()
    setSessionId(null)
    if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEYS.ACTIVE_TRIP_ID)
    setLayoutMode('discovery')
  }

  if (hideOnMobile) return null

  const width = collapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED

  return (
    <motion.aside
      animate={{ width }}
      transition={{ duration: 0.28, ease: EASE }}
      aria-label="Trips sidebar"
      style={{
        height: '100%',
        width,
        flexShrink: 0,
        position: 'relative',
        background: 'rgba(12,15,22,0.98)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(6,182,212,0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(6,182,212,1) 1px, transparent 1px)',
          backgroundSize: '12px 12px',
          opacity: 0.04,
          pointerEvents: 'none',
        }}
      />

      <div style={{
        position: 'relative',
        height: 56,
        flexShrink: 0,
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? 0 : '0 12px',
        borderBottom: '1px solid rgba(6,182,212,0.08)',
      }}>
        {!collapsed && (
          <span style={{
            fontFamily: 'var(--font-sora)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.14em',
            color: 'rgba(255,255,255,0.55)',
          }}>
            ROAM
          </span>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28,
            borderRadius: 6,
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.55)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <div style={{
        position: 'relative',
        padding: collapsed ? '8px 0 4px' : '12px 12px 8px',
        display: 'flex', justifyContent: 'center',
      }}>
        <button
          type="button"
          onClick={handleNewPlan}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => setBtnHover(false)}
          aria-label="Start a new plan"
          style={{
            width: collapsed ? 32 : '100%',
            height: collapsed ? 32 : 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: collapsed ? 0 : 6,
            padding: collapsed ? 0 : '0 14px',
            borderRadius: 8,
            border: '1px solid rgba(245,158,11,0.5)',
            background: btnHover
              ? 'linear-gradient(180deg, rgba(245,158,11,0.35) 0%, rgba(245,158,11,0.18) 100%)'
              : 'linear-gradient(180deg, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0.12) 100%)',
            boxShadow: btnHover ? '0 0 16px rgba(245,158,11,0.3)' : 'none',
            color: 'rgb(245,158,11)',
            fontFamily: 'var(--font-sora)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 160ms ease, box-shadow 160ms ease',
          }}
        >
          <Plus size={14} strokeWidth={2.4} />
          {!collapsed && <span>New Plan</span>}
        </button>
      </div>

      {!collapsed && (
        <div style={{
          padding: '16px 12px 8px',
          fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'var(--font-sora)',
        }}>
          RECENT
        </div>
      )}

      <div style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>
        {loading && trips.length === 0 ? (
          collapsed ? null : (
            <>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={`skeleton-${i}`}
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.12 }}
                  style={{
                    height: 56,
                    background: 'rgba(255,255,255,0.03)',
                    borderBottom: '1px solid rgba(6,182,212,0.06)',
                  }}
                />
              ))}
            </>
          )
        ) : trips.length === 0 ? (
          collapsed ? null : (
            <div style={{
              padding: '24px 16px',
              fontSize: 11,
              color: 'rgba(255,255,255,0.3)',
              fontFamily: 'var(--font-sora)',
              lineHeight: 1.5,
              textAlign: 'center',
            }}>
              No trips yet. Start planning and your history will show here.
            </div>
          )
        ) : (
          trips.map((trip) => (
            <TripRow
              key={trip.id}
              trip={trip}
              active={trip.id === activeTripId}
              userId={userId}
              collapsed={collapsed}
              isMenuOpen={openMenuTripId === trip.id}
              onMenuOpen={() => setOpenMenuTripId(trip.id)}
              onMenuClose={() => setOpenMenuTripId(null)}
              onStartLoad={startLoad}
            />
          ))
        )}
      </div>

      {!collapsed && (
        <div style={{
          height: 48, flexShrink: 0,
          borderTop: '1px solid rgba(6,182,212,0.08)',
        }} />
      )}
    </motion.aside>
  )
}
