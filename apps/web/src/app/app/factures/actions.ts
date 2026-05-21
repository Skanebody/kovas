'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { generateInvoicePdf } from '@/lib/invoices/generate-pdf'
import { generateFacturxXml } from '@/lib/invoices/generate-facturx-xml'
import {
  getInvoicePdfSignedUrl,
  uploadInvoicePdf,
} from '@/lib/invoices/storage'
import { createInvoicePaymentLink } from '@/lib/invoices/stripe-payment-link'
import {
  sendInvoiceIssuedEmail,
  sendReminderJ7Email,
  sendReminderJ15Email,
  sendReminderJ30Email,
} from '@/lib/invoices/emails'
import {
  computeInvoiceTotals,
  type InvoiceClientSnapshot,
  type InvoiceIssuerSnapshot,
  type InvoiceLineItem,
  parseLineItems,
  type PaymentMethod,
} from '@/lib/invoices/types'
import type { Json } from '@kovas/database/types'

// ──────────────────────────────────────────────────────────────────────
// Validation utilitaires
// ──────────────────────────────────────────────────────────────────────

function parseFormLineItems(raw: FormDataEntryValue | null): InvoiceLineItem[] {
  if (typeof raw !== 'string' || raw.length === 0) return []
  try {
    const parsed = JSON.parse(raw)
    return parseLineItems(parsed)
  } catch {
    return []
  }
}

