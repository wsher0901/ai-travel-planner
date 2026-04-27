'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[roam] unhandled error', error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0c0f16',
        color: 'rgba(255,255,255,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
      }}
    >
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-sora)',
            fontSize: 22,
            fontWeight: 600,
            color: 'rgba(6,182,212,0.9)',
            marginBottom: 10,
          }}
        >
          Something broke
        </div>
        <div
          style={{
            fontFamily: 'var(--font-geist-sans)',
            fontSize: 14,
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.5)',
            marginBottom: 24,
          }}
        >
          The trip planner hit an unexpected error. You can try again or reload the page.
        </div>
        <button
          type="button"
          onClick={reset}
          style={{
            fontFamily: 'var(--font-sora)',
            fontSize: 13,
            fontWeight: 500,
            color: '#0c0f16',
            background: '#f59e0b',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
