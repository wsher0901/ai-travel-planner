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
      className="rounded px-2 py-1 text-xs text-[rgba(255,255,255,0.4)] transition-colors hover:text-amber-400"
    >
      Sign out
    </button>
  )
}
