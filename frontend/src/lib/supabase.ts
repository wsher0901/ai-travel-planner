import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      '[supabase] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. ' +
      'Check your .env.local file.'
    )
  }

  // Return memoized singleton in the browser to avoid duplicate client instances.
  if (typeof window !== 'undefined') {
    if (!cached) {
      cached = createBrowserClient(url, key)
    }
    return cached
  }

  // On the server (SSR / RSC), always create a fresh client per request.
  return createBrowserClient(url, key)
}
