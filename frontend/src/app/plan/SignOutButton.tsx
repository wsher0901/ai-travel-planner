'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
    router.push('/')
  }

  return (
    <button
      type="button"
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
        outline: 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(245,158,11,0.65)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.28)' }}
      onFocus={(e) => { e.currentTarget.style.outline = '2px solid rgba(245,158,11,0.6)'; e.currentTarget.style.outlineOffset = '2px' }}
      onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
    >
      Sign out
    </button>
  )
}
