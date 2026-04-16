'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';
import TabBar from '@/components/dock/TabBar';
import TimelinePanel from '@/components/dock/panels/TimelinePanel';
import MapPanel from '@/components/dock/panels/MapPanel';
import WeatherPanel from '@/components/dock/panels/WeatherPanel';
import BudgetPanel from '@/components/dock/panels/BudgetPanel';

const PANELS = {
  timeline: TimelinePanel,
  map: MapPanel,
  weather: WeatherPanel,
  budget: BudgetPanel,
};

export default function VisualDock() {
  const activeTab = useUIStore((s) => s.activeTab);
  const ActivePanel = PANELS[activeTab];

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#080808',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <TabBar />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            className="h-full overflow-hidden"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <ActivePanel />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
