/**
 * KOVAS — Création des `lead_assignments` (source de vérité in-app).
 *
 * Contexte (refonte 2026-06-28) : le funnel devis B2C (OTP SMS → /api/leads/submit
 * → dispatchRecipients) écrivait UNIQUEMENT dans `quote_request_recipients` (table K1,
 * dédiée au tracking email + cycle de vie diag fantôme). Or le dashboard
 * diagnostiqueur (`/dashboard/leads/*`), l'admin (`/admin/leads/*`) et les stats
 * lisent `lead_assignments` (table E1). Résultat : les leads soumis n'arrivaient
 * JAMAIS dans le dashboard. Décision Benjamin : `lead_assignments` = source de vérité.
 *
 * Cette lib porte la logique d'insertion `lead_assignments` (équivalent de ce que fait
 * l'Edge Function `route-lead`) MAIS à partir des destinataires DÉJÀ sélectionnés par
 * `multi-recipient-router` (la même sélection qui sert aux emails). On évite ainsi :
 *   - une double-sélection incohérente email ↔ in-app (route-lead re-route différemment),
 *   - les emails fantômes en `email_queue` (jamais consommée par un sender déployé).
 *
 * `quote_request_recipients` reste écrit en miroir (par le router) car le cron
 * `recompute_diag_ghost_status()` en dépend (leads ignorés → ghost lifecycle) et le
 * tracking d'ouverture email (`resend_message_id`) s'y appuie.
 *
 * Mapping tier → assignment_type (contrainte CHECK lead_assignments) :
 *   premium  → 'subscribed'              (abonné KOVAS actif)
 *   verified → 'claimed_non_subscribed'  (fiche réclamée, sans abonnement)
 *   basic    → 'onboarding_gift'         (fiche DHUP non réclamée)
 *
 * Idempotent via UNIQUE(lead_id, diagnostician_id) (upsert ignoreDuplicates).
 */

import type { RecipientTier } from '@/lib/leads/multi-recipient-router'
import type { SupabaseClient } from '@supabase/supabase-js'

type AssignmentType = 'subscribed' | 'claimed_non_subscribed' | 'onboarding_gift'

/** Destinataire déjà sélectionné + persisté dans quote_request_recipients. */
export interface SelectedRecipient {
  diagnosticianId: string
  tier: RecipientTier
}

const ASSIGNMENT_TTL_HOURS = 48

function tierToAssignmentType(tier: RecipientTier): AssignmentType {
  switch (tier) {
    case 'premium':
      return 'subscribed'
    case 'verified':
      return 'claimed_non_subscribed'
    default:
      // basic = fiche DHUP non réclamée
      return 'onboarding_gift'
  }
}

export interface CreateLeadAssignmentsResult {
  insertedCount: number
  diagnosticianIds: string[]
}

/**
 * Insère les `lead_assignments` pour un lead (quote_request) déjà créé, à partir
 * des destinataires sélectionnés. Expiration 48h, status 'pending' (first-come :
 * le 1er diag à accepter "gagne", les autres expirent au close via
 * expire_pending_lead_assignments()).
 *
 * @param supabase  client service_role (bypass RLS).
 * @param leadId    quote_requests.id (FK lead_assignments.lead_id).
 * @param recipients destinataires retenus (mêmes que ceux notifiés par email).
 */
export async function createLeadAssignments(
  // biome-ignore lint/suspicious/noExplicitAny: client générique service_role
  supabase: SupabaseClient<any, any, any>,
  leadId: string,
  recipients: SelectedRecipient[],
): Promise<CreateLeadAssignmentsResult> {
  if (recipients.length === 0) {
    return { insertedCount: 0, diagnosticianIds: [] }
  }

  const expiresAt = new Date(Date.now() + ASSIGNMENT_TTL_HOURS * 3600 * 1000).toISOString()

  const rows = recipients.map((r) => ({
    lead_id: leadId,
    diagnostician_id: r.diagnosticianId,
    assignment_type: tierToAssignmentType(r.tier),
    notification_method: 'email' as const,
    status: 'pending' as const,
    expires_at: expiresAt,
    // `score` (= activity_score snapshot) non disponible depuis la vue de routing
    // multi-recipient ; laissé null (colonne nullable, non lue par le dashboard).
  }))

  // biome-ignore lint/suspicious/noExplicitAny: dynamic table non typée (régen pending)
  const { data, error } = await (supabase as any)
    .from('lead_assignments')
    .upsert(rows, { onConflict: 'lead_id,diagnostician_id', ignoreDuplicates: true })
    .select('diagnostician_id')

  if (error) {
    console.error('[create-lead-assignments] upsert failed', error)
    return { insertedCount: 0, diagnosticianIds: [] }
  }

  const inserted = (data ?? []) as Array<{ diagnostician_id: string }>
  return {
    insertedCount: inserted.length,
    diagnosticianIds: inserted.map((r) => r.diagnostician_id),
  }
}
