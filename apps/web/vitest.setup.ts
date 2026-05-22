/**
 * Setup global Vitest — KOVAS App.
 *
 * Charge :
 *   - @testing-library/jest-dom pour les matchers DOM (toBeInTheDocument, etc.)
 *   - mocks par défaut : next/navigation, next/headers, Supabase client browser
 *   - polyfills légers (TextEncoder/Decoder pour libs Node modernes en jsdom)
 *
 * Les mocks Supabase sont volontairement génériques — un test qui a besoin
 * d'une réponse spécifique doit re-mocker localement via `vi.mocked(client.from)`.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'

// ============================================================================
// Polyfills jsdom (TextEncoder/Decoder requis par certaines libs comme jose, etc.)
// ============================================================================
beforeAll(() => {
  if (typeof globalThis.TextEncoder === 'undefined') {
    // biome-ignore lint/suspicious/noExplicitAny: polyfill technique
    ;(globalThis as any).TextEncoder = require('node:util').TextEncoder
  }
  if (typeof globalThis.TextDecoder === 'undefined') {
    // biome-ignore lint/suspicious/noExplicitAny: polyfill technique
    ;(globalThis as any).TextDecoder = require('node:util').TextDecoder
  }
  if (typeof globalThis.crypto === 'undefined') {
    // biome-ignore lint/suspicious/noExplicitAny: polyfill technique
    ;(globalThis as any).crypto = require('node:crypto').webcrypto
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ============================================================================
// Mocks next/navigation — neutralise useRouter/usePathname/useSearchParams pour
// les tests de composants client qui les appellent au mount.
// ============================================================================
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    getAll: vi.fn(() => []),
  }),
  headers: () => new Map(),
}))

// ============================================================================
// Mock Supabase client par défaut — renvoie des chaînes vides pour éviter les
// throw au mount. Surcharger localement dans le test qui valide un comportement
// précis (cf. fair-use-monitor.test.ts existant comme référence).
// ============================================================================
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => createMockSupabaseClient()),
  createServerClient: vi.fn(() => createMockSupabaseClient()),
}))

vi.mock('@supabase/supabase-js', async () => {
  const actual =
    await vi.importActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js')
  return {
    ...actual,
    createClient: vi.fn(() => createMockSupabaseClient()),
  }
})

interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  range: ReturnType<typeof vi.fn>
  match: ReturnType<typeof vi.fn>
  then: ReturnType<typeof vi.fn>
}

function createMockSupabaseClient(): unknown {
  const builder: MockQueryBuilder = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    range: vi.fn(),
    match: vi.fn(),
    // biome-ignore lint/suspicious/noThenProperty: thenable mock pour reproduire le builder Postgrest
    then: vi.fn((resolve: (v: unknown) => void) => resolve({ data: [], error: null })),
  }
  // chainage fluent : chaque méthode renvoie le builder lui-même
  for (const key of Object.keys(builder) as Array<keyof MockQueryBuilder>) {
    if (key !== 'single' && key !== 'maybeSingle' && key !== 'then') {
      builder[key].mockReturnValue(builder)
    }
  }
  return {
    from: vi.fn(() => builder),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        download: vi.fn(),
        remove: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://mock/file' } })),
      })),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    })),
  }
}

// ============================================================================
// Mock window.matchMedia + ResizeObserver + scrollTo (jsdom ne les fournit pas)
// ============================================================================
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // biome-ignore lint/suspicious/noExplicitAny: stub global jsdom
  ;(globalThis as any).ResizeObserver = class ResizeObserver {
    observe(): void {
      // no-op : ResizeObserver stub jsdom
    }
    unobserve(): void {
      // no-op
    }
    disconnect(): void {
      // no-op
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: stub global jsdom
  ;(globalThis as any).IntersectionObserver = class IntersectionObserver {
    observe(): void {
      // no-op
    }
    unobserve(): void {
      // no-op
    }
    disconnect(): void {
      // no-op
    }
    takeRecords(): unknown[] {
      return []
    }
    root = null
    rootMargin = ''
    thresholds: readonly number[] = []
  }

  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  window.HTMLElement.prototype.scrollTo = vi.fn()
  window.scrollTo = vi.fn()
}

// ============================================================================
// Variables d'env minimales pour les modules qui les requièrent à l'import
// ============================================================================
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'mock-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'mock-service-key'
process.env.NEXT_PUBLIC_KOVAS_DEV_ALLOW_FAKE_SIRET ??= '1'