function toNum(value: FormDataEntryValue | null, fallback = 0): number {
  if (typeof value !== 'string') return fallback
  const n = Number.parseFloat(value.replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

function toStr(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

// ──────────────────────────────────────────────────────────────────────
// 1. createInvoiceDraftAction — INSERT draft
// ──────────────────────────────────────────────────────────────────────

export type InvoiceFormState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | undefined

export async function createInvoiceDraftAction(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const { supabase, orgId, user } = await getCurrentUser()

  const clientId = toStr(formData.get('client_id'))
  const missionId = toStr(formData.get('mission_id'))
  const quoteId = toStr(formData.get('quote_id'))
  const lineItems = parseFormLineItems(formData.get('line_items'))
  const tvaRate = toNum(formData.get('tva_rate'), 20)
  const paymentTermsDays = Math.max(
    1,
    Math.min(60, Math.floor(toNum(formData.get('payment_terms_days'), 30))),
  )
  const paymentMethod = (toStr(formData.get('payment_method')) ?? 'virement') as PaymentMethod
  const notes = toStr(formData.get('notes'))

  if (!clientId) return { error: 'Client requis', fieldErrors: { client_id: 'Client requis' } }
  if (lineItems.length === 0)
    return {
      error: 'Ajoutez au moins une prestation',
      fieldErrors: { line_items: 'Au moins 1 ligne requise' },
    }

  // Calcule totaux
  const totals = computeInvoiceTotals(lineItems)

  // Référence générée via RPC sécurisée
  const { data: refData, error: refErr } = await supabase.rpc('generate_invoice_reference', {
    p_org_id: orgId,
  })
  if (refErr) return { error: `Erreur génération référence : ${refErr.message}` }
  const reference = String(refData)

  const issuedAt = new Date().toISOString().slice(0, 10)
  const dueDateObj = new Date()
  dueDateObj.setDate(dueDateObj.getDate() + paymentTermsDays)
  const dueDate = dueDateObj.toISOString().slice(0, 10)

  const { data: inserted, error } = await supabase
    .from('invoices')
    .insert({
      organization_id: orgId,
      client_id: clientId,
      mission_id: missionId,
      quote_id: quoteId,
      reference,
      status: 'draft',
      amount_ht: totals.amount_ht,
      amount_tva: totals.amount_tva,
      amount_ttc: totals.amount_ttc,
      tva_rate: tvaRate,
      line_items: lineItems as unknown as Json,
      payment_terms_days: paymentTermsDays,
      payment_method: paymentMethod,
      notes,
      issued_at: issuedAt,
      due_date: dueDate,
      user_id: user.id,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    return { error: error?.message ?? 'Erreur insertion facture' }
  }

  revalidatePath('/app/factures')
  redirect(`/app/factures/${inserted.id}`)
}

// ──────────────────────────────────────────────────────────────────────
// 2. convertQuoteToInvoiceAction — devis accepted → invoice draft
// ──────────────────────────────────────────────────────────────────────

export async function convertQuoteToInvoiceAction(quoteId: string): Promise<{
  error?: string
  invoiceId?: string
}> {
  const { supabase, orgId, user } = await getCurrentUser()

  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .select(
      'id, organization_id, client_id, mission_id, reference, amount_ht, amount_tva, amount_ttc, tva_rate, line_items, status',
    )
    .eq('id', quoteId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (quoteErr || !quote) return { error: 'Devis introuvable' }
  if (quote.status !== 'accepted') {
    return { error: 'Seuls les devis acceptés peuvent être convertis en facture.' }
  }

  // Vérifie qu'on n'a pas déjà une facture liée
  const { data: existing } = await supabase
    .from('invoices')
    .select('id')
    .eq('organization_id', orgId)
    .eq('quote_id', quoteId)
    .limit(1)
    .maybeSingle()
  if (existing?.id) {
    return { invoiceId: existing.id }
  }

  const { data: refData, error: refErr } = await supabase.rpc('generate_invoice_reference', {
    p_org_id: orgId,
  })
  if (refErr) return { error: `Erreur génération référence : ${refErr.message}` }
  const reference = String(refData)

  const issuedAt = new Date().toISOString().slice(0, 10)
  const dueDateObj = new Date()
  dueDateObj.setDate(dueDateObj.getDate() + 30)
  const dueDate = dueDateObj.toISOString().slice(0, 10)

  const { data: inserted, error } = await supabase
    .from('invoices')
    .insert({
      organization_id: orgId,
      client_id: quote.client_id,
      mission_id: quote.mission_id,
      quote_id: quote.id,
      reference,
      status: 'draft',
      amount_ht: Number(quote.amount_ht),
      amount_tva: Number(quote.amount_tva),
      amount_ttc: Number(quote.amount_ttc),
      tva_rate: Number(quote.tva_rate ?? 20),
      line_items: quote.line_items,
      payment_terms_days: 30,
      payment_method: 'virement' as PaymentMethod,
      issued_at: issuedAt,
      due_date: dueDate,
      user_id: user.id,
    })
    .select('id')
    .single()

  if (error || !inserted) return { error: error?.message ?? 'Erreur conversion devis' }

  revalidatePath('/app/factures')
  return { invoiceId: inserted.id }
}

// ──────────────────────────────────────────────────────────────────────
// 3. issueInvoiceAction — génère PDF + XML + email + lock
// ──────────────────────────────────────────────────────────────────────

export async function issueInvoiceAction(invoiceId: string): Promise<{
  error?: string
  pdfPath?: string
}> {
  const { supabase, orgId } = await getCurrentUser()

  // Charge facture + relations (client + org)
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (invErr || !invoice) return { error: 'Facture introuvable' }
  if (invoice.status !== 'draft') {
    return { error: 'Seules les factures en brouillon peuvent être émises.' }
  }
  if (!invoice.client_id) return { error: 'Client manquant' }

  // Charge client
  const { data: client } = await supabase
    .from('clients')
    .select('display_name, email, phone, address, city, postal_code, country, siret, type, first_name')
    .eq('id', invoice.client_id)
    .maybeSingle()
  if (!client) return { error: 'Client introuvable' }

  // Charge organisation (snapshot émetteur)
  const { data: org } = await supabase
    .from('organizations')
    .select(
      'name, siret, vat_number, address, city, postal_code, country, iban, bic, bank_name',
    )
    .eq('id', orgId)
    .maybeSingle()
  if (!org) return { error: 'Organisation introuvable' }

  // Charge éventuelles colonnes branding (Agent P1 — on lit avec defaults).
  // On utilise .select() défensif via une 2e requête typed-loose.
  const { data: orgBranding } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .maybeSingle()
  // Si Agent P1 a ajouté logo_url + brand_color_hex, ils sont accessibles via
  // un select dynamique. Pour V1, on évite la dépendance — defaults nulls.
  void orgBranding
  const logoUrl: string | null = null
  const brandColorHex: string | null = null

  const issuerSnapshot: InvoiceIssuerSnapshot = {
    name: org.name,
    siret: org.siret,
    vat_number: org.vat_number,
    address: org.address,
    city: org.city,
    postal_code: org.postal_code,
    country: org.country ?? 'FR',
    iban: org.iban,
    bic: org.bic,
    bank_name: org.bank_name,
    logo_url: logoUrl,
    brand_color_hex: brandColorHex,
  }

  const clientSnapshot: InvoiceClientSnapshot = {
    display_name: client.display_name,
    email: client.email,
    phone: client.phone,
    address: client.address,
    city: client.city,
    postal_code: client.postal_code,
    country: client.country ?? 'FR',
    siret: client.siret,
    type: client.type,
  }

  // Charge la référence du devis source si invoice.quote_id existe
  let quoteReference: string | null = null
  if (invoice.quote_id) {
    const { data: q } = await supabase
      .from('quotes')
      .select('reference')
      .eq('id', invoice.quote_id)
      .maybeSingle()
    quoteReference = q?.reference ?? null
  }

  const lineItems = parseLineItems(invoice.line_items)

  // Génère PDF
  let pdfBytes: Uint8Array
  try {
    pdfBytes = await generateInvoicePdf({
      kind: invoice.credit_note_for_invoice_id ? 'credit_note' : 'invoice',
      reference: invoice.reference,
      issuedAt: invoice.issued_at,
      dueDate: invoice.due_date,
      paymentTermsDays: invoice.payment_terms_days ?? 30,
      paymentMethod: (invoice.payment_method ?? 'virement') as PaymentMethod,
      notes: invoice.notes,
      lineItems,
      tvaRate: Number(invoice.tva_rate ?? 20),
      amountHt: Number(invoice.amount_ht),
      amountTva: Number(invoice.amount_tva),
      amountTtc: Number(invoice.amount_ttc),
      issuer: issuerSnapshot,
      client: clientSnapshot,
      quoteReference,
    })
  } catch (err) {
    return { error: `Erreur génération PDF : ${err instanceof Error ? err.message : 'inconnue'}` }
  }

  // Upload PDF
  const uploadResult = await uploadInvoicePdf(supabase, orgId, invoiceId, pdfBytes)
  if (uploadResult.error) {
    return { error: `Upload PDF échoué : ${uploadResult.error}` }
  }

  // Génère XML Factur-X
  const xml = generateFacturxXml({
    reference: invoice.reference,
    typeCode: invoice.credit_note_for_invoice_id ? '381' : '380',
    issuedAt: invoice.issued_at,
    dueDate: invoice.due_date,
    paymentTermsDays: invoice.payment_terms_days ?? 30,
    notes: invoice.notes,
    lineItems,
    tvaRate: Number(invoice.tva_rate ?? 20),
    amountHt: Number(invoice.amount_ht),
    amountTva: Number(invoice.amount_tva),
    amountTtc: Number(invoice.amount_ttc),
    issuer: issuerSnapshot,
    client: clientSnapshot,
  })

  // Stripe Payment Link (optionnel)
  const stripeResult = await createInvoicePaymentLink({
    invoiceReference: invoice.reference,
    amountTtcEur: Number(invoice.amount_ttc),
    description: clientSnapshot.display_name,
  })

  // Update DB : status=issued + snapshot + pdf_path + facturx_xml + sent_at
  const { error: updateErr } = await supabase
    .from('invoices')
    .update({
      status: 'issued',
      pdf_path: uploadResult.path,
      facturx_xml: xml,
      facturx_profile: 'EN16931',
      stripe_payment_link_url: stripeResult.url,
      client_snapshot: clientSnapshot as unknown as Json,
      sent_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .eq('organization_id', orgId)

  if (updateErr) return { error: `Update facture échouée : ${updateErr.message}` }

  // Envoi email client (si email présent)
  if (clientSnapshot.email) {
    const pdfUrl = await getInvoicePdfSignedUrl(supabase, uploadResult.path)
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', invoice.user_id ?? '')
      .maybeSingle()

    await sendInvoiceIssuedEmail({
      to: clientSnapshot.email,
      recipientFirstName: client.first_name ?? null,
      invoiceReference: invoice.reference,
      amountTtc: Number(invoice.amount_ttc),
      dueDate: invoice.due_date,
      paymentLinkUrl: stripeResult.url,
      pdfDownloadUrl: pdfUrl,
      diagnosticianName: profile?.full_name ?? org.name,
      diagnosticianEmail: profile?.email ?? 'noreply@kovas.fr',
      bankName: org.bank_name,
      iban: org.iban,
      bic: org.bic,
      notes: invoice.notes,
    })
  }

  revalidatePath('/app/factures')
  revalidatePath(`/app/factures/${invoiceId}`)
  return { pdfPath: uploadResult.path }
}

// ──────────────────────────────────────────────────────────────────────
// 4. markInvoicePaidAction
// ──────────────────────────────────────────────────────────────────────

export async function markInvoicePaidAction(input: {
  invoiceId: string
  paidAmount?: number
  paymentMethod?: PaymentMethod
  paidAt?: string
}): Promise<{ error?: string }> {
  const { supabase, orgId } = await getCurrentUser()

  const { data: invoice, error: loadErr } = await supabase
    .from('invoices')
    .select('amount_ttc, paid_amount, status')
    .eq('id', input.invoiceId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (loadErr || !invoice) return { error: 'Facture introuvable' }
  if (invoice.status === 'draft' || invoice.status === 'cancelled') {
    return { error: 'Cette facture ne peut pas être marquée payée dans son état actuel.' }
  }

  const ttc = Number(invoice.amount_ttc)
  const previousPaid = Number(invoice.paid_amount ?? 0)
  const incomingPaid = input.paidAmount !== undefined ? Number(input.paidAmount) : ttc - previousPaid

  if (incomingPaid <= 0) return { error: 'Le montant doit être supérieur à 0.' }
  if (incomingPaid > ttc - previousPaid + 0.01)
    return { error: 'Le montant dépasse le restant dû.' }

  const newPaid = Math.round((previousPaid + incomingPaid) * 100) / 100
  const isFullPaid = newPaid >= ttc - 0.01

  const paidAtIso = isFullPaid
    ? input.paidAt
      ? new Date(input.paidAt).toISOString()
      : new Date().toISOString()
    : null

  const { error } = await supabase
    .from('invoices')
    .update({
      paid_amount: newPaid,
      payment_method: input.paymentMethod ?? 'virement',
      status: isFullPaid ? 'paid' : 'partial',
      ...(paidAtIso ? { paid_at: paidAtIso } : {}),
    })
    .eq('id', input.invoiceId)
    .eq('organization_id', orgId)
  if (error) return { error: error.message }

  revalidatePath('/app/factures')
  revalidatePath(`/app/factures/${input.invoiceId}`)
  return {}
}

// ──────────────────────────────────────────────────────────────────────
// 5. sendManualReminderAction
// ──────────────────────────────────────────────────────────────────────

export async function sendManualReminderAction(invoiceId: string): Promise<{ error?: string }> {
  const { supabase, orgId } = await getCurrentUser()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(
      'id, reference, amount_ttc, paid_amount, due_date, status, client_snapshot, stripe_payment_link_url, pdf_path, user_id, organization_id, reminder_j7_sent_at, reminder_j15_sent_at, reminder_j30_sent_at',
    )
    .eq('id', invoiceId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (error || !invoice) return { error: 'Facture introuvable' }
  if (invoice.status !== 'issued' && invoice.status !== 'partial' && invoice.status !== 'overdue') {
    return { error: 'Relance impossible — facture déjà payée ou annulée.' }
  }

  // Charge organisation pour IBAN
  const { data: org } = await supabase
    .from('organizations')
    .select('name, iban, bic, bank_name')
    .eq('id', orgId)
    .maybeSingle()
  if (!org) return { error: 'Organisation introuvable' }

  // Charge profile diagnostiqueur
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', invoice.user_id ?? '')
    .maybeSingle()

  // Décide quel niveau de relance envoyer (manuel = simule J+15 par défaut)
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null
  const daysLate = dueDate
    ? Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  const snapshot = (invoice.client_snapshot ?? {}) as Partial<InvoiceClientSnapshot>
  const recipientEmail = snapshot.email
  if (!recipientEmail) return { error: 'Email client manquant — impossible de relancer.' }

  const ttc = Number(invoice.amount_ttc)
  const paid = Number(invoice.paid_amount ?? 0)
  const remaining = Math.max(0, ttc - paid)

  // Récupère signed URL PDF
  let pdfUrl: string | null = null
  if (invoice.pdf_path) {
    pdfUrl = await getInvoicePdfSignedUrl(supabase, invoice.pdf_path)
  }

  const baseArgs = {
    to: recipientEmail,
    recipientFirstName: null,
    invoiceReference: invoice.reference,
    amountTtc: ttc,
    amountUnpaid: remaining,
    daysLate,
    dueDate: invoice.due_date,
    paymentLinkUrl: invoice.stripe_payment_link_url,
    pdfDownloadUrl: pdfUrl,
    diagnosticianName: profile?.full_name ?? org.name,
    diagnosticianEmail: profile?.email ?? 'noreply@kovas.fr',
    bankName: org.bank_name,
    iban: org.iban,
    bic: org.bic,
  }

  // Envoie le niveau correspondant aux jours de retard
  const nowIso = new Date().toISOString()
  let updatePayload: {
    reminder_j7_sent_at?: string
    reminder_j15_sent_at?: string
    reminder_j30_sent_at?: string
  }
  if (daysLate >= 30) {
    await sendReminderJ30Email(baseArgs)
    updatePayload = { reminder_j30_sent_at: nowIso }
  } else if (daysLate >= 15) {
    await sendReminderJ15Email(baseArgs)
    updatePayload = { reminder_j15_sent_at: nowIso }
  } else {
    await sendReminderJ7Email(baseArgs)
    updatePayload = { reminder_j7_sent_at: nowIso }
  }

  await supabase
    .from('invoices')
    .update(updatePayload)
    .eq('id', invoiceId)
    .eq('organization_id', orgId)
  revalidatePath(`/app/factures/${invoiceId}`)
  return {}
}

// ──────────────────────────────────────────────────────────────────────
// 6. createCreditNoteAction — crée avoir lié
// ──────────────────────────────────────────────────────────────────────

export async function createCreditNoteAction(input: {
  invoiceId: string
  reason: string
  /** Si true : avoir total → la facture d'origine passe en cancelled */
  cancelOriginal?: boolean
}): Promise<{ error?: string; creditNoteId?: string }> {
  const { supabase, orgId, user } = await getCurrentUser()

  const { data: original, error: loadErr } = await supabase
    .from('invoices')
    .select(
      'id, client_id, mission_id, reference, amount_ht, amount_tva, amount_ttc, tva_rate, line_items, status, payment_terms_days, payment_method, client_snapshot',
    )
    .eq('id', input.invoiceId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (loadErr || !original) return { error: 'Facture d\'origine introuvable' }
  if (original.status === 'cancelled' || original.status === 'draft') {
    return { error: 'Avoir impossible sur une facture annulée ou en brouillon.' }
  }

  const { data: refData, error: refErr } = await supabase.rpc(
    'generate_credit_note_reference',
    { p_org_id: orgId },
  )
  if (refErr) return { error: `Erreur référence : ${refErr.message}` }
  const reference = String(refData)

  const issuedAt = new Date().toISOString().slice(0, 10)

  const { data: inserted, error } = await supabase
    .from('invoices')
    .insert({
      organization_id: orgId,
      client_id: original.client_id,
      mission_id: original.mission_id,
      credit_note_for_invoice_id: original.id,
      reference,
      status: 'draft',
      amount_ht: Number(original.amount_ht),
      amount_tva: Number(original.amount_tva),
      amount_ttc: Number(original.amount_ttc),
      tva_rate: Number(original.tva_rate ?? 20),
      line_items: original.line_items,
      payment_terms_days: original.payment_terms_days ?? 30,
      payment_method: original.payment_method,
      notes: `Motif : ${input.reason}\nAnnule la facture ${original.reference}.`,
      client_snapshot: original.client_snapshot,
      issued_at: issuedAt,
      user_id: user.id,
    })
    .select('id')
    .single()
  if (error || !inserted) return { error: error?.message ?? 'Erreur création avoir' }

  // Si avoir total : cancel l'originale
  if (input.cancelOriginal) {
    await supabase
      .from('invoices')
      .update({ status: 'cancelled' })
      .eq('id', original.id)
      .eq('organization_id', orgId)
  }

  revalidatePath('/app/factures')
  revalidatePath(`/app/factures/${original.id}`)
  return { creditNoteId: inserted.id }
}

// ──────────────────────────────────────────────────────────────────────
// 7. cancelInvoiceDraftAction (soft delete only on draft)
// ──────────────────────────────────────────────────────────────────────

export async function cancelInvoiceDraftAction(invoiceId: string): Promise<{ error?: string }> {
  const { supabase, orgId } = await getCurrentUser()
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (error || !invoice) return { error: 'Facture introuvable' }
  if (invoice.status !== 'draft') {
    return { error: 'Seules les factures en brouillon peuvent être supprimées.' }
  }
  const { error: delErr } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)
    .eq('organization_id', orgId)
  if (delErr) return { error: delErr.message }
  revalidatePath('/app/factures')
  redirect('/app/factures')
}

// ──────────────────────────────────────────────────────────────────────
// 8. getPdfDownloadUrlAction (server action helper pour client comp.)
// ──────────────────────────────────────────────────────────────────────

export async function getPdfDownloadUrlAction(invoiceId: string): Promise<{
  url: string | null
  error?: string
}> {
  const { supabase, orgId } = await getCurrentUser()
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('pdf_path')
    .eq('id', invoiceId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (error || !invoice) return { url: null, error: 'Facture introuvable' }
  if (!invoice.pdf_path) return { url: null, error: 'PDF non disponible' }
  const url = await getInvoicePdfSignedUrl(supabase, invoice.pdf_path)
  return { url }
}
