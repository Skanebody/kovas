/**
 * GET /api/admin/health
 *
 * Agrège plusieurs checks en parallèle :
 *   1. Supabase   : latence d'un SELECT 1 (count head sur admin_users → ms)
 *   2. Anthropic  : last ai_usage row created_at < 1h (présence de signal récent)
 *   3. Stripe     : placeholder V1 (table stripe_events absente du schéma init)
 *   4. Resend     : placeholder V1 OK (aucune sonde directe disponible)
 *   5. Storage    : count fichiers + total size bucket photos (via storage.objects)
 *   6. Queue      : count jobs status='queued'
 *
 * Status par check : 'green' | 'orange' | 'red'.
 *
 * Service-role partout pour fiabilité (la gate est verifyAdminAccess()).
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

export type HealthStatus = 'green' | 'orange' | 'red' | 'unknown'

export interface HealthCheck {
  id: string
  label: string
  value: string
  status: HealthStatus
  hint?: string
}

export interface HealthResponse {
  generated_at: string
  checks: HealthCheck[]
}

interface AiUsageProbeRow {
  created_at: string
}

interface StorageObjectRow {
  name: string
  metadata: { size?: number | null } | null
}

interface StorageObjectsQuery {
  data: StorageObjectRow[] | null
  error: { message: string } | null
}

function formatMs(ms: number): string {
  if (ms < 1) return '< 1 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  const units = ['Ko', 'Mo', 'Go', 'To']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}

async function checkSupabase(): Promise<HealthCheck> {
  const adminDb = createAdminClient()
  const start = performance.now()
  try {
    const { error } = await adminDb
      .from('admin_users')
      .select('user_id', { count: 'exact', head: true })
    const elapsed = performance.now() - start
    if (error) {
      return {
        id: 'supabase',
        label: 'Supabase',
        value: 'erreur',
        status: 'red',
        hint: error.message,
      }
    }
    const status: HealthStatus = elapsed < 200 ? 'green' : elapsed < 1000 ? 'orange' : 'red'
    return {
      id: 'supabase',
      label: 'Supabase',
      value: formatMs(elapsed),
      status,
      hint: 'Latence ping PostgreSQL',
    }
  } catch (e) {
    return {
      id: 'supabase',
      label: 'Supabase',
      value: 'unreachable',
      status: 'red',
      hint: e instanceof Error ? e.message : 'unknown error',
    }
  }
}

async function checkAnthropic(): Promise<HealthCheck> {
  // V1 : on regarde la dernière row ai_usage avec provider='anthropic'.
  // Si < 1h → green (le système IA répond et facture). Sinon orange/inconnu.
  const adminDb = createAdminClient()
  const { data, error } = await adminDb
    .from('ai_usage')
    .select('created_at')
    .eq('provider', 'anthropic')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<AiUsageProbeRow>()

  if (error) {
    return {
      id: 'anthropic',
      label: 'Anthropic',
      value: 'erreur',
      status: 'red',
      hint: error.message,
    }
  }

  if (!data) {
    return {
      id: 'anthropic',
      label: 'Anthropic',
      value: '—',
      status: 'unknown',
      hint: 'Aucun appel IA enregistré',
    }
  }

  const ageMs = Date.now() - new Date(data.created_at).getTime()
  const ageMin = Math.floor(ageMs / 60_000)
  const status: HealthStatus = ageMin < 60 ? 'green' : ageMin < 24 * 60 ? 'orange' : 'unknown'
  return {
    id: 'anthropic',
    label: 'Anthropic',
    value:
      ageMin < 60 ? `${ageMin} min` : ageMin < 24 * 60 ? `${Math.floor(ageMin / 60)} h` : '> 1 j',
    status,
    hint: 'Dernier appel IA',
  }
}

async function checkStripe(): Promise<HealthCheck> {
  // V1 : pas de table stripe_events dans le schéma. On regarde la table
  // subscriptions (proxy : si dernier UPDATE récent → webhook actif).
  const adminDb = createAdminClient()
  const { data, error } = await adminDb
    .from('subscriptions')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ updated_at: string }>()

  if (error) {
    return { id: 'stripe', label: 'Stripe', value: 'erreur', status: 'red', hint: error.message }
  }
  if (!data) {
    return {
      id: 'stripe',
      label: 'Stripe',
      value: '—',
      status: 'unknown',
      hint: 'Aucun abonnement (normal au lancement)',
    }
  }
  const ageMs = Date.now() - new Date(data.updated_at).getTime()
  const ageH = Math.floor(ageMs / 3_600_000)
  const status: HealthStatus = ageH < 24 * 7 ? 'green' : ageH < 24 * 30 ? 'orange' : 'unknown'
  return {
    id: 'stripe',
    label: 'Stripe',
    value: ageH < 24 ? `${ageH} h` : `${Math.floor(ageH / 24)} j`,
    status,
    hint: 'Dernière mise à jour abonnement',
  }
}

function checkResend(): HealthCheck {
  // V2 TODO : ping Resend health endpoint (https://status.resend.com)
  return {
    id: 'resend',
    label: 'Resend',
    value: 'OK',
    status: 'green',
    hint: 'Pas de sonde V1 — placeholder',
  }
}

async function checkStorage(): Promise<HealthCheck> {
  // storage.objects expose bucket_id, name, metadata->>size (jsonb).
  // On compte les objets du bucket 'photos' + somme size.
  // Le client est typé Database<'public'> donc on cast pour adresser le schema
  // 'storage'. supabase.schema() existe à runtime même si pas dans les types.
  const adminDb = createAdminClient()
  try {
    const schemaFn = (
      adminDb as unknown as {
        schema: (name: string) => {
          from: (table: string) => {
            select: (columns: string) => {
              eq: (
                column: string,
                value: string,
              ) => {
                limit: (n: number) => Promise<StorageObjectsQuery>
              }
            }
          }
        }
      }
    ).schema

    const { data, error } = await schemaFn('storage')
      .from('objects')
      .select('name, metadata')
      .eq('bucket_id', 'photos')
      .limit(10000)

    if (error) {
      return {
        id: 'storage',
        label: 'Storage',
        value: 'erreur',
        status: 'red',
        hint: error.message,
      }
    }

    const rows = data ?? []
    const totalBytes = rows.reduce((acc, row) => {
      const size = row.metadata?.size ?? 0
      return acc + (typeof size === 'number' ? size : 0)
    }, 0)

    return {
      id: 'storage',
      label: 'Storage photos',
      value: `${rows.length} · ${formatBytes(totalBytes)}`,
      status: 'green',
      hint: 'Bucket photos',
    }
  } catch (e) {
    return {
      id: 'storage',
      label: 'Storage photos',
      value: 'erreur',
      status: 'red',
      hint: e instanceof Error ? e.message : 'unknown',
    }
  }
}

async function checkQueue(): Promise<HealthCheck> {
  const adminDb = createAdminClient()
  const { count, error } = await adminDb
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued')

  if (error) {
    return { id: 'queue', label: 'Queue jobs', value: 'erreur', status: 'red', hint: error.message }
  }
  const queued = count ?? 0
  const status: HealthStatus = queued === 0 ? 'green' : queued < 50 ? 'orange' : 'red'
  return {
    id: 'queue',
    label: 'Queue jobs',
    value: `${queued} en attente`,
    status,
    hint: 'Table jobs (status=queued)',
  }
}

export async function GET() {
  const access = await verifyAdminAccess()
  if (!access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const [supabaseCheck, anthropicCheck, stripeCheck, storageCheck, queueCheck] = await Promise.all([
    checkSupabase(),
    checkAnthropic(),
    checkStripe(),
    checkStorage(),
    checkQueue(),
  ])

  const response: HealthResponse = {
    generated_at: new Date().toISOString(),
    checks: [supabaseCheck, anthropicCheck, stripeCheck, checkResend(), storageCheck, queueCheck],
  }

  return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } })
}
