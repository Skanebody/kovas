/**
 * Helpers d'accès à la table `accounting_connectors` côté serveur Next.js.
 *
 * Toutes les écritures passent par la `service_role_key` (lecture token chiffré
 * incluse) afin d'éviter d'exposer le ciphertext via PostgREST RLS au client.
 */

import { decryptToken, encryptToken } from '@/lib/security/encrypt'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { QontoClient } from './client'
import type { QontoCredentials } from './types'

export type AccountingProvider = 'qonto' | 'pennylane' | 'indy' | 'tiime'
export type ConnectorStatus = 'active' | 'inactive' | 'error'

export interface AccountingConnectorRow {
  id: string
  organization_id: string
  provider: AccountingProvider
  status: ConnectorStatus
  last_sync_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

interface AccountingConnectorWithToken extends AccountingConnectorRow {
  token_encrypted: string
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      '[connector-store] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquant.',
    )
  }
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } })
}

/** Renvoie le connecteur (sans le token) pour affichage UI. */
export async function getConnector(
  orgId: string,
  provider: AccountingProvider,
): Promise<AccountingConnectorRow | null> {
  const admin = getAdmin()
  const { data, error } = await admin
    .from('accounting_connectors')
    .select(
      'id, organization_id, provider, status, last_sync_at, last_error, created_at, updated_at',
    )
    .eq('organization_id', orgId)
    .eq('provider', provider)
    .maybeSingle()
  if (error) throw error
  return (data as AccountingConnectorRow | null) ?? null
}

/** Renvoie le connecteur + token déchiffré. À n'utiliser qu'en endpoint sync. */
export async function getConnectorWithCredentials(
  orgId: string,
  provider: AccountingProvider,
): Promise<{ row: AccountingConnectorRow; credentials: QontoCredentials } | null> {
  const admin = getAdmin()
  const { data, error } = await admin
    .from('accounting_connectors')
    .select(
      'id, organization_id, provider, status, last_sync_at, last_error, created_at, updated_at, token_encrypted',
    )
    .eq('organization_id', orgId)
    .eq('provider', provider)
    .maybeSingle()
  if (error) throw error
  const row = data as AccountingConnectorWithToken | null
  if (!row) return null

  const plaintext = decryptToken(row.token_encrypted)
  // Format stocké : `login:secret`
  const colon = plaintext.indexOf(':')
  if (colon <= 0) {
    throw new Error('[connector-store] Token Qonto malformé (attendu login:secret).')
  }
  const credentials: QontoCredentials = {
    login: plaintext.slice(0, colon),
    secretKey: plaintext.slice(colon + 1),
  }
  const publicRow: AccountingConnectorRow = {
    id: row.id,
    organization_id: row.organization_id,
    provider: row.provider,
    status: row.status,
    last_sync_at: row.last_sync_at,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
  return { row: publicRow, credentials }
}

/** Upsert connecteur : remplace token + status='active'. */
export async function upsertConnector(args: {
  orgId: string
  provider: AccountingProvider
  login: string
  secretKey: string
}): Promise<AccountingConnectorRow> {
  const admin = getAdmin()
  const tokenPlain = `${args.login}:${args.secretKey}`
  const token_encrypted = encryptToken(tokenPlain)

  const { data, error } = await admin
    .from('accounting_connectors')
    .upsert(
      {
        organization_id: args.orgId,
        provider: args.provider,
        token_encrypted,
        status: 'active' as ConnectorStatus,
        last_error: null,
      },
      { onConflict: 'organization_id,provider' },
    )
    .select(
      'id, organization_id, provider, status, last_sync_at, last_error, created_at, updated_at',
    )
    .single()
  if (error) throw error
  return data as AccountingConnectorRow
}

export async function setConnectorStatus(args: {
  orgId: string
  provider: AccountingProvider
  status: ConnectorStatus
  lastError?: string | null
}): Promise<void> {
  const admin = getAdmin()
  const { error } = await admin
    .from('accounting_connectors')
    .update({
      status: args.status,
      last_error: args.lastError ?? null,
    })
    .eq('organization_id', args.orgId)
    .eq('provider', args.provider)
  if (error) throw error
}

export async function touchLastSync(args: {
  orgId: string
  provider: AccountingProvider
}): Promise<void> {
  const admin = getAdmin()
  const { error } = await admin
    .from('accounting_connectors')
    .update({
      last_sync_at: new Date().toISOString(),
      last_error: null,
      status: 'active' as ConnectorStatus,
    })
    .eq('organization_id', args.orgId)
    .eq('provider', args.provider)
  if (error) throw error
}

export async function deleteConnector(args: {
  orgId: string
  provider: AccountingProvider
}): Promise<void> {
  const admin = getAdmin()
  const { error } = await admin
    .from('accounting_connectors')
    .delete()
    .eq('organization_id', args.orgId)
    .eq('provider', args.provider)
  if (error) throw error
}

/** Instancie un QontoClient prêt à l'emploi, ou null si pas de connecteur actif. */
export async function getQontoClientForOrg(orgId: string): Promise<QontoClient | null> {
  const data = await getConnectorWithCredentials(orgId, 'qonto')
  if (!data || data.row.status !== 'active') return null
  return new QontoClient(data.credentials)
}
