'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreHorizontal, Loader2 } from 'lucide-react'
import { useTripsIndexStore, type TripIndex } from '@/store/tripsIndexStore'
import { useTripStore } from '@/store/tripStore'
import { useUIStore } from '@/store/uiStore'
import { useChatStore } from '@/store/chatStore'
import { createClient } from '@/lib/supabase'
import { loadTrip } from '@/lib/loadTrip'
import { SESSION_KEYS } from '@/lib/sessionKeys'
import { getDestinationGradient } from '@/lib/destinationGradient'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface Props {
  trip: TripIndex
  active: boolean
  userId: string
  collapsed: boolean
  isMenuOpen: boolean
  onMenuOpen: () => void
  onMenuClose: () => void
  onStartLoad: () => AbortController
}

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start || !end) return null
  try {
    const s = new Date(start + 'T00:00:00')
    const e = new Date(end + 'T00:00:00')
    const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
    return `${fmt.format(s)} – ${fmt.format(e)}`
  } catch {
    return null
  }
}

export default function TripRow({ trip, active, userId, collapsed, isMenuOpen, onMenuOpen, onMenuClose, onStartLoad }: Props) {
  const [hovered, setHovered] = useState(false)
  const [loading, setLoading] = useState(false)
  const [menuRect, setMenuRect] = useState<{ left: number; top: number } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  const removeTripFromIndex = useTripsIndexStore((s) => s.removeTripFromIndex)
  const setActiveLoadId = useTripStore((s) => s.setActiveLoadId)
  const setActiveTrip = useTripStore((s) => s.setActiveTrip)
  const clearTrip = useTripStore((s) => s.clearTrip)
  const activeTripId = useTripStore((s) => s.tripPlan?.id ?? null)
  const setLayoutMode = useUIStore((s) => s.setLayoutMode)
  const clearMessages = useChatStore((s) => s.clearMessages)
  const setSessionId = useChatStore((s) => s.setSessionId)

  const gradient = getDestinationGradient(trip.destination)
  const dateRange = formatDateRange(trip.start_date, trip.end_date)

  const handleLoad = useCallback(async () => {
    if (active || loading) return
    const controller = onStartLoad()
    const myLoadId = `${trip.id}:${crypto.randomUUID()}`
    setActiveLoadId(myLoadId)
    setLoading(true)
    try {
      const supabase = createClient()
      const result = await loadTrip(supabase, trip.id, userId, controller.signal)
      if (useTripStore.getState().activeLoadId !== myLoadId) return
      if (!result) {
        console.warn('[TripRow] trip not found or access denied:', trip.id)
        return
      }
      setActiveTrip({ tripPlan: result.tripPlan, planItems: result.planItems })
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SESSION_KEYS.ACTIVE_TRIP_ID, trip.id)
      }
      clearMessages()
      setSessionId(trip.id)
      setLayoutMode('split')
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      console.error('[TripRow] loadTrip failed:', err)
    } finally {
      setLoading(false)
    }
  }, [active, loading, trip.id, userId, onStartLoad, setActiveLoadId, setActiveTrip, setLayoutMode, clearMessages, setSessionId])

  const handleDeleteClick = useCallback(() => {
    onMenuClose()
    setConfirmOpen(true)
  }, [onMenuClose])

  const handleConfirmDelete = useCallback(async () => {
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('trip_plans').delete().eq('id', trip.id)
      if (error) {
        console.error('[TripRow] delete failed:', error)
        return
      }
      removeTripFromIndex(trip.id)
      if (trip.id === activeTripId) {
        clearTrip()
        clearMessages()
        if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEYS.ACTIVE_TRIP_ID)
        setLayoutMode('discovery')
      }
      setConfirmOpen(false)
    } catch (err) {
      console.error('[TripRow] delete error:', err)
    } finally {
      setDeleting(false)
    }
  }, [trip.id, activeTripId, removeTripFromIndex, clearTrip, clearMessages, setLayoutMode])

  const openMenu = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (isMenuOpen) {
      onMenuClose()
      return
    }
    // Initial estimate (3 items × 32px + 2 × 4px padding ≈ 104px); corrected by useLayoutEffect
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuRect({ left: rect.right - 160, top: rect.top - 104 - 6 })
    onMenuOpen()
  }, [isMenuOpen, onMenuOpen, onMenuClose])

  useLayoutEffect(() => {
    if (!isMenuOpen || !popoverRef.current || !menuBtnRef.current) return
    const btnRect = menuBtnRef.current.getBoundingClientRect()
    const popHeight = popoverRef.current.offsetHeight
    const GAP = 6
    const top = btnRect.top - popHeight - GAP < 8
      ? btnRect.bottom + GAP   // not enough room above — fall back to below
      : btnRect.top - popHeight - GAP
    setMenuRect({ left: btnRect.right - 160, top })
  }, [isMenuOpen])

  const handleRowKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleLoad()
    } else if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault()
      handleDeleteClick()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const row = rowRef.current
      if (!row) return
      const siblings = Array.from(
        row.parentElement?.querySelectorAll<HTMLDivElement>('[data-trip-row="true"]') ?? []
      )
      const idx = siblings.indexOf(row)
      if (idx < 0) return
      const next = e.key === 'ArrowDown' ? siblings[idx + 1] : siblings[idx - 1]
      if (next) {
        e.preventDefault()
        next.focus()
      }
    }
  }, [handleLoad, handleDeleteClick])

  if (collapsed) {
    return (
      <motion.button
        type="button"
        onClick={handleLoad}
        whileHover={{ scale: 1.05 }}
        transition={{ duration: 0.14 }}
        title={`${trip.destination}${dateRange ? ` · ${dateRange}` : ''}`}
        style={{
          width: 36, height: 36,
          margin: '4px auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8,
          background: gradient,
          border: 'none',
          cursor: 'pointer',
          boxShadow: active ? '0 0 0 2px rgba(245,158,11,0.75), 0 0 14px rgba(245,158,11,0.45)' : 'none',
          color: 'rgba(255,255,255,0.85)',
          fontFamily: 'var(--font-sora)',
          fontSize: 11, fontWeight: 700,
          padding: 0,
        }}
      >
        {trip.destination.charAt(0).toUpperCase()}
      </motion.button>
    )
  }

  return (
    <>
    <ConfirmDialog
      open={confirmOpen}
      variant="destructive"
      title="Delete this trip?"
      message={`This will permanently delete ${trip.destination}. All activities, plan history, and events will be removed. This cannot be undone.`}
      confirmLabel="Delete"
      loading={deleting}
      onConfirm={handleConfirmDelete}
      onCancel={() => setConfirmOpen(false)}
    />
    <div
      ref={rowRef}
      data-trip-row="true"
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={handleLoad}
      onKeyDown={handleRowKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px 0 14px',
        background: active
          ? 'rgba(245,158,11,0.08)'
          : hovered ? 'rgba(6,182,212,0.06)' : 'transparent',
        borderBottom: '1px solid rgba(6,182,212,0.06)',
        cursor: 'pointer',
        outline: 'none',
        transition: 'background 160ms ease',
      }}
    >
      <motion.div
        animate={{ width: active ? 3 : hovered ? 4 : 3 }}
        transition={{ duration: 0.16 }}
        style={{
          position: 'absolute',
          top: 0, bottom: 0, left: 0,
          background: active ? 'rgb(245,158,11)' : gradient,
          pointerEvents: 'none',
        }}
      />

      <div style={{ flex: 1, minWidth: 0, paddingLeft: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{
          fontSize: 13, fontWeight: 600,
          color: active ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.78)',
          fontFamily: 'var(--font-sora)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {trip.destination}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 500,
          color: active ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.45)',
          fontFamily: 'var(--font-sora)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {loading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, ease: 'linear', repeat: Infinity }}
                style={{ display: 'inline-flex' }}
              >
                <Loader2 size={10} />
              </motion.span>
              Loading…
            </span>
          ) : dateRange ? (
            <>{dateRange} · {trip.item_count} {trip.item_count === 1 ? 'activity' : 'activities'}</>
          ) : (
            <>No dates set</>
          )}
        </div>
      </div>

      <AnimatePresence>
        {hovered && !loading && (
          <motion.button
            ref={menuBtnRef}
            data-menu-root
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.82 }}
            transition={{ duration: 0.14 }}
            onClick={openMenu}
            type="button"
            aria-label="Trip actions"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26,
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <MoreHorizontal size={14} />
          </motion.button>
        )}
      </AnimatePresence>

      {isMenuOpen && menuRect && typeof document !== 'undefined' && createPortal(
        <motion.div
          ref={popoverRef}
          data-menu-root
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.96 }}
          transition={{ duration: 0.14 }}
          style={{
            position: 'fixed',
            left: menuRect.left,
            top: menuRect.top,
            transformOrigin: 'bottom left',
            minWidth: 160,
            background: 'rgba(12,15,22,0.98)',
            border: '1px solid rgba(6,182,212,0.3)',
            borderRadius: 8,
            padding: 4,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
            zIndex: 10000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem label="Rename" disabled tooltip="Coming soon" />
          <MenuItem label="Duplicate" disabled tooltip="Coming soon" />
          <MenuItem
            label="Delete"
            danger
            onClick={handleDeleteClick}
          />
        </motion.div>,
        document.body,
      )}
    </div>
    </>
  )
}

function MenuItem({
  label, disabled, danger, tooltip, onClick,
}: {
  label: string
  disabled?: boolean
  danger?: boolean
  tooltip?: string
  onClick?: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={tooltip}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center',
        width: '100%',
        height: 32,
        padding: '0 12px',
        borderRadius: 4,
        background: hover && !disabled ? 'rgba(6,182,212,0.08)' : 'transparent',
        border: 'none',
        color: disabled
          ? 'rgba(255,255,255,0.3)'
          : danger ? 'rgb(239,68,68)' : 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'var(--font-sora)',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  )
}
