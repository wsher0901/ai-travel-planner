'use client'

import React, { useEffect, useRef, useState, useCallback, type KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, ArrowRight, Compass, Plus, X, Sparkles, SlidersHorizontal, MessageCircle, ClipboardCheck } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import SliderPanel from './SliderPanel'
import { useChatStore } from '@/store/chatStore'
import { useTripStore } from '@/store/tripStore'
import { useUIStore } from '@/store/uiStore'
import { createClient } from '@/lib/supabase'

// ── Color config ───────────────────────────────────────────────────────────
const CHAT_COLOR = {
  color: '#f59e0b',
  glow: 'radial-gradient(ellipse at 50% 60%, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.03) 40%, transparent 70%)',
  headlineColor: '#fbbf24',
  chipBorder: 'rgba(245,158,11,0.35)',
}

// ── Streaming dots ─────────────────────────────────────────────────────────
function StreamingDots({ modeColor }: { modeColor: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '48px', height: '4px', borderRadius: '2px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          style={{ height: '100%', width: '50%', borderRadius: '2px', background: modeColor, opacity: 0.6 }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <span style={{ fontSize: '12px', color: modeColor, opacity: 0.5, fontFamily: 'var(--font-sora)', fontStyle: 'italic' }}>
        thinking
      </span>
    </div>
  )
}

// ── Post-plan CTA ──────────────────────────────────────────────────────────
function PostPlanCTA() {
  const setLayoutMode = useUIStore((s) => s.setLayoutMode)
  const clearMessages = useChatStore((s) => s.clearMessages)
  const setSessionId = useChatStore((s) => s.setSessionId)

  const btnBase: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '9999px',
    fontFamily: 'var(--font-sora)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'inline-flex',
    alignItems: 'center',
  }

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
      <button
        onClick={() => setLayoutMode('split')}
        style={{
          ...btnBase,
          background: 'rgba(245,158,11,0.15)',
          border: '1px solid rgba(245,158,11,0.4)',
          color: '#fbbf24',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.25)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.15)' }}
      >
        Open Visual Planner ✨
      </button>
      <button
        onClick={() => {
          clearMessages()
          setSessionId(null)
          useTripStore.getState().clearTrip()
        }}
        style={{
          ...btnBase,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.5)',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement
          el.style.border = '1px solid rgba(255,255,255,0.25)'
          el.style.color = 'rgba(255,255,255,0.7)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement
          el.style.border = '1px solid rgba(255,255,255,0.12)'
          el.style.color = 'rgba(255,255,255,0.5)'
        }}
      >
        Start a New Plan
      </button>
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────────
function MessageBubble({ role, content, modeColor, isTyping, timestamp }: { role: 'user' | 'assistant'; content: string; modeColor: string; isTyping?: boolean; timestamp: Date }) {
  const isUser = role === 'user'
  const timeStr = timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const CTA_MARKER = '[CTA:POST_PLAN]'
  const hasCTA = !isUser && content.includes(CTA_MARKER)
  const textContent = hasCTA ? content.replace(CTA_MARKER, '').trimEnd() : content

  return (
    <motion.div
      initial={isUser ? { opacity: 0, y: 8, scale: 0.97, filter: 'blur(2px)' } : { opacity: 0, y: 10 }}
      animate={isUser ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' } : { opacity: 1, y: 0 }}
      transition={isUser ? { duration: 0.2, ease: [0.2, 0, 0, 1] } : { duration: 0.25 }}
      className="group"
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: isUser ? '70%' : '80%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
      }}
    >
      {!isUser && (
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: modeColor,
            marginTop: '7px',
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div
          style={isUser ? {
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '18px 18px 4px 18px',
            padding: '12px 16px',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.9)',
            fontFamily: 'var(--font-sora)',
          } : {
            background: 'transparent',
            border: 'none',
            padding: '4px 0',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.85)',
            fontFamily: 'var(--font-sora)',
            lineHeight: '1.7',
          }}
        >
          {isUser ? content : (
            <>
              <ReactMarkdown
                components={{
                  strong: ({ children }) => <strong style={{ color: 'white', fontWeight: 600 }}>{children}</strong>,
                  p: ({ children }) => <p style={{ marginBottom: '8px' }}>{children}</p>,
                  ol: ({ children }) => <ol style={{ paddingLeft: '20px', marginBottom: '8px' }}>{children}</ol>,
                  ul: ({ children }) => <ul style={{ paddingLeft: '20px', marginBottom: '8px' }}>{children}</ul>,
                  li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                }}
              >
                {textContent}
              </ReactMarkdown>
              {hasCTA && <PostPlanCTA />}
              {isTyping && (
                <motion.span
                  style={{ color: modeColor, fontWeight: 300, marginLeft: '1px' }}
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                >|</motion.span>
              )}
            </>
          )}
        </div>
        <span
          className="opacity-0 group-hover:opacity-100"
          style={{
            fontSize: '10px',
            color: 'rgba(255,255,255,0.2)',
            fontFamily: 'var(--font-sora)',
            marginTop: '4px',
            textAlign: isUser ? 'right' : 'left',
            transition: 'opacity 0.2s',
          }}
        >
          {timeStr}
        </span>
      </div>
    </motion.div>
  )
}

