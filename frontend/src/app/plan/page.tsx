import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import SignOutButton from './SignOutButton'
import ChatInterface from '@/components/chat/ChatInterface'

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
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a]">
      {/* Nav bar */}
      <nav
        className="flex h-[60px] shrink-0 items-center justify-between border-b px-6"
        style={{
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <span
          className="font-[family-name:var(--font-sora)] text-[20px] font-bold text-white"
        >
          Roam
        </span>

        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[rgba(255,255,255,0.35)]">
            {user.email}
          </span>
          <SignOutButton />
        </div>
      </nav>

      {/* Content area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <ChatInterface />
      </main>
    </div>
  )
}
