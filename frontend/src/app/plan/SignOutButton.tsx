'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <button
      onClick={handleSignOut}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        fontFamily: 'var(--font-sora)',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.28)',
        cursor: 'pointer',
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(245,158,11,0.65)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.28)' }}
    >
      Sign out
    </button>
  )
}
