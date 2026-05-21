'use server'

/**
 * KOVAS — Server actions du module Devis (P2).
 *
 * Toutes les mutations passent par ces actions pour garantir :
 *   - Authentification via `getCurrentUser()`
 *   - RLS Supabase appliquée (is_member_of)
 *   - revalidatePath du listing après chaque mutation
 */

import {
  type OrganizationBranding,
  getOrganizationBranding,
} from '@/lib/branding/get-organization-branding'
import { sendEmail } from '@/lib/email/send'
import { getCurrentUser } from '@/lib/auth/current-user'
import { generateFacturxXml } from '@/lib/quotes/generate-facturx-xml'
import { generateQuotePdf } from '@/lib/quotes/generate-pdf'
import {
  type QuoteClientSnapshot,
  type QuoteLineItem,
  type QuoteOrganizationSnapshot,
  type QuotePaymentMethod,
  computeQuoteTotals,
  formatEur,
} from '@/lib/quotes/types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// ============================================
// Schémas validation
// ============================================

const lineItemSchema = z.object({
  id: z.string(),
  kind: z.enum(['diagnostic', 'pack', 'travel', 'majoration', 'custom']),
  designation: z.string().min(1).max(200),
  quantity: z.number().positive().max(999),
  unitPriceHt: z.number().min(0).max(99999),
  tvaRate: z.number().min(0).max(100),
  diagnosticType: z
    .enum(['DPE', 'AMIANTE', 'PLOMB', 'GAZ', 'ELEC', 'TERMITES', 'CARREZ', 'BOUTIN', 'ERP'])
    .optional(),
  packId: z.string().optional(),
  majorationKind: z.enum(['urgency', 'weekend', 'evening']).optional(),
})

const createQuoteSchema = z.object({
  clientId: z.string().uuid(),
  propertyId: z.string().uuid().optional().nullable(),
  missionId: z.string().uuid().optional().nullable(),
  lines: z.array(lineItemSchema).min(1, 'Au moins une prestation est requise.'),
  notes: z.string().max(2000).optional().nullable(),
  paymentMethod: z.enum(['virement', 'sepa', 'cheque', 'especes', 'cb']),
  paymentTermsDays: z.number().int().min(0).max(365),
  expiresInDays: z.number().int().min(7).max(90).default(30),
})

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>

const updateQuoteSchema = createQuoteSchema.partial().extend({
  id: z.string().uuid(),
})

export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>

// ============================================
// Helpers
// ============================================

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

interface SupabaseClient {
  from: (table: string) => unknown
  storage: {
    from: (bucket: string) => unknown
  }
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{
    data: unknown
    error: { message: string } | null
  }>
}

async function generateQuoteReference(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('generate_quote_reference', {
    p_org: orgId,
  })
  if (error || typeof data !== 'string') {
    throw new Error(`Impossible de générer la référence devis : ${error?.message ?? 'inconnu'}`)
  }
  return data
}

async function buildClientSnapshot(
  supabase: SupabaseClient,
  orgId: string,
  clientId: string,
): Promise<QuoteClientSnapshot> {
  const client = supabase.from('clients') as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: ClientRow | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
  interface ClientRow {
    display_name: string
    email: string | null
    phone: string | null
    company_name: string | null
    siret: string | null
    address: string | null
    city: string | null
    postal_code: string | null
  }
  const { data } = await client
    .select('display_name, email, phone, company_name, siret, address, city, postal_code')
    .eq('id', clientId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!data) {
    throw new Error('Client introuvable.')
  }
  return {
    displayName: data.display_name,
    email: data.email,
    phone: data.phone,
    companyName: data.company_name,
    siret: data.siret,
    address: data.address,
    city: data.city,
    postalCode: data.postal_code,
  }
}

