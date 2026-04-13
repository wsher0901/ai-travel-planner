'use client';

import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

export default function TimelinePanel() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 200,
          height: 200,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
          filter: 'blur(40px)',
        }}
      />
      <motion.div
        animate={{ opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Clock size={36} color="rgba(245,158,11,0.25)" />
      </motion.div>
      <p
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'var(--font-sora)',
          marginTop: 16,
        }}
      >
        Timeline
      </p>
      <p
        style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.18)',
          fontFamily: 'var(--font-sora)',
          marginTop: 4,
        }}
      >
        Your day-by-day itinerary will appear here
      </p>
    </div>
  );
}
