'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useChatStore } from '@/store/chatStore'

interface PlanLayoutProps {
  chatPanel: React.ReactNode
  dockPanel: React.ReactNode
}

const BUTTON_CLASS =
  'w-8 h-8 rounded-full bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 hover:text-amber-400 hover:border-amber-500/30 transition-colors duration-150 backdrop-blur-sm flex items-center justify-center'

export default function PlanLayout({ chatPanel, dockPanel }: PlanLayoutProps) {
  const { layoutMode, setLayoutMode, isTransitioning, setIsTransitioning } = useUIStore()
  const messages = useChatStore((s) => s.messages)

  const hasPlan = messages.length > 0

  useEffect(() => {
    setIsTransitioning(true)
  }, [layoutMode, setIsTransitioning])

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div
        className={
          layoutMode === 'split'
            ? 'relative border-r border-zinc-800/50'
            : 'relative'
        }
        style={
          layoutMode === 'discovery'
            ? {
                width: '100%',
                transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              }
            : {
                width: '440px',
                minWidth: '440px',
                transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              }
        }
        onTransitionEnd={() => setIsTransitioning(false)}
      >
        {chatPanel}
        {layoutMode === 'discovery' && hasPlan && (
          <button
            onClick={() => setLayoutMode('split')}
            className={`absolute top-3 right-3 ${BUTTON_CLASS}`}
          >
            <PanelRightOpen size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {layoutMode === 'split' && (
          <motion.div
            className="relative flex-1 min-w-0 h-full overflow-hidden"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
          >
            <button
              onClick={() => setLayoutMode('discovery')}
              className={`absolute top-1/2 -translate-y-1/2 z-10 ${BUTTON_CLASS}`}
              style={{ left: 2 }}
            >
              <PanelRightClose size={14} />
            </button>
            {dockPanel}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
