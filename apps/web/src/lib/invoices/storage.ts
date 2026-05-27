/**
 * Upload + signed URL pour les PDFs facture (bucket `invoices-pdfs`).
 *
 * Convention path Storage : <organization_id>/<invoice_id>.pdf
 * RLS policies (cf. migration 20260527120000_invoices_v1.sql) :
 *   - lecture / écriture autorisée si is_member_of(org_id)
 *   - bucket privé : accès via signed URL TTL court (15 min) ou service_role
 */

import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export const INVOICES_BUCKET = 'invoices-pdfs'
export const SIGNED_URL_TTL_SECONDS = 60 * 15 // 15 minutes

export function invoicePdfPath(orgId: string, invoiceId: string): string {
  return `${orgId}/${invoiceId}.pdf`
}

export async function uploadInvoicePdf(
  supabase: SupabaseClient<Database>,
  orgId: string,
  invoiceId: string,
  pdfBytes: Uint8Array,
): Promise<{ path: string; error: string | null }> {
  const path = invoicePdfPath(orgId, invoiceId)
  const { error } = await supabase.storage.from(INVOICES_BUCKET).upload(path, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
    cacheControl: '3600',
  })
  if (error) return { path, error: error.message }
  return { path, error: null }
}

export async function getInvoicePdfSignedUrl(
  supabase: SupabaseClient<Database>,
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(INVOICES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error) return null
  return data?.signedUrl ?? null
}
