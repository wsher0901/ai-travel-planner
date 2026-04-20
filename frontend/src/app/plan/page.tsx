import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Compass } from 'lucide-react'
import SignOutButton from './SignOutButton'
import PlanLayout from '@/components/layout/PlanLayout'

export default async function PlanPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Suppress: cookies can only be set in Server Actions or Route Handlers.
            // This is expected during SSR reads.
          }
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Nav bar */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: '56px',
          background: 'rgba(10,10,10,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
        }}
      >
        {/* Amber accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(to right, transparent, rgba(245,158,11,0.25), transparent)',
          }}
        />

        {/* Left: Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Compass size={18} color="#f59e0b" />
          <span
            style={{
              fontFamily: 'var(--font-sora)',
              fontSize: '20px',
              fontWeight: 700,
              color: 'white',
              letterSpacing: '-0.02em',
            }}
          >
            Roam
          </span>
        </div>

        {/* Right: Email + divider + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              fontFamily: 'var(--font-sora)',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.28)',
            }}
          >
            {user.email}
          </span>
          <div
            style={{
              width: '1px',
              height: '20px',
              background: 'rgba(255,255,255,0.08)',
            }}
          />
          <SignOutButton />
        </div>
      </nav>

      {/* Content area */}
      <main className="flex flex-1 overflow-hidden" style={{ paddingTop: '56px' }}>
        <PlanLayout />
      </main>
    </div>
  )
}