async function buildOrganizationSnapshot(
  supabase: SupabaseClient,
  orgId: string,
): Promise<QuoteOrganizationSnapshot> {
  const orgClient = supabase.from('organizations') as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{
          data: OrgRow | null
          error: { message: string } | null
        }>
      }
    }
  }
  interface OrgRow {
    name: string
    siret: string | null
    vat_number: string | null
    address: string | null
    city: string | null
    postal_code: string | null
    country: string | null
    certification_n: string | null
  }
  const { data } = await orgClient
    .select('name, siret, vat_number, address, city, postal_code, country, certification_n')
    .eq('id', orgId)
    .maybeSingle()

  if (!data) {
    throw new Error('Organisation introuvable.')
  }
  return {
    name: data.name,
    siret: data.siret,
    vatNumber: data.vat_number,
    address: data.address,
    city: data.city,
    postalCode: data.postal_code,
    country: data.country ?? 'FR',
    certificationN: data.certification_n,
  }
}

/**
 * Télécharge le logo signed URL et le convertit en data-URL pour jspdf.
 * Retourne null si pas de logo / mime non supporté par jspdf (svg).
 */
async function fetchLogoDataUrl(
  branding: OrganizationBranding,
): Promise<string | null> {
  if (!branding.logoSignedUrl) return null
  if (branding.logoMime === 'image/svg+xml') return null // jspdf ne sait pas faire
  try {
    const res = await fetch(branding.logoSignedUrl)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mime = branding.logoMime ?? 'image/png'
    return `data:${mime};base64,${base64}`
  } catch {
    return null
  }
}

// ============================================
// 1. Create draft
// ============================================

export interface QuoteActionResult {
  success: boolean
  quoteId?: string
  error?: string
}

export async function createQuoteDraftAction(
  input: CreateQuoteInput,
): Promise<QuoteActionResult> {
  const parsed = createQuoteSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Input invalide.' }
  }

  const { supabase, orgId, user } = await getCurrentUser()
  const sb = supabase as unknown as SupabaseClient

  let reference: string
  try {
    reference = await generateQuoteReference(sb, orgId)
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erreur référence.' }
  }

  const totals = computeQuoteTotals(parsed.data.lines)
  const issuedAt = todayIsoDate()
  const expiresAt = addDaysIso(issuedAt, parsed.data.expiresInDays)
  const tvaRate = parsed.data.lines[0]?.tvaRate ?? 20

  let clientSnapshot: QuoteClientSnapshot
  try {
    clientSnapshot = await buildClientSnapshot(sb, orgId, parsed.data.clientId)
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Client invalide.' }
  }

  const insertClient = sb.from('quotes') as unknown as {
    insert: (row: Record<string, unknown>) => {
      select: (cols: string) => {
        single: () => Promise<{
          data: { id: string } | null
          error: { message: string } | null
        }>
      }
    }
  }

  const { data: inserted, error: insertError } = await insertClient
    .insert({
      organization_id: orgId,
      client_id: parsed.data.clientId,
      mission_id: parsed.data.missionId ?? null,
      user_id: user.id,
      reference,
      status: 'draft',
      amount_ht: totals.subtotalHt,
      amount_tva: totals.totalTva,
      amount_ttc: totals.totalTtc,
      tva_rate: tvaRate,
      line_items: parsed.data.lines,
      issued_at: issuedAt,
      expires_at: expiresAt,
      valid_until: expiresAt,
      notes: parsed.data.notes ?? null,
      payment_method: parsed.data.paymentMethod,
      payment_terms_days: parsed.data.paymentTermsDays,
      facturx_profile: 'EN16931',
      client_snapshot: clientSnapshot,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    return {
      success: false,
      error: `Création impossible : ${insertError?.message ?? 'inconnu'}`,
    }
  }

  revalidatePath('/app/devis')
  return { success: true, quoteId: inserted.id }
}

// ============================================
// 2. Update (only if draft)
// ============================================

