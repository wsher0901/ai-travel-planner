import { createClient } from '@/lib/supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

function buildUrl(path: string): string {
  const base = API_BASE_URL.replace(/\/$/, '')
  const rel = path.startsWith('/') ? path : `/${path}`
  return `${base}${rel}`
}

export interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  body?: unknown
  skipAuth?: boolean
}

async function request(path: string, init: ApiRequestInit = {}): Promise<Response> {
  const { body, skipAuth, headers, ...rest } = init
  const authHeader = skipAuth ? {} : await getAuthHeader()
  const res = await fetch(buildUrl(path), {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(headers as Record<string, string> | undefined),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    let parsed: unknown = null
    try {
      parsed = await res.clone().json()
    } catch {
      try {
        parsed = await res.clone().text()
      } catch {
        parsed = null
      }
    }
    const detail =
      typeof parsed === 'object' && parsed !== null && 'detail' in parsed
        ? String((parsed as { detail: unknown }).detail)
        : res.statusText
    throw new ApiError(res.status, `API ${res.status}: ${detail}`, parsed)
  }
  return res
}

export async function apiGet<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const res = await request(path, { ...init, method: 'GET' })
  return (await res.json()) as T
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  init: ApiRequestInit = {},
): Promise<T> {
  const res = await request(path, { ...init, method: 'POST', body })
  return (await res.json()) as T
}

export async function apiStream(
  path: string,
  body: unknown,
  init: ApiRequestInit = {},
): Promise<ReadableStream<Uint8Array>> {
  const res = await request(path, { ...init, method: 'POST', body })
  if (!res.body) throw new ApiError(500, 'No response body from stream endpoint', null)
  return res.body
}

export const api = {
  get: apiGet,
  post: apiPost,
  stream: apiStream,
  baseUrl: API_BASE_URL,
}
