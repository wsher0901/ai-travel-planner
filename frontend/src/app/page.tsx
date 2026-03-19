'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const IMAGES = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80',
]

export default function LoginPage() {
  const supabase = createClient()
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % IMAGES.length), 7000)
    return () => clearInterval(t)
  }, [])

  const signIn = (provider: 'google' | 'github') => {
    supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      {/* ── Background: crossfading images with Ken Burns ── */}
      <div className="absolute inset-0">
        <AnimatePresence>
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 2.4, ease: 'easeInOut' },
              scale: { duration: 9, ease: 'easeOut' },
            }}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${IMAGES[idx]})` }}
          />
        </AnimatePresence>

        {/* Gradient overlay — dark at bottom, light at top */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.28) 38%, rgba(0,0,0,0.62) 65%, rgba(0,0,0,0.84) 100%)',
          }}
        />
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pb-20">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center mb-8"
        >
          <h1
            className="text-[80px] font-bold leading-none text-white select-none"
            style={{
              fontFamily: 'var(--font-playfair)',
              letterSpacing: '-0.015em',
              textShadow: '0 4px 48px rgba(0,0,0,0.5)',
            }}
          >
            Roam
          </h1>

          {/* Amber accent rule */}
          <div
            className="mt-3 h-[2px] w-10 rounded-full"
            style={{ background: 'linear-gradient(90deg, #f59e0b, #ea580c)' }}
          />

          <p
            className="mt-4 text-[10px] font-semibold uppercase"
            style={{
              fontFamily: 'var(--font-dm-sans)',
              letterSpacing: '0.38em',
              color: 'rgba(255,255,255,0.45)',
              textShadow: '0 1px 12px rgba(0,0,0,0.6)',
            }}
          >
            AI Travel Planner
          </p>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 max-w-[300px] text-center text-[16px] leading-loose"
          style={{
            fontFamily: 'var(--font-dm-sans)',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.65)',
            textShadow: '0 1px 20px rgba(0,0,0,0.55)',
          }}
        >
          Tell us when you&apos;re free.{' '}
          <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 400 }}>
            We&apos;ll tell you where&nbsp;to&nbsp;go.
          </span>
        </motion.p>

        {/* Sign-in buttons */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.64, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center"
        >
          <AuthButton
            onClick={() => signIn('google')}
            icon={<GoogleIcon />}
            label="Continue with Google"
          />

          <div className="my-[14px] flex w-[220px] items-center gap-3">
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.2)' }} />
            <span
              className="text-[10px] uppercase"
              style={{
                fontFamily: 'var(--font-dm-sans)',
                letterSpacing: '0.22em',
                color: 'rgba(255,255,255,0.3)',
              }}
            >
              or
            </span>
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.2)' }} />
          </div>

          <AuthButton
            onClick={() => signIn('github')}
            icon={<GitHubIcon />}
            label="Continue with GitHub"
          />
        </motion.div>
      </div>

      {/* ── Bottom caption ── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 1.4 }}
        className="absolute bottom-7 left-0 right-0 text-center text-[10px] uppercase"
        style={{
          fontFamily: 'var(--font-dm-sans)',
          letterSpacing: '0.42em',
          color: 'rgba(255,255,255,0.2)',
        }}
      >
        Plan smarter. Travel better.
      </motion.p>
    </main>
  )
}

function AuthButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ backgroundColor: '#ffffff', color: '#111111' }}
      whileHover={{ backgroundColor: '#f59e0b', color: '#ffffff', scale: 1.024 }}
      whileTap={{ scale: 0.976 }}
      transition={{ duration: 0.18, ease: 'easeInOut' }}
      className="flex cursor-pointer items-center justify-center gap-[10px] rounded-lg py-[15px] text-[13px] font-semibold tracking-wide"
      style={{
        width: '220px',
        fontFamily: 'var(--font-dm-sans)',
      }}
    >
      {icon}
      {label}
    </motion.button>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}
