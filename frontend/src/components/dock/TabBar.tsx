'use client';

import { motion } from 'framer-motion';
import { Clock, MapPin, CloudSun, Wallet } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

type Tab = {
  id: 'timeline' | 'map' | 'weather' | 'budget';
  icon: React.ReactNode;
  label: string;
};

const TABS: Tab[] = [
  { id: 'timeline', icon: <Clock size={15} />, label: 'Timeline' },
  { id: 'map',      icon: <MapPin size={15} />, label: 'Map' },
  { id: 'weather',  icon: <CloudSun size={15} />, label: 'Weather' },
  { id: 'budget',   icon: <Wallet size={15} />, label: 'Budget' },
];

export default function TabBar() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  return (
    <div
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(10,10,10,0.8)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: isActive ? '#f59e0b' : 'rgba(255,255,255,0.35)',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)';
              }
            }}
          >
            {isActive && (
              <motion.div
                layoutId="dock-tab-indicator"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 8,
                  background: 'rgba(245,158,11,0.1)',
                  zIndex: 0,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center' }}>
              {tab.icon}
            </span>
            <span
              style={{
                position: 'relative',
                zIndex: 1,
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'var(--font-sora)',
                letterSpacing: '0.01em',
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
