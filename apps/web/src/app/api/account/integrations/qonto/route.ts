import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { QontoClient } from '@/lib/qonto/client'
import {
  deleteConnector,
  getConnector,
  upsertConnector,
  setConnectorStatus,
} from '@/lib/qonto/connector-store'
import { QontoApiError } from '@/lib/qonto/types'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET /api/account/integrations/qonto
 *
 * Renvoie l'état du connecteur Qonto pour l'org courante (sans token).
 */
export async function GET() {
  let orgId: string
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const conn = await getConnector(orgId, 'qonto')
  if (!conn) return NextResponse.json({ connected: false })

  return NextResponse.json({
    connected: true,
    status: conn.status,
    lastSyncAt: conn.last_sync_at,
    lastError: conn.last_error,
    createdAt: conn.created_at,
  })
}

/**
 * POST /api/account/integrations/qonto
 *
 * Body : { login: string, secretKey: string }
 * Teste la connexion, puis stocke (token AES-256-GCM).
 */
export async function POST(request: Request) {
  let orgId: string
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: { login?: string; secretKey?: string }
  try {
    payload = (await request.json()) as { login?: string; secretKey?: string }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const login = payload.login?.trim()
  const secretKey = payload.secretKey?.trim()
  if (!login || !secretKey) {
    return NextResponse.json(
      { error: 'missing_credentials', message: 'Login et clé secrète requis.' },
      { status: 400 },
    )
  }

  // Test connexion avant stockage
  try {
    const client = new QontoClient({ login, secretKey })
    const probe = await client.testConnection()
    const row = await upsertConnector({ orgId, provider: 'qonto', login, secretKey })
    return NextResponse.json({
      ok: true,
      legalName: probe.legalName,
      slug: probe.slug,
      status: row.status,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    const statusCode = err instanceof QontoApiError ? err.statusCode : 502
    return NextResponse.json(
      {
        error: 'qonto_auth_failed',
        message,
        status: statusCode,
      },
      { status: statusCode >= 400 && statusCode < 500 ? 400 : 502 },
    )
  }
}

/**
 * PATCH /api/account/integrations/qonto
 *
 * Body : { status: 'active' | 'inactive' }
 * Désactive ou réactive le connecteur sans supprimer le token.
 */
export async function PATCH(request: Request) {
  let orgId: string
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: { status?: 'active' | 'inactive' }
  try {
    payload = (await request.json()) as { status?: 'active' | 'inactive' }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (payload.status !== 'active' && payload.status !== 'inactive') {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
  }

  await setConnectorStatus({ orgId, provider: 'qonto', status: payload.status })
  return NextResponse.json({ ok: true, status: payload.status })
}

/**
 * DELETE /api/account/integrations/qonto
 *
 * Supprime le connecteur (token chiffré effacé).
 */
export async function DELETE() {
  let orgId: string
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  await deleteConnector({ orgId, provider: 'qonto' })
  return NextResponse.json({ ok: true })
}
