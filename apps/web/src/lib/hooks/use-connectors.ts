/**
 * Helper serveur pour lister l'état des 4 connecteurs comptables d'une org.
 *
 * Sert la page unifiée Compte → Intégrations. Retourne un mapping stable même
 * si aucune ligne n'existe encore dans `accounting_connectors` (status =
 * 'inactive' par défaut).
 */

import type { ConnectorStatus } from '@/components/integrations/ConnectorCard'
import { createClient } from '@/lib/supabase/server'

export type ConnectorProvider = 'qonto' | 'pennylane' | 'indy' | 'tiime'

export interface ConnectorState {
  provider: ConnectorProvider
  status: ConnectorStatus
  lastSyncAt: string | null
  lastError: string | null
}

export type ConnectorStateMap = Record<ConnectorProvider, ConnectorState>

const DEFAULT_STATE: ConnectorStateMap = {
  qonto: { provider: 'qonto', status: 'inactive', lastSyncAt: null, lastError: null },
  pennylane: { provider: 'pennylane', status: 'inactive', lastSyncAt: null, lastError: null },
  indy: { provider: 'indy', status: 'inactive', lastSyncAt: null, lastError: null },
  tiime: { provider: 'tiime', status: 'inactive', lastSyncAt: null, lastError: null },
}

export async function getConnectorsForOrg(orgId: string): Promise<ConnectorStateMap> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('accounting_connectors')
    .select('provider, status, last_sync_at, last_error')
    .eq('organization_id', orgId)

  const state: ConnectorStateMap = {
    qonto: { ...DEFAULT_STATE.qonto },
    pennylane: { ...DEFAULT_STATE.pennylane },
    indy: { ...DEFAULT_STATE.indy },
    tiime: { ...DEFAULT_STATE.tiime },
  }

  for (const row of data ?? []) {
    const provider = row.provider as ConnectorProvider
    if (!(provider in state)) continue
    state[provider] = {
      provider,
      status: row.status as ConnectorStatus,
      lastSyncAt: row.last_sync_at,
      lastError: row.last_error,
    }
  }

  return state
}

/**
 * Pour la page Indy en particulier : vérifier si une demande d'accès API est
 * en cours. Permet d'afficher "Demande en cours d'instruction" au lieu de
 * laisser le CTA "Demander l'accès" actif en double.
 */
export async function getPendingApiAccessRequest(
  orgId: string,
  provider: ConnectorProvider,
): Promise<{ id: string; requested_at: string } | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('connector_api_access_requests')
    .select('id, requested_at')
    .eq('organization_id', orgId)
    .eq('provider', provider)
    .eq('status', 'pending')
    .maybeSingle()
  return data
}