export async function updateQuoteAction(
  input: UpdateQuoteInput,
): Promise<QuoteActionResult> {
  const parsed = updateQuoteSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Input invalide.' }
  }

  const { supabase, orgId } = await getCurrentUser()
  const sb = supabase as unknown as SupabaseClient

  // Vérif status draft
  interface QuoteStatusRow {
    status: string
  }
  const statusClient = sb.from('quotes') as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: QuoteStatusRow | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
  const { data: existing } = await statusClient
    .select('status')
    .eq('id', parsed.data.id)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!existing) return { success: false, error: 'Devis introuvable.' }
  if (existing.status !== 'draft') {
    return { success: false, error: 'Seuls les brouillons peuvent être modifiés.' }
  }

  const patch: Record<string, unknown> = {}
  if (parsed.data.lines) {
    const totals = computeQuoteTotals(parsed.data.lines)
    patch.line_items = parsed.data.lines
    patch.amount_ht = totals.subtotalHt
    patch.amount_tva = totals.totalTva
    patch.amount_ttc = totals.totalTtc
    patch.tva_rate = parsed.data.lines[0]?.tvaRate ?? 20
  }
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes
  if (parsed.data.paymentMethod) patch.payment_method = parsed.data.paymentMethod
  if (parsed.data.paymentTermsDays !== undefined) {
    patch.payment_terms_days = parsed.data.paymentTermsDays
  }
  if (parsed.data.expiresInDays !== undefined) {
    const issuedAt = todayIsoDate()
    const expiresAt = addDaysIso(issuedAt, parsed.data.expiresInDays)
    patch.expires_at = expiresAt
    patch.valid_until = expiresAt
  }

  const updateClient = sb.from('quotes') as unknown as {
    update: (row: Record<string, unknown>) => {
      eq: (
        col: string,
        val: string,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>
      }
    }
  }
  const { error: updateError } = await updateClient
    .update(patch)
    .eq('id', parsed.data.id)
    .eq('organization_id', orgId)

  if (updateError) {
    return { success: false, error: `Mise à jour impossible : ${updateError.message}` }
  }

  revalidatePath('/app/devis')
  revalidatePath(`/app/devis/${parsed.data.id}`)
  return { success: true, quoteId: parsed.data.id }
}

// ============================================
// 3. Send (génère PDF + XML + email)
// ============================================

interface SendableQuoteRow {
  id: string
  reference: string
  status: string
  organization_id: string
  client_id: string
  line_items: QuoteLineItem[]
  amount_ht: number
  amount_tva: number
  amount_ttc: number
  notes: string | null
  payment_method: string | null
  payment_terms_days: number | null
  issued_at: string | null
  expires_at: string | null
  facturx_profile: string | null
  client_snapshot: QuoteClientSnapshot | null
}

