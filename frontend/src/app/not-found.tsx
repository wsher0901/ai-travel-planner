import Link from 'next/link'

export default function NotFound() {
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
            fontSize: 48,
            fontWeight: 700,
            color: 'rgba(6,182,212,0.9)',
            letterSpacing: '-0.04em',
            marginBottom: 6,
          }}
        >
          404
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sora)',
            fontSize: 16,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.75)',
            marginBottom: 8,
          }}
        >
          Off the itinerary
        </div>
        <div
          style={{
            fontFamily: 'var(--font-geist-sans)',
            fontSize: 13,
            color: 'rgba(255,255,255,0.45)',
            marginBottom: 24,
          }}
        >
          That page doesn&apos;t exist. Let&apos;s get you back on the road.
        </div>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-sora)',
            fontSize: 13,
            fontWeight: 500,
            color: '#0c0f16',
            background: '#f59e0b',
            borderRadius: 8,
            padding: '10px 20px',
            textDecoration: 'none',
          }}
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
