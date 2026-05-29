/**
 * KOVAS — Dispatch multi-envoi K1.
 *
 * Appelé après vérification email du requester. Sélectionne 5 diag via
 * multi-recipient-router, insère les recipients en DB, envoie un email à chacun
 * (template adapté selon claimed/unclaimed) + email récap au requester.
 */

import { renderEmailToDiagnostician } from '@/emails/quote-request/render'
import { renderQuoteSentToMultipleEmail } from '@/emails/quote-request/verification-code'
import { sendEmail } from '@/lib/email/send'
import { createLeadAssignments } from '@/lib/leads/create-lead-assignments'
import {
  DEFAULT_ROUTING_OPTIONS,
  insertRecipientsBatch,
  selectRecipientsForRequest,
} from '@/lib/leads/multi-recipient-router'
import { DIAGNOSTIC_LABEL, type DiagnosticCode } from '@/lib/quote-request/diagnostics'
import type { SupabaseClient } from '@supabase/supabase-js'

interface QuoteRequestRow {
  id: string
  diagnostician_id: string
  public_tracking_token: string
  requester_first_name: string
  requester_last_name: string
  requester_email: string
  requester_phone: string | null
  property_type: string
  property_situation: string
  property_address: string | null
  property_postal_code: string | null
  property_city: string | null
  property_surface_m2: number | null
  property_year_built: number | null
  property_geo_lat: number | null
  property_geo_lng: number | null
  diagnostics_requested: string[]
  message: string | null
}

interface DiagInfoRow {
  id: string
  /** Lu depuis `diagnosticians.full_name` (colonne canonique post-FIX-AA). */
  full_name: string
  city: string | null
  /** Lu depuis `diagnosticians.email` (colonne canonique post-FIX-AA). */
  email: string | null
  claimed_by_user_id: string | null
}

export interface DispatchResult {
  totalRecipients: number
  notifiedDiagnosticianIds: string[]
}

