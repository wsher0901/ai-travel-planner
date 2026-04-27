import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/** Resolve the safe base URL: prefer NEXT_PUBLIC_APP_URL env, fall back to request origin only when env is unset. */
function safeBase(requestOrigin: string): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return envUrl.replace(/\/$/, '')
  return requestOrigin
}

/** Validate a `next` redirect path: must start with `/`, must not start with `//` or `/\`. */
function isSafePath(path: string | null): path is string {
  if (!path) return false
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')
  const base = safeBase(origin)

  // Return 400 when the OAuth code is missing — makes failures observable.
  if (!code) {
    return new NextResponse('Missing auth code', { status: 400 })
  }

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

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(`${base}/?error=auth`)
  }

  const redirectPath = isSafePath(nextParam) ? nextParam : '/plan'
  return NextResponse.redirect(`${base}${redirectPath}`)
}