export async function sendQuoteAction(quoteId: string): Promise<QuoteActionResult> {
  const { supabase, orgId } = await getCurrentUser()
  const sb = supabase as unknown as SupabaseClient

  // Charge le devis
  const selectClient = sb.from('quotes') as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: SendableQuoteRow | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
  const { data: quote, error: loadError } = await selectClient
    .select(
      'id, reference, status, organization_id, client_id, line_items, amount_ht, amount_tva, amount_ttc, notes, payment_method, payment_terms_days, issued_at, expires_at, facturx_profile, client_snapshot',
    )
    .eq('id', quoteId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (loadError || !quote) {
    return { success: false, error: 'Devis introuvable.' }
  }
  if (quote.status !== 'draft') {
    return { success: false, error: 'Seuls les brouillons peuvent être envoyés.' }
  }

  // Snapshots organisation
  let orgSnapshot: QuoteOrganizationSnapshot
  try {
    orgSnapshot = await buildOrganizationSnapshot(sb, orgId)
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Organisation invalide.' }
  }

  // Snapshot client : utilise celui figé si présent, sinon recharge
  let clientSnapshot: QuoteClientSnapshot
  if (quote.client_snapshot) {
    clientSnapshot = quote.client_snapshot
  } else {
    try {
      clientSnapshot = await buildClientSnapshot(sb, orgId, quote.client_id)
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Client invalide.' }
    }
  }

  // Branding (logo + couleur)
  const branding = await getOrganizationBranding(supabase, orgId)
  const logoDataUrl = await fetchLogoDataUrl(branding)

  const issuedAt = quote.issued_at ?? todayIsoDate()
  const expiresAt = quote.expires_at ?? addDaysIso(issuedAt, 30)
  const paymentMethod = (quote.payment_method ?? 'virement') as QuotePaymentMethod
  const paymentTermsDays = quote.payment_terms_days ?? 30

  // Génère le PDF
  let pdfBuffer: Buffer
  try {
    pdfBuffer = generateQuotePdf({
      reference: quote.reference,
      issuedAt,
      expiresAt,
      lines: quote.line_items,
      organization: orgSnapshot,
      client: clientSnapshot,
      notes: quote.notes,
      paymentTermsDays,
      paymentMethod,
      brandColorHex: branding.brandColorHex,
      logoDataUrl,
    })
  } catch (err) {
    return {
      success: false,
      error: `Génération PDF échouée : ${err instanceof Error ? err.message : 'inconnu'}`,
    }
  }

  // Génère le XML Factur-X
  const profileRaw = (quote.facturx_profile ?? 'EN16931') as 'BASIC' | 'EN16931' | 'EXTENDED'
  const facturxXml = generateFacturxXml({
    reference: quote.reference,
    issuedAt,
    expiresAt,
    lines: quote.line_items,
    totalHt: quote.amount_ht,
    totalTva: quote.amount_tva,
    totalTtc: quote.amount_ttc,
    paymentTermsDays,
    paymentMethod,
    organization: orgSnapshot,
    client: clientSnapshot,
    profile: profileRaw,
  })

  // Upload PDF Storage
  const path = `${orgId}/${quoteId}.pdf`
  const storage = sb.storage.from('quotes-pdfs') as unknown as {
    upload: (
      path: string,
      file: Buffer,
      options: { contentType: string; upsert: boolean },
    ) => Promise<{ error: { message: string } | null }>
    createSignedUrl: (
      path: string,
      ttl: number,
    ) => Promise<{
      data: { signedUrl: string } | null
      error: { message: string } | null
    }>
  }
  const { error: uploadError } = await storage.upload(path, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (uploadError) {
    return { success: false, error: `Upload PDF échoué : ${uploadError.message}` }
  }

  // Signed URL 7 jours
  const { data: signed } = await storage.createSignedUrl(path, 7 * 24 * 60 * 60)
  const signedUrl = signed?.signedUrl ?? null

  // Update DB (status sent, pdf_path, sent_at, facturx_xml, client_snapshot figé)
  const updateClient = sb.from('quotes') as unknown as {
    update: (row: Record<string, unknown>) => {
      eq: (
        col: string,
        val: string,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>
      }
    }
  }
  const { error: updateError } = await updateClient
    .update({
      status: 'sent',
      pdf_path: path,
      sent_at: new Date().toISOString(),
      facturx_xml: facturxXml,
      client_snapshot: clientSnapshot,
      issued_at: issuedAt,
      expires_at: expiresAt,
    })
    .eq('id', quoteId)
    .eq('organization_id', orgId)

  if (updateError) {
    return { success: false, error: `Mise à jour devis impossible : ${updateError.message}` }
  }

  // Envoi email au client (si email présent)
  if (clientSnapshot.email) {
    const downloadLink = signedUrl ?? 'lien indisponible — recontacter le cabinet'
    const text = `Bonjour ${clientSnapshot.displayName},

Veuillez trouver ci-joint votre devis ${quote.reference} d'un montant de ${formatEur(quote.amount_ttc)} TTC, valable jusqu'au ${expiresAt}.

Téléchargement du PDF (lien valable 7 jours) :
${downloadLink}

Pour valider ce devis, vous pouvez nous répondre par retour d'email ou par courrier signé.

Cordialement,
${orgSnapshot.name}
${orgSnapshot.siret ? `SIRET ${orgSnapshot.siret}` : ''}`

    await sendEmail({
      to: clientSnapshot.email,
      subject: `Devis ${quote.reference} — ${orgSnapshot.name}`,
      text,
      category: 'transactional',
    })
  }

  revalidatePath('/app/devis')
  revalidatePath(`/app/devis/${quoteId}`)
  return { success: true, quoteId }
}

// ============================================
// 4. Mark accepted / refused (manuel V1)
// ============================================

export async function markQuoteAcceptedAction(quoteId: string): Promise<QuoteActionResult> {
  return updateQuoteStatus(quoteId, 'accepted', 'sent')
}

export async function markQuoteRefusedAction(quoteId: string): Promise<QuoteActionResult> {
  return updateQuoteStatus(quoteId, 'refused', 'sent')
}

async function updateQuoteStatus(
  quoteId: string,
  next: 'accepted' | 'refused',
  requiredCurrent: string,
): Promise<QuoteActionResult> {
  const { supabase, orgId } = await getCurrentUser()
  const sb = supabase as unknown as SupabaseClient

  const statusClient = sb.from('quotes') as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: { status: string } | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
  const { data: existing } = await statusClient
    .select('status')
    .eq('id', quoteId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!existing) return { success: false, error: 'Devis introuvable.' }
  if (existing.status !== requiredCurrent) {
    return {
      success: false,
      error: `Action impossible — statut actuel : ${existing.status}.`,
    }
  }

  const patch: Record<string, unknown> = { status: next }
  if (next === 'accepted') {
    patch.accepted_at = new Date().toISOString()
  }

  const updateClient = sb.from('quotes') as unknown as {
    update: (row: Record<string, unknown>) => {
      eq: (
        col: string,
        val: string,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>
      }
    }
  }
  const { error } = await updateClient
    .update(patch)
    .eq('id', quoteId)
    .eq('organization_id', orgId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/app/devis')
  revalidatePath(`/app/devis/${quoteId}`)
  return { success: true, quoteId }
}

// ============================================
// 5. Delete (soft, only if draft)
// ============================================

export async function deleteQuoteDraftAction(quoteId: string): Promise<QuoteActionResult> {
  const { supabase, orgId } = await getCurrentUser()
  const sb = supabase as unknown as SupabaseClient

  const statusClient = sb.from('quotes') as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: { status: string } | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
  const { data: existing } = await statusClient
    .select('status')
    .eq('id', quoteId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!existing) return { success: false, error: 'Devis introuvable.' }
  if (existing.status !== 'draft') {
    return { success: false, error: 'Seuls les brouillons peuvent être supprimés.' }
  }

  const updateClient = sb.from('quotes') as unknown as {
    update: (row: Record<string, unknown>) => {
      eq: (
        col: string,
        val: string,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>
      }
    }
  }
  const { error } = await updateClient
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', quoteId)
    .eq('organization_id', orgId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/app/devis')
  return { success: true, quoteId }
}

// ============================================
// 6. Quick create client inline (depuis wizard)
// ============================================

const quickClientSchema = z.object({
  displayName: z.string().min(2).max(200),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().max(30).optional().nullable(),
  companyName: z.string().max(200).optional().nullable(),
  siret: z.string().max(20).optional().nullable(),
})

export type QuickClientInput = z.infer<typeof quickClientSchema>

export interface QuickClientResult {
  success: boolean
  clientId?: string
  displayName?: string
  error?: string
}

export async function createQuickClientAction(
  input: QuickClientInput,
): Promise<QuickClientResult> {
  const parsed = quickClientSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Input invalide.' }
  }

  const { supabase, orgId, user } = await getCurrentUser()
  const sb = supabase as unknown as SupabaseClient

  const insertClient = sb.from('clients') as unknown as {
    insert: (row: Record<string, unknown>) => {
      select: (cols: string) => {
        single: () => Promise<{
          data: { id: string; display_name: string } | null
          error: { message: string } | null
        }>
      }
    }
  }

  const emailValue =
    parsed.data.email && parsed.data.email.length > 0 ? parsed.data.email : null

  const { data, error } = await insertClient
    .insert({
      organization_id: orgId,
      type: 'particulier',
      display_name: parsed.data.displayName,
      email: emailValue,
      phone: parsed.data.phone ?? null,
      company_name: parsed.data.companyName ?? null,
      siret: parsed.data.siret ?? null,
      created_by: user.id,
    })
    .select('id, display_name')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Création client impossible.' }
  }
  revalidatePath('/app/clients')
  return { success: true, clientId: data.id, displayName: data.display_name }
}

// ============================================
// 7. Redirect helper après création (utilisé par form action)
// ============================================

export async function createAndRedirectAction(input: CreateQuoteInput): Promise<void> {
  const result = await createQuoteDraftAction(input)
  if (result.success && result.quoteId) {
    redirect(`/app/devis/${result.quoteId}`)
  }
  // Si erreur : on laisse le client gérer (toast)
}
