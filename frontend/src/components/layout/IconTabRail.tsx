'use client'

import * as React from 'react'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, Map, CloudSun, Wallet, Gauge } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

type TabId = 'itinerary' | 'map' | 'weather' | 'budget' | 'score'

const TABS: { id: TabId; icon: React.ElementType; label: string }[] = [  { id: 'itinerary', icon: CalendarDays, label: 'Itinerary' },
  { id: 'map', icon: Map, label: 'Map' },
  { id: 'weather', icon: CloudSun, label: 'Weather' },
  { id: 'budget', icon: Wallet, label: 'Budget' },
  { id: 'score', icon: Gauge, label: 'Score' },
]

function TabButton({
  tab,
  isActive,
  onClick,
}: {
  tab: (typeof TABS)[0]
  isActive: boolean
  onClick: () => void
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const Icon = tab.icon

  const handleMouseEnter = () => {
    tooltipTimer.current = setTimeout(() => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        setTooltipPos({ x: rect.right + 8, y: rect.top + rect.height / 2 })
      }
      setShowTooltip(true)
    }, 400)
  }

  const handleMouseLeave = () => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    setShowTooltip(false)
    setTooltipPos(null)
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.button
        ref={buttonRef}
        role="tab"
        aria-selected={isActive}
        aria-label={tab.label}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        whileHover={!isActive ? { background: 'rgba(6,182,212,0.06)' } : {}}
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {isActive && (
          <motion.div
            layoutId="tab-indicator"
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              translateY: '-50%',
              width: 3,
              height: 24,
              borderRadius: 2,
              backgroundColor: 'rgb(245,158,11)',
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        <Icon
          size={20}
          color={isActive ? 'rgb(245,158,11)' : 'rgba(255,255,255,0.4)'}
          style={{ transition: 'color 0.15s' }}
        />
      </motion.button>

      <AnimatePresence>
        {showTooltip && tooltipPos && typeof document !== 'undefined' && createPortal(
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'fixed',
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: 'translateY(-50%)',
              background: 'rgba(12,15,22,0.95)',
              border: '1px solid rgba(6,182,212,0.2)',
              padding: '6px 10px',
              fontFamily: 'var(--font-sora)',
              fontSize: 12,
              color: 'rgba(255,255,255,0.9)',
              borderRadius: 6,
              whiteSpace: 'nowrap',
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          >
            {tab.label}
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  )
}

export default function IconTabRail() {
  const { activeTab, setActiveTab } = useUIStore()

  return (
    <div
      style={{
        width: 56,
        height: '100%',
        flexShrink: 0,
        background: 'rgba(6,182,212,0.02)',
        borderRight: '1px solid rgba(6,182,212,0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 16,
        gap: 6,
      }}
    >
      {/* Amber diamond mark */}
      <div
        style={{
          width: 10,
          height: 10,
          backgroundColor: 'rgb(245,158,11)',
          transform: 'rotate(45deg)',
          marginBottom: 10,
          flexShrink: 0,
        }}
      />
      {TABS.map((tab) => (
        <TabButton
          key={tab.id}
          tab={tab}
          isActive={activeTab === tab.id}
          onClick={() => setActiveTab(tab.id)}
        />
      ))}
    </div>
  )
}