export async function dispatchRecipients(
  // biome-ignore lint/suspicious/noExplicitAny: client générique service_role
  supabase: SupabaseClient<any, any, any>,
  quoteRequestId: string,
  baseUrl: string,
): Promise<DispatchResult> {
  // 1. Récupère la demande
  // biome-ignore lint/suspicious/noExplicitAny: dynamic table
  const { data: reqData, error: reqError } = await (supabase as any)
    .from('quote_requests')
    .select(
      'id, diagnostician_id, public_tracking_token, requester_first_name, requester_last_name, requester_email, requester_phone, property_type, property_situation, property_address, property_postal_code, property_city, property_surface_m2, property_year_built, property_geo_lat, property_geo_lng, diagnostics_requested, message',
    )
    .eq('id', quoteRequestId)
    .maybeSingle()

  if (reqError || !reqData) {
    console.error('[dispatch-recipients] quote_request not found', { quoteRequestId })
    return { totalRecipients: 0, notifiedDiagnosticianIds: [] }
  }
  const request = reqData as QuoteRequestRow

  // 2. Sélectionne les recipients
  const recipients = await selectRecipientsForRequest(
    supabase,
    {
      property_city: request.property_city,
      property_postal_code: request.property_postal_code,
      property_geo_lat: request.property_geo_lat,
      property_geo_lng: request.property_geo_lng,
      diagnostics_requested: request.diagnostics_requested,
      primary_diagnostician_id: request.diagnostician_id,
    },
    DEFAULT_ROUTING_OPTIONS,
  )

  if (recipients.length === 0) {
    console.warn('[dispatch-recipients] no recipients selected', { quoteRequestId })
    return { totalRecipients: 0, notifiedDiagnosticianIds: [] }
  }

  // 3. Insert recipients (DB) — miroir K1 pour le tracking email + ghost lifecycle.
  const inserted = await insertRecipientsBatch(supabase, quoteRequestId, recipients)
  if (inserted.length === 0) {
    return { totalRecipients: 0, notifiedDiagnosticianIds: [] }
  }

  // 3bis. Crée les lead_assignments (SOURCE DE VÉRITÉ in-app — lue par le dashboard
  //       diagnostiqueur, l'admin et les stats). Même sélection que les recipients
  //       ci-dessus : cohérence stricte email ↔ in-app. Idempotent.
  await createLeadAssignments(
    supabase,
    quoteRequestId,
    inserted.map((r) => ({ diagnosticianId: r.diagnostician_id, tier: r.recipient_tier })),
  )

  // 3ter. Marque le lead comme routé (routed_at + routing_strategy). Indispensable
  //       pour expire_pending_lead_assignments() qui ne ferme que les leads routés.
  //       Heuristique strategy : tier max présent (premium > verified > basic).
  const tiers = new Set(inserted.map((r) => r.recipient_tier))
  const routingStrategy = tiers.has('premium')
    ? 'subscribed_nearby'
    : tiers.has('verified')
      ? 'claimed_non_subscribed'
      : 'onboarding_gift'
  // biome-ignore lint/suspicious/noExplicitAny: dynamic table non typée (régen pending)
  await (supabase as any)
    .from('quote_requests')
    .update({
      routed_at: new Date().toISOString(),
      routing_strategy: routingStrategy,
      routing_metadata: {
        recipients_count: inserted.length,
        tiers: Array.from(tiers),
        source: 'dispatch_recipients',
      },
    })
    .eq('id', quoteRequestId)
    .is('routed_at', null)

  // 4. Récupère les infos diag (email + claimed_by) pour envoi
  // Colonnes canoniques diagnosticians : full_name (PAS display_name post-FIX-AA).
  const diagIds = inserted.map((r) => r.diagnostician_id)
  // biome-ignore lint/suspicious/noExplicitAny: A1 table
  const { data: diagRows, error: diagErr } = await (supabase as any)
    .from('diagnosticians')
    .select('id, full_name, city, email, claimed_by_user_id')
    .in('id', diagIds)

  if (diagErr) {
    console.error('[dispatch-recipients] fetch diag rows failed', diagErr)
    return { totalRecipients: inserted.length, notifiedDiagnosticianIds: [] }
  }

  const diagMap = new Map<string, DiagInfoRow>()
  for (const row of (diagRows ?? []) as DiagInfoRow[]) {
    diagMap.set(row.id, row)
  }

  // 5. Envoi email à chaque diag
  const notified: string[] = []
  for (const recipient of inserted) {
    const diag = diagMap.get(recipient.diagnostician_id)
    if (!diag || !diag.email) continue

    const { subject, html, text } = renderEmailToDiagnostician(
      {
        // Map full_name (DB canonique) → display_name (contract template email).
        display_name: diag.full_name,
        city: diag.city ?? '',
        base_url: baseUrl,
        request_id: request.id,
      },
      {
        first_name: request.requester_first_name,
        last_name: request.requester_last_name,
        email: request.requester_email,
        phone: request.requester_phone,
        property_type: request.property_type,
        property_situation: request.property_situation,
        property_address: request.property_address,
        property_postal_code: request.property_postal_code,
        property_city: request.property_city,
        property_surface_m2: request.property_surface_m2,
        property_year_built: request.property_year_built,
        diagnostics_requested: request.diagnostics_requested as DiagnosticCode[],
        message: request.message,
      },
    )

    const result = await sendEmail({
      to: diag.email,
      subject,
      html,
      text,
      category: 'transactional',
      tags: [
        { name: 'kovas_flow', value: 'lead_dispatch' },
        { name: 'quote_request_id', value: request.id },
        { name: 'recipient_id', value: recipient.id },
      ],
    })

    if (result.success) {
      notified.push(diag.id)
      if (result.id) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic table
        await (supabase as any)
          .from('quote_request_recipients')
          .update({ resend_message_id: result.id })
          .eq('id', recipient.id)
      }
    }
  }

  // 6. Marque diag_notified_at sur quote_request
  // biome-ignore lint/suspicious/noExplicitAny: dynamic table
  await (supabase as any)
    .from('quote_requests')
    .update({ diag_notified_at: new Date().toISOString() })
    .eq('id', request.id)

  // 7. Email récap au requester
  const labels = (request.diagnostics_requested as DiagnosticCode[]).map(
    (d) => DIAGNOSTIC_LABEL[d] ?? d,
  )
  const recap = renderQuoteSentToMultipleEmail({
    first_name: request.requester_first_name,
    recipient_count: notified.length || inserted.length,
    tracking_token: request.public_tracking_token,
    base_url: baseUrl,
    diagnostics_labels: labels,
    property_city: request.property_city,
  })

  await sendEmail({
    to: request.requester_email,
    subject: recap.subject,
    html: recap.html,
    text: recap.text,
    category: 'transactional',
    tags: [{ name: 'kovas_flow', value: 'lead_dispatched_recap' }],
  })

  return {
    totalRecipients: inserted.length,
    notifiedDiagnosticianIds: notified,
  }
}
