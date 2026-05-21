/**
 * KOVAS — Dispatch multi-envoi K1.
 *
 * Appelé après vérification email du requester. Sélectionne 5 diag via
 * multi-recipient-router, insère les recipients en DB, envoie un email à chacun
 * (template adapté selon claimed/unclaimed) + email récap au requester.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { renderEmailToDiagnostician } from '@/emails/quote-request/render'
import { renderQuoteSentToMultipleEmail } from '@/emails/quote-request/verification-code'
import { sendEmail } from '@/lib/email/send'
import {
  DEFAULT_ROUTING_OPTIONS,
  insertRecipientsBatch,
  selectRecipientsForRequest,
} from '@/lib/leads/multi-recipient-router'
import { DIAGNOSTIC_LABEL, type DiagnosticCode } from '@/lib/quote-request/diagnostics'

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
  display_name: string
  city: string | null
  official_email: string | null
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

  // 3. Insert recipients (DB)
  const inserted = await insertRecipientsBatch(supabase, quoteRequestId, recipients)
  if (inserted.length === 0) {
    return { totalRecipients: 0, notifiedDiagnosticianIds: [] }
  }

  // 4. Récupère les infos diag (email + claimed_by) pour envoi
  const diagIds = inserted.map((r) => r.diagnostician_id)
  // biome-ignore lint/suspicious/noExplicitAny: A1 table
  const { data: diagRows, error: diagErr } = await (supabase as any)
    .from('diagnosticians')
    .select('id, display_name, city, official_email, claimed_by_user_id')
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
    if (!diag || !diag.official_email) continue

    const { subject, html, text } = renderEmailToDiagnostician(
      {
        display_name: diag.display_name,
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
      to: diag.official_email,
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
