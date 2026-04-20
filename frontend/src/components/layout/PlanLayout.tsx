'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useChatStore } from '@/store/chatStore'
import { useTripStore } from '@/store/tripStore'
import ChatInterface from '@/components/chat/ChatInterface'
import IconTabRail from '@/components/layout/IconTabRail'
import TripCalendar from '@/components/layout/TripCalendar'
import TripSummaryPanel from '@/components/layout/TripSummaryPanel'
import DayPulseOverview from '@/components/layout/DayPulseOverview'
import ItineraryTab from '@/components/tabs/ItineraryTab'
import MapTab from '@/components/tabs/MapTab'
import WeatherTab from '@/components/tabs/WeatherTab'
import BudgetTab from '@/components/tabs/BudgetTab'
import MetaColumn from '@/components/layout/MetaColumn'

const BUTTON_CLASS =
  'w-8 h-8 rounded-full bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 hover:text-amber-400 hover:border-amber-500/30 transition-colors duration-150 backdrop-blur-sm flex items-center justify-center pointer-events-auto'

export default function PlanLayout() {
  const {
    layoutMode, setLayoutMode, setIsTransitioning,
    activeTab, setActiveTab,
    selectedDate, setSelectedDate,
  } = useUIStore()
  const messages = useChatStore((s) => s.messages)
  const { tripPlan, planItems } = useTripStore()

  const hasPlan = messages.length > 0

  useEffect(() => {
    setIsTransitioning(true)
  }, [layoutMode, setIsTransitioning])

  useEffect(() => {
    if (!selectedDate && tripPlan) {
      setSelectedDate(tripPlan.start_date)
    }
  }, [tripPlan, selectedDate, setSelectedDate])

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
      {/* Left: chat sidebar */}
      <div
        className={layoutMode === 'split' ? 'relative border-r border-zinc-800/50' : 'relative'}
        style={
          layoutMode === 'discovery'
            ? { width: '100%', transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }
            : { width: '440px', minWidth: '440px', flexShrink: 0, transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }
        }
        onTransitionEnd={() => setIsTransitioning(false)}
      >
        <ChatInterface />
        {layoutMode === 'discovery' && (
          <button
            onClick={() => {
              console.log('[EXPAND] clicked. layoutMode before:', useUIStore.getState().layoutMode);
              setLayoutMode('split');
              setTimeout(() => {
                console.log('[EXPAND] layoutMode 100ms after:', useUIStore.getState().layoutMode);
              }, 100);
            }}
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

      {/* Middle + Right: only in split mode */}
      <AnimatePresence>
        {layoutMode === 'split' && (
          <motion.div
            style={{ display: 'flex', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
          >
            <IconTabRail />

            {/* Main content */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{
                flex: 1,
                minWidth: 0,
                display: 'grid',
                gridTemplateRows: '40% 1fr',
                gap: 12,
                padding: 12,
                minHeight: 0,
              }}>
                {/* Top row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '3.5fr 6.5fr',
                  gap: 12,
                  minHeight: 0,
                }}>
                  {/* Top-left: Calendar */}
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

                  {/* Top-right: DayPulseOverview */}
                  <motion.div
                    style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <DayPulseOverview selectedDate={selectedDate} planItems={planItems} />
                  </motion.div>
                </div>

                {/* Bottom row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '6fr 4fr',
                  gap: 12,
                  minHeight: 0,
                }}>
                  {/* Bottom-left: Tab content (itinerary by default) */}
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

                  {/* Bottom-right: MetaColumn */}
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
  )
}