// ── Input pill ─────────────────────────────────────────────────────────────
function InputPill({
  slidersOpen,
  onToggleSliders,
  input,
  onInputChange,
  onKeyDown,
  onSend,
  canSend,
  zeroShotActive,
  onToggleZeroShot,
  textareaRef,
  onFocus,
  onBlur,
  isFocused,
  hasText,
  hasStarted,
  customPlaceholder,
}: {
  slidersOpen: boolean
  onToggleSliders: () => void
  input: string
  onInputChange: (value: string) => void
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  canSend: boolean
  zeroShotActive: boolean
  onToggleZeroShot: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onFocus: () => void
  onBlur: () => void
  isFocused: boolean
  hasText: boolean
  hasStarted: boolean
  customPlaceholder?: string | null
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const borderColor = isFocused && hasText
    ? `${CHAT_COLOR.color}40`
    : isFocused
    ? 'rgba(255,255,255,0.15)'
    : 'rgba(255,255,255,0.1)'
  const boxShadow = isFocused && hasText
    ? `0 0 12px ${CHAT_COLOR.color}15`
    : 'none'

  const placeholder = customPlaceholder != null
    ? customPlaceholder
    : zeroShotActive
    ? (hasStarted ? 'Dates, travelers, and home city...' : 'How many travelers, when, and where from?')
    : 'Message Roam...'

  return (
    <motion.div
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: `1px solid ${borderColor}`,
        borderRadius: '20px',
        padding: '8px 8px 8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow,
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* + / menu button */}
      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            border: 'none',
            cursor: 'pointer',
            background: menuOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: menuOpen ? 'white' : 'rgba(255,255,255,0.35)',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          <span style={{ display: 'inline-flex', transform: menuOpen ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
            <Plus size={18} />
          </span>
        </button>

        {/* Popup menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                left: 0,
                background: 'rgba(20,20,20,0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '4px',
                minWidth: '200px',
                zIndex: 20,
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              <MenuItemButton
                icon={<Sparkles size={16} color="#f59e0b" />}
                label="Generate Full Plan"
                labelColor="rgba(255,255,255,0.8)"
                onClick={() => { onToggleZeroShot(); setMenuOpen(false) }}
              />
              <MenuItemButton
                icon={<SlidersHorizontal size={16} color="rgba(255,255,255,0.5)" />}
                label="Preferences"
                labelColor="rgba(255,255,255,0.7)"
                onClick={() => { onToggleSliders(); setMenuOpen(false) }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Zero-shot badge */}
      {zeroShotActive && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '9999px',
            background: 'rgba(245,158,11,0.15)',
            border: '1px solid rgba(245,158,11,0.3)',
            flexShrink: 0,
          }}
        >
          <Sparkles size={12} color="#f59e0b" />
          <span style={{ fontSize: '11px', fontWeight: 500, color: '#fbbf24', fontFamily: 'var(--font-sora)' }}>
            Full Plan
          </span>
          <button
            onClick={onToggleZeroShot}
            style={{ display: 'inline-flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={1}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'white',
          fontFamily: 'var(--font-sora)',
          fontSize: '15px',
          resize: 'none',
          minHeight: '36px',
          maxHeight: '200px',
          padding: '6px 0',
          lineHeight: '1.5',
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}
        className="placeholder-[rgba(255,255,255,0.25)] [&::-webkit-scrollbar]:hidden"
      />

      <motion.button
        onClick={onSend}
        disabled={!canSend}
        whileTap={canSend ? { scale: 0.9 } : {}}
        whileHover={canSend ? { opacity: 0.85 } : {}}
        style={{
          flexShrink: 0,
          width: '36px',
          height: '36px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: CHAT_COLOR.color,
          border: 'none',
          cursor: canSend ? 'pointer' : 'default',
          opacity: canSend ? 1 : 0.3,
          transition: 'opacity 0.2s',
        }}
      >
        <ArrowUp size={18} color="#080808" />
      </motion.button>
    </motion.div>
  )
}

function MenuItemButton({ icon, label, labelColor, onClick }: { icon: React.ReactNode; label: string; labelColor: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '10px 12px',
        borderRadius: '8px',
        border: 'none',
        background: hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {icon}
      <span style={{ fontSize: '13px', fontFamily: 'var(--font-sora)', color: labelColor }}>
        {label}
      </span>
    </button>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({
  onCardClick,
}: {
  onCardClick: (placeholder: string, enableZeroShot: boolean) => void
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const cards = [
    {
      icon: <Sparkles size={20} color="rgb(245,158,11)" />,
      title: 'Plan a trip for me',
      subtitle: "Share your dates and we'll handle everything",
      placeholder: 'Tell me your dates, budget, and any preferences...',
      enableZeroShot: true,
      isPrimary: true,
      borderGradient: 'linear-gradient(135deg, rgba(245,158,11,0.35) 0%, rgba(245,158,11,0.08) 50%, rgba(245,158,11,0.2) 100%)',
      borderGradientHover: 'linear-gradient(135deg, rgba(245,158,11,0.5) 0%, rgba(245,158,11,0.15) 50%, rgba(245,158,11,0.35) 100%)',
      bottomLineGradient: 'linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.5) 50%, transparent 100%)',
      hoverShadow: '0 8px 40px rgba(245,158,11,0.15), 0 2px 8px rgba(245,158,11,0.1)',
      iconGlow: 'drop-shadow(0 0 6px rgba(245,158,11,0.4))',
      iconBgGlow: 'radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%)',
    },
    {
      icon: <MessageCircle size={20} color="rgba(6,182,212,0.7)" />,
      title: 'Help me figure it out',
      subtitle: "Not sure yet? Let's explore ideas together",
      placeholder: 'What kind of trip are you dreaming about?',
      enableZeroShot: false,
      isPrimary: false,
      borderGradient: 'linear-gradient(135deg, rgba(6,182,212,0.25) 0%, rgba(6,182,212,0.05) 50%, rgba(6,182,212,0.15) 100%)',
      borderGradientHover: 'linear-gradient(135deg, rgba(6,182,212,0.5) 0%, rgba(6,182,212,0.15) 50%, rgba(6,182,212,0.35) 100%)',
      bottomLineGradient: 'linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.5) 50%, transparent 100%)',
      hoverShadow: '0 8px 40px rgba(6,182,212,0.15), 0 2px 8px rgba(6,182,212,0.1)',
      iconGlow: 'drop-shadow(0 0 6px rgba(6,182,212,0.4))',
      iconBgGlow: 'radial-gradient(circle, rgba(6,182,212,0.2) 0%, transparent 70%)',
    },
    {
      icon: <ClipboardCheck size={20} color="rgba(168,139,250,0.7)" />,
      title: 'Improve my existing plan',
      subtitle: "We'll grade it and suggest upgrades",
      placeholder: 'Describe or paste your existing plan...',
      enableZeroShot: false,
      isPrimary: false,
      borderGradient: 'linear-gradient(135deg, rgba(168,139,250,0.25) 0%, rgba(168,139,250,0.05) 50%, rgba(168,139,250,0.15) 100%)',
      borderGradientHover: 'linear-gradient(135deg, rgba(168,139,250,0.5) 0%, rgba(168,139,250,0.15) 50%, rgba(168,139,250,0.35) 100%)',
      bottomLineGradient: 'linear-gradient(90deg, transparent 0%, rgba(168,139,250,0.5) 50%, transparent 100%)',
      hoverShadow: '0 8px 40px rgba(168,139,250,0.15), 0 2px 8px rgba(168,139,250,0.1)',
      iconGlow: 'drop-shadow(0 0 6px rgba(168,139,250,0.4))',
      iconBgGlow: 'radial-gradient(circle, rgba(168,139,250,0.2) 0%, transparent 70%)',
    },
  ]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        padding: '24px',
        gap: '20px',
        position: 'relative',
      }}
    >
      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.06) 0%, rgba(6,182,212,0.03) 40%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
          filter: 'blur(60px)',
        }}
      />

      {/* Heading */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'relative', display: 'inline-flex', marginBottom: '4px' }}>
          {/* Compass ambient glow */}
          <div
            style={{
              position: 'absolute',
              inset: '-12px',
              background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)',
              borderRadius: '50%',
              pointerEvents: 'none',
              filter: 'blur(8px)',
            }}
          />
          <Compass size={36} color="rgba(245,158,11,0.6)" />
        </div>
        <p style={{
          fontSize: '28px',
          fontWeight: 700,
          fontFamily: 'var(--font-sora)',
          textAlign: 'center',
          margin: 0,
          letterSpacing: '-0.01em',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(245,158,11,0.8) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Where to next?
        </p>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>
        {cards.map((card, index) => {
          const isHovered = hoveredIdx === index
          const outerPadding = card.isPrimary ? '2px' : '1.5px'
          const innerPadding = card.isPrimary ? '20px 24px' : '18px 22px'
          const titleSize = card.isPrimary ? '16px' : '15px'
          const cardOpacity = !card.isPrimary && !isHovered ? 0.85 : 1
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.08 }}
              onClick={() => onCardClick(card.placeholder, card.enableZeroShot)}
              onMouseEnter={() => setHoveredIdx(index)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ opacity: cardOpacity, transition: 'opacity 300ms ease' }}
            >
              {/* Outer div — visible gradient border */}
              <div
                style={{
                  position: 'relative',
                  padding: outerPadding,
                  borderRadius: '20px',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'all 400ms ease',
                  transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
                  boxShadow: isHovered ? card.hoverShadow : 'none',
                  background: isHovered ? card.borderGradientHover : card.borderGradient,
                }}
              >
                {/* Inner div — frosted glass surface */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 10,
                    backgroundColor: 'rgba(12,15,22,0.75)',
                    backdropFilter: 'blur(20px) saturate(1.2)',
                    WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
                    borderRadius: '19px',
                    padding: innerPadding,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    overflow: 'hidden',
                    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -1px 1px rgba(0,0,0,0.2), 0 0 0 0.5px rgba(255,255,255,0.05)',
                  }}
                >
                  {/* Glass light-from-above overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '50%',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)',
                      borderRadius: '19px 19px 0 0',
                      pointerEvents: 'none',
                      zIndex: 0,
                    }}
                  />

                  {/* Noise texture overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '19px',
                      opacity: 0.03,
                      backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2EpIi8+PC9zdmc+')",
                      pointerEvents: 'none',
                      zIndex: 0,
                    }}
                  />

                  {/* Icon with radial glow behind */}
                  <div style={{ flexShrink: 0, marginTop: 2, position: 'relative', zIndex: 1 }}>
                    <div
                      style={{
                        position: 'absolute',
                        inset: '-8px',
                        borderRadius: '50%',
                        background: card.iconBgGlow,
                        filter: 'blur(6px)',
                        pointerEvents: 'none',
                      }}
                    />
                    <div style={{ position: 'relative', transition: 'filter 400ms ease', filter: isHovered ? card.iconGlow : 'none' }}>
                      {card.icon}
                    </div>
                  </div>

                  {/* Text */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', position: 'relative', zIndex: 1, flex: 1 }}>
                    <span style={{ fontSize: titleSize, fontWeight: 600, color: isHovered ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-sora)', transition: 'color 300ms ease' }}>
                      {card.title}
                    </span>
                    <span style={{ fontSize: '13px', color: isHovered ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.4)', lineHeight: 1.4, transition: 'color 300ms ease' }}>
                      {card.subtitle}
                    </span>
                  </div>

                  {/* Arrow indicator — primary card only */}
                  {card.isPrimary && (
                    <div
                      style={{
                        flexShrink: 0,
                        alignSelf: 'center',
                        position: 'relative',
                        zIndex: 1,
                        transition: 'all 300ms ease',
                        transform: isHovered ? 'translateX(3px)' : 'translateX(0)',
                        color: isHovered ? 'rgba(245,158,11,0.8)' : 'rgba(245,158,11,0.4)',
                        display: 'flex',
                      }}
                    >
                      <ArrowRight size={16} />
                    </div>
                  )}
                </div>

                {/* Bottom light line */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '32px',
                    right: '32px',
                    height: '1.5px',
                    borderRadius: '1px',
                    zIndex: 11,
                    pointerEvents: 'none',
                    background: card.bottomLineGradient,
                    opacity: isHovered ? 0.7 : 0.3,
                    transition: 'opacity 600ms ease',
                  }}
                />
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Footer with vertical connector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: '6px' }} />
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', margin: 0 }}>
          Or just start typing below
        </p>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ChatInterface() {
  const messages = useChatStore((s) => s.messages)
  const zeroShotActive = useChatStore((s) => s.zeroShotActive)
  const isLoading = useChatStore((s) => s.isLoading)
  const sessionId = useChatStore((s) => s.sessionId)
  const addMessage = useChatStore((s) => s.addMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const setZeroShotActive = useChatStore((s) => s.setZeroShotActive)
  const setLoading = useChatStore((s) => s.setLoading)
  const setSessionId = useChatStore((s) => s.setSessionId)
  const sliders = useChatStore((s) => s.sliders)

  const [input, setInput] = useState('')
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [slidersOpen, setSlidersOpen] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [customPlaceholder, setCustomPlaceholder] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleCardClick = useCallback((placeholder: string, enableZeroShot: boolean) => {
    setCustomPlaceholder(placeholder)
    if (enableZeroShot) {
      setZeroShotActive(true)
    } else {
      setZeroShotActive(false)
    }
    setTimeout(() => textareaRef.current?.focus(), 100)
  }, [setZeroShotActive])

  // Auto-scroll on new messages or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [input])

  // Helper: add a placeholder assistant bubble and return its id
  const addPlaceholder = useCallback(() => {
    const id = crypto.randomUUID()
    useChatStore.getState().messages.push({
      id,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    })
    useChatStore.setState({ messages: [...useChatStore.getState().messages] })
    setStreamingId(id)
    return id
  }, [])

  // Zero-shot mode: single request to /plan/generate
  const handleZeroShot = useCallback(async (trimmed: string) => {
    const assistantId = addPlaceholder()

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          session_id: null,
          user_id: user?.id ?? null,
          sliders,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()

      const summary = [
        `✈ ${data.destination}`,
        `${data.start_date} → ${data.end_date}`,
        '',
        data.summary,
      ].join('\n')

      const words = summary.split(' ')
      let accumulated = ''
      for (const word of words) {
        accumulated += (accumulated ? ' ' : '') + word
        updateMessage(assistantId, accumulated)
        await new Promise(r => setTimeout(r, 25))
      }

      setSessionId(data.trip_plan_id)

      useTripStore.getState().setTripPlan({
        id: data.trip_plan_id,
        destination: data.destination,
        origin_city: data.origin_city || null,
        start_date: data.start_date,
        end_date: data.end_date,
        budget_range: data.budget_range || '',
        destination_timezone: data.destination_timezone || null,
        destination_latitude: data.destination_latitude || null,
        destination_longitude: data.destination_longitude || null,
        number_of_travelers: data.number_of_travelers || 1,
        user_timezone: data.user_timezone || null,
      })
      useTripStore.getState().setPlanItems(data.items || [])

      await new Promise(r => setTimeout(r, 1500))
      const ctaText = "Your trip plan is ready! Want me to open the visual planner? You'll get an interactive timeline, map, weather forecasts, and budget breakdown.\n\n[CTA:POST_PLAN]"
      const ctaId = crypto.randomUUID()
      useChatStore.getState().messages.push({ id: ctaId, role: 'assistant', content: '', timestamp: new Date() })
      useChatStore.setState({ messages: [...useChatStore.getState().messages] })
      const ctaWords = ctaText.split(' ')
      let ctaAccumulated = ''
      for (const word of ctaWords) {
        ctaAccumulated += (ctaAccumulated ? ' ' : '') + word
        useChatStore.setState((s) => ({
          messages: s.messages.map((m) => m.id === ctaId ? { ...m, content: ctaAccumulated } : m),
        }))
        await new Promise(r => setTimeout(r, 25))
      }
    } catch {
      updateMessage(assistantId, 'Something went wrong. Please try again.')
    } finally {
      setStreamingId(null)
      setLoading(false)
    }
  }, [sessionId, sliders, addPlaceholder, updateMessage, setSessionId, setLoading])

  // Stream to /chat/stream
  const handleStream = useCallback(async (trimmed: string) => {
    const assistantId = addPlaceholder()

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, mode: 'plan', session_id: sessionId, sliders }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let accumulated = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE lines
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            accumulated += line.slice(6)
            updateMessage(assistantId, accumulated)
          }
        }
      }

      // Process any remaining buffer
      if (buffer.startsWith('data: ')) {
        accumulated += buffer.slice(6)
        updateMessage(assistantId, accumulated)
      }

      if (!accumulated) {
        updateMessage(assistantId, 'No response received. Please try again.')
      }
    } catch {
      updateMessage(assistantId, 'Something went wrong. Please try again.')
    } finally {
      setStreamingId(null)
      setLoading(false)
    }
  }, [sessionId, sliders, addPlaceholder, updateMessage, setLoading])

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    setHasStarted(true)
    addMessage('user', trimmed)
    setInput('')
    setCustomPlaceholder(null)
    setLoading(true)

    if (zeroShotActive) {
      setZeroShotActive(false)
      handleZeroShot(trimmed)
    } else {
      handleStream(trimmed)
    }
  }, [input, isLoading, zeroShotActive, addMessage, setLoading, setZeroShotActive, handleZeroShot, handleStream])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = input.trim().length > 0 && !isLoading

  const pillProps = {
    slidersOpen,
    onToggleSliders: () => setSlidersOpen((o) => !o),
    input,
    onInputChange: setInput,
    onKeyDown: handleKeyDown,
    onSend: handleSend,
    canSend,
    zeroShotActive,
    onToggleZeroShot: () => { const store = useChatStore.getState(); store.setZeroShotActive(!store.zeroShotActive) },
    textareaRef,
    onFocus: () => setInputFocused(true),
    onBlur: () => setInputFocused(false),
    isFocused: inputFocused,
    hasText: input.trim().length > 0,
    hasStarted,
    customPlaceholder,
  }

  return (
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', position: 'relative', background: '#080808', overflow: 'hidden' }}>
      {/* Background glow */}
      <div
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, background: CHAT_COLOR.glow }}
      />

      {/* Message thread */}
      <div style={{ flex: 1, overflow: 'hidden', zIndex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}>
          {messages.length === 0 ? (
            <EmptyState onCardClick={handleCardClick} />
          ) : (
            <div
              className="[&::-webkit-scrollbar]:hidden"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                overflowY: 'auto',
                padding: '24px 24px 160px',
                maxWidth: '720px',
                margin: '0 auto',
                width: '100%',
                flex: 1,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  modeColor={CHAT_COLOR.color}
                  isTyping={msg.id === streamingId}
                  timestamp={msg.timestamp}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Input bar — always visible at bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '24px 24px 32px',
              background: 'linear-gradient(to top, #080808 70%, transparent)',
              zIndex: 10,
            }}
          >
            <div style={{ maxWidth: '720px', margin: '0 auto' }}>
              <AnimatePresence>
                {slidersOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ overflow: 'hidden', paddingBottom: '12px' }}
                  >
                    <SliderPanel />
                  </motion.div>
                )}
              </AnimatePresence>
              <InputPill {...pillProps} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
