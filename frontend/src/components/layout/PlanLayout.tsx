'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useTripStore } from '@/store/tripStore'
import { createClient } from '@/lib/supabase'
import { loadTrip } from '@/lib/loadTrip'
import { SESSION_KEYS } from '@/lib/sessionKeys'
import ChatInterface from '@/components/chat/ChatInterface'
import IconTabRail from '@/components/layout/IconTabRail'
import TripCalendar from '@/components/layout/TripCalendar'
import DayPulseOverview from '@/components/layout/DayPulseOverview'
import ItineraryTab from '@/components/tabs/ItineraryTab'
import MapTab from '@/components/tabs/MapTab'
import WeatherTab from '@/components/tabs/WeatherTab'
import BudgetTab from '@/components/tabs/BudgetTab'
import MetaColumn from '@/components/layout/MetaColumn'
import TripSidebar from './TripSidebar'

const BUTTON_CLASS =
  'w-8 h-8 rounded-full bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 hover:text-amber-400 hover:border-amber-500/30 transition-colors duration-150 backdrop-blur-sm flex items-center justify-center pointer-events-auto'

interface PlanLayoutProps {
  userId: string
}

export default function PlanLayout({ userId }: PlanLayoutProps) {
  const {
    layoutMode, setLayoutMode, setIsTransitioning,
    activeTab,
    selectedDate, setSelectedDate,
  } = useUIStore()
  const tripPlan = useTripStore((s) => s.tripPlan)
  const planItems = useTripStore((s) => s.planItems)
  const setActiveLoadId = useTripStore((s) => s.setActiveLoadId)
  const setActiveTrip = useTripStore((s) => s.setActiveTrip)

  const [isBootstrapping, setIsBootstrapping] = useState(true)

  useEffect(() => {
    let cancelled = false
    const activeTripId =
      typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_KEYS.ACTIVE_TRIP_ID) : null

    if (!activeTripId) {
      // Fast path: nothing to bootstrap, immediately transition out of the
      // loading placeholder. Intentional sync setState — no network work needed.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsBootstrapping(false)
      return
    }

    const bootstrapLoadId = `bootstrap:${activeTripId}`
    setActiveLoadId(bootstrapLoadId)

    const supabase = createClient()
    loadTrip(supabase, activeTripId, userId)
      .then((result) => {
        if (cancelled) return
        // A user-initiated trip click superseded bootstrap — clear spinner, don't overwrite store.
        if (useTripStore.getState().activeLoadId !== bootstrapLoadId) {
          setIsBootstrapping(false)
          return
        }
        if (result) {
          setActiveTrip({ tripPlan: result.tripPlan, planItems: result.planItems })
          setLayoutMode('split')
        } else if (typeof window !== 'undefined') {
          sessionStorage.removeItem(SESSION_KEYS.ACTIVE_TRIP_ID)
        }
        setIsBootstrapping(false)
      })
      .catch((err) => {
        console.error('[PlanLayout] bootstrap load failed:', err)
        if (cancelled) return
        if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEYS.ACTIVE_TRIP_ID)
        setIsBootstrapping(false)
      })

    return () => { cancelled = true }
  }, [userId, setActiveLoadId, setActiveTrip, setLayoutMode])

  useEffect(() => {
    setIsTransitioning(true)
  }, [layoutMode, setIsTransitioning])

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: '#0c0f16',
        flexDirection: 'row',
      }}
    >
      <TripSidebar userId={userId} />

      {isBootstrapping ? (
        <div
          style={{
            flex: 1, minWidth: 0, height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#0c0f16',
          }}
        >
          <motion.div
            animate={{ opacity: [0.3, 0.85, 0.3], scale: [0.9, 1.1, 0.9] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 10, height: 10,
              borderRadius: '50%',
              background: 'rgb(6,182,212)',
              boxShadow: '0 0 14px rgba(6,182,212,0.7)',
            }}
          />
        </div>
      ) : (
        <div
          style={{
            flex: 1, minWidth: 0, height: '100%',
            display: 'flex', flexDirection: 'row',
            overflow: 'hidden',
          }}
        >
          <div
            className={layoutMode === 'split' ? 'relative border-r border-zinc-800/50' : 'relative'}
            style={
              layoutMode === 'discovery'
                ? { flex: 1, minWidth: 0, transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }
                : { width: 440, minWidth: 440, flexShrink: 0, transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }
            }
          >
            <ChatInterface />
            {layoutMode === 'discovery' && (
              <button
                onClick={() => setLayoutMode('split')}
                className={`absolute top-3 right-3 z-50 ${BUTTON_CLASS}`}
              >
                <PanelRightOpen size={14} />
              </button>
            )}
            {layoutMode === 'split' && (
              <button
                onClick={() => setLayoutMode('discovery')}
                className={`absolute top-1/2 -translate-y-1/2 z-10 ${BUTTON_CLASS}`}
                style={{ right: -16 }}
              >
                <PanelRightClose size={14} />
              </button>
            )}
          </div>

          <AnimatePresence>
            {layoutMode === 'split' && (
              <motion.div
                style={{ display: 'flex', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
                onAnimationComplete={() => setIsTransitioning(false)}
              >
                <IconTabRail />

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    display: 'grid',
                    gridTemplateRows: '40% 1fr',
                    gap: 12,
                    padding: 12,
                    minHeight: 0,
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '3.5fr 6.5fr',
                      gap: 12,
                      minHeight: 0,
                    }}>
                      <motion.div
                        style={{ minWidth: 0, minHeight: 0, height: '100%' }}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.0, ease: [0.22, 1, 0.36, 1] }}
                      >
                        {tripPlan ? (
                          <TripCalendar
                            tripStartDate={tripPlan.start_date}
                            tripEndDate={tripPlan.end_date}
                            planItems={planItems}
                            selectedDate={selectedDate}
                            onSelectDate={setSelectedDate}
                          />
                        ) : (
                          <div style={{
                            background: 'rgba(6,182,212,0.03)',
                            border: '1px solid rgba(6,182,212,0.1)',
                            borderRadius: 12,
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: 'var(--font-sora)',
                            fontSize: 13,
                            color: 'rgba(255,255,255,0.3)',
                          }}>
                            No trip loaded
                          </div>
                        )}
                      </motion.div>

                      <motion.div
                        style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <DayPulseOverview selectedDate={selectedDate} planItems={planItems} />
                      </motion.div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '6fr 4fr',
                      gap: 12,
                      minHeight: 0,
                    }}>
                      <motion.div
                        style={{ minWidth: 0, minHeight: 0, overflow: 'auto', position: 'relative' }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            style={{ height: '100%' }}
                          >
                            {activeTab === 'itinerary' && <ItineraryTab />}
                            {activeTab === 'map' && <MapTab />}
                            {activeTab === 'weather' && <WeatherTab />}
                            {activeTab === 'budget' && <BudgetTab />}
                            {activeTab === 'score' && (
                              <div style={{
                                height: '100%',
                                background: 'rgba(6,182,212,0.03)',
                                border: '1px solid rgba(6,182,212,0.1)',
                                borderRadius: 12,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: 'var(--font-sora)',
                                fontSize: 14,
                                color: 'rgba(6,182,212,0.6)',
                              }}>
                                Score tab
                              </div>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </motion.div>

                      <motion.div
                        style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <MetaColumn />
                      </motion.div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
