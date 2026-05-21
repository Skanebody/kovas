/**
 * KOVAS — Edge Function : Relances automatiques factures impayées (P3).
 *
 * Endpoint POST /functions/v1/invoice-reminders
 * Cron : tous les jours 9h CET via pg_cron + pg_net
 *
 *   SELECT cron.schedule(
 *     'invoice-reminders',
 *     '0 8 * * *',   -- 8h UTC = 9h Europe/Paris (été) / 10h hiver — ajuster
 *     $$ SELECT net.http_post(
 *          url := current_setting('app.settings.supabase_functions_url') || '/invoice-reminders',
 *          headers := jsonb_build_object(
 *            'Content-Type', 'application/json',
 *            'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
 *          )
 *        ); $$
 *   );
 *
 * Auth : header `Authorization: Bearer <CRON_SECRET>` requis (pas un JWT user).
 *
 * Workflow :
 *   1. Update status='overdue' pour les factures issued/partial avec due_date < today
 *   2. Charge factures (issued|partial|overdue) avec due_date < today
 *   3. Pour chaque facture, calcule daysLate = today - due_date
 *      - J+7  → envoie "rappel amical" si reminder_j7_sent_at IS NULL
 *      - J+15 → envoie "rappel formel" si reminder_j15_sent_at IS NULL
 *      - J+30 → envoie "mise en demeure" si reminder_j30_sent_at IS NULL
 *   4. Idempotent : on saute si reminder_jX_sent_at déjà set
 *
 * Garde-fous :
 *   - Max 200 factures traitées par tick
 *   - Skip si client_snapshot.email absent
 *   - Skip si org.iban absent (impossible de proposer paiement) ? non — on envoie
 *     quand même avec Stripe Payment Link si présent
 */

// @ts-nocheck — Deno-only Edge Function ; non compilée par tsc Node.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const BATCH_SIZE = 200
const LATE_RATE_PERCENT = 10.5
const FLAT_FEE_EUR = 40

interface InvoiceRow {
  id: string
  organization_id: string
  reference: string
  status: string
  amount_ttc: number
  paid_amount: number | null
  due_date: string | null
  pdf_path: string | null
  stripe_payment_link_url: string | null
  client_snapshot: Record<string, unknown> | null
  user_id: string | null
  reminder_j7_sent_at: string | null
  reminder_j15_sent_at: string | null
  reminder_j30_sent_at: string | null
}

interface OrgRow {
  name: string
  iban: string | null
  bic: string | null
  bank_name: string | null
}

interface ProfileRow {
  full_name: string | null
  email: string | null
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDateFr(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function computePenalties(unpaidAmount: number, daysLate: number) {
  const interest = (unpaidAmount * (LATE_RATE_PERCENT / 100) * daysLate) / 365
  return {
    interest: Math.round(interest * 100) / 100,
    flatFee: FLAT_FEE_EUR,
    total: Math.round((interest + FLAT_FEE_EUR) * 100) / 100,
  }
}

function wrapHtml(args: { bodyHtml: string; diagnosticianName: string; diagnosticianEmail: string }): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>KOVAS</title></head>
<body style="margin:0;padding:0;background:#F5F7F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0F1419;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F7F4;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;padding:32px;max-width:600px;">
        <tr><td style="font-size:15px;line-height:1.55;color:#0F1419;">
          ${args.bodyHtml}
          <p style="margin-top:32px;color:#6B7280;font-size:14px;">— ${escapeHtml(args.diagnosticianName)}<br/>${escapeHtml(args.diagnosticianEmail)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 12px 0;">${escapeHtml(text)}</p>`
}

function buttonHtml(label: string, url: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0F1419;color:#FFFFFF;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(label)}</a></p>`
}

function ibanBlock(org: OrgRow, reference: string): string {
  if (!org.iban) return ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;padding:14px 18px;background:#F5F7F4;border:1px solid #E5E7EB;border-radius:12px;font-size:13px;line-height:1.6;">
    <tr><td>
      <strong>Virement bancaire</strong><br/>
      ${org.bank_name ? `${escapeHtml(org.bank_name)}<br/>` : ''}
      IBAN : <code>${escapeHtml(org.iban)}</code><br/>
      ${org.bic ? `BIC : <code>${escapeHtml(org.bic)}</code><br/>` : ''}
      Référence à indiquer : <strong>${escapeHtml(reference)}</strong>
    </td></tr>
  </table>`
}

// ─── Templates par niveau de relance ───

function buildJ7Email(args: { firstName: string | null; ref: string; ttc: number; unpaid: number; dueDate: string | null; paymentLink: string | null; org: OrgRow }) {
  const greeting = args.firstName ? `Bonjour ${args.firstName},` : 'Bonjour,'
  const lines = [
    greeting,
    `Petit rappel concernant la facture ${args.ref} (${formatEur(args.unpaid)}) arrivée à échéance le ${formatDateFr(args.dueDate)}.`,
    `Si le règlement est déjà en cours, merci d'ignorer ce message.`,
    `Sinon vous pouvez procéder au paiement en quelques clics ci-dessous.`,
  ]
  const cta = args.paymentLink ? buttonHtml('Régler la facture', args.paymentLink) : ''
  const iban = ibanBlock(args.org, args.ref)
  return {
    subject: `Rappel : facture ${args.ref}`,
    text: lines.join('\n\n'),
    html: lines.map(paragraph).join('') + cta + iban,
  }
}

function buildJ15Email(args: { firstName: string | null; ref: string; ttc: number; unpaid: number; daysLate: number; dueDate: string | null; paymentLink: string | null; org: OrgRow }) {
  const greeting = args.firstName ? `Bonjour ${args.firstName},` : 'Bonjour,'
  const lines = [
    greeting,
    `Malgré mon premier rappel, la facture ${args.ref} (${formatEur(args.unpaid)}) reste impayée à ce jour (échéance : ${formatDateFr(args.dueDate)}, soit ${args.daysLate} jours de retard).`,
    `Conformément à l'article L.441-10 du Code de commerce, des pénalités de retard pourront s'appliquer à compter du 31e jour suivant l'échéance, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de ${FLAT_FEE_EUR} €.`,
    `Si une difficulté ponctuelle empêche le règlement, contactez-moi rapidement pour convenir d'une solution.`,
  ]
  const cta = args.paymentLink ? buttonHtml('Régler en ligne', args.paymentLink) : ''
  const iban = ibanBlock(args.org, args.ref)
  return {
    subject: `Facture ${args.ref} — règlement attendu`,
    text: lines.join('\n\n'),
    html: lines.map(paragraph).join('') + cta + iban,
  }
}

function buildJ30Email(args: { firstName: string | null; ref: string; ttc: number; unpaid: number; daysLate: number; dueDate: string | null; paymentLink: string | null; org: OrgRow }) {
  const greeting = args.firstName ? `Bonjour ${args.firstName},` : 'Bonjour,'
  const pen = computePenalties(args.unpaid, args.daysLate)
  const lines = [
    greeting,
    `À ce jour, malgré mes précédents rappels, la facture ${args.ref} (${formatEur(args.unpaid)}) reste impayée — ${args.daysLate} jours après son échéance du ${formatDateFr(args.dueDate)}.`,
    `En application de l'article L.441-10 du Code de commerce, les pénalités suivantes sont désormais exigibles :`,
    `• Intérêts de retard (${LATE_RATE_PERCENT.toString().replace('.', ',')} % annuel × ${args.daysLate} jours) : ${formatEur(pen.interest)}`,
    `• Indemnité forfaitaire de recouvrement : ${formatEur(pen.flatFee)}`,
    `• Soit un total de pénalités de ${formatEur(pen.total)} à ajouter au principal.`,
    `Cette présente mise en demeure vous est adressée avant engagement d'une procédure de recouvrement. Sans règlement intégral sous 8 jours, je serai contraint de saisir les voies de droit appropriées.`,
    `Je reste à votre disposition pour convenir d'un échelonnement amiable si la difficulté est temporaire.`,
  ]
  const cta = args.paymentLink ? buttonHtml('Régler immédiatement', args.paymentLink) : ''
  const iban = ibanBlock(args.org, args.ref)
  return {
    subject: `Mise en demeure — facture ${args.ref}`,
    text: lines.join('\n\n'),
    html: lines.map(paragraph).join('') + cta + iban,
  }
}

// ─── Send via Resend ───

async function sendEmailViaResend(args: {
  apiKey: string
  from: string
  to: string
  subject: string
  text: string
  html: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${args.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: args.from,
        to: [args.to],
        subject: args.subject,
        text: args.text,
        html: wrapHtml({
          bodyHtml: args.html,
          diagnosticianName: 'KOVAS',
          diagnosticianEmail: args.from,
        }),
        tags: [{ name: 'category', value: 'invoice_reminder' }],
      }),
    })
    if (!resp.ok) {
      const t = await resp.text().catch(() => '')
      return { ok: false, error: t.slice(0, 400) }
    }
    const data = (await resp.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: data.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network_error' }
  }
}

// ─── Main handler ───

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? null
  const resendFrom = Deno.env.get('RESEND_FROM') ?? 'KOVAS <noreply@kovas.fr>'

  if (!supabaseUrl || !serviceRole || !cronSecret) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }

  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const today = new Date().toISOString().slice(0, 10)

  // 1. Update status=overdue pour les factures arrivant en retard aujourd'hui
  await supabase
    .from('invoices')
    .update({ status: 'overdue' })
    .in('status', ['issued', 'partial'])
    .lt('due_date', today)

  // 2. Charge factures impayées avec due_date < today (max BATCH_SIZE)
  const { data: invoicesRaw, error } = await supabase
    .from('invoices')
    .select(
      'id, organization_id, reference, status, amount_ttc, paid_amount, due_date, pdf_path, stripe_payment_link_url, client_snapshot, user_id, reminder_j7_sent_at, reminder_j15_sent_at, reminder_j30_sent_at',
    )
    .in('status', ['issued', 'partial', 'overdue'])
    .lt('due_date', today)
    .order('due_date', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    return jsonResponse({ error: 'db_error', detail: error.message }, 500)
  }

  const invoices = (invoicesRaw ?? []) as InvoiceRow[]
  const tally = { sent_j7: 0, sent_j15: 0, sent_j30: 0, skipped_no_email: 0, errors: 0 }

  for (const inv of invoices) {
    try {
      if (!inv.due_date) continue
      const dueDateObj = new Date(inv.due_date)
      if (Number.isNaN(dueDateObj.getTime())) continue

      const daysLate = Math.floor(
        (Date.now() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24),
      )
      if (daysLate < 7) continue

      // Détermine le niveau à envoyer
      let level: 'j7' | 'j15' | 'j30' | null = null
      if (daysLate >= 30 && !inv.reminder_j30_sent_at) level = 'j30'
      else if (daysLate >= 15 && daysLate < 30 && !inv.reminder_j15_sent_at) level = 'j15'
      else if (daysLate >= 7 && daysLate < 15 && !inv.reminder_j7_sent_at) level = 'j7'
      if (!level) continue

      const snapshot = inv.client_snapshot ?? {}
      const recipientEmail = typeof snapshot.email === 'string' ? snapshot.email : null
      const firstName = typeof snapshot.first_name === 'string' ? snapshot.first_name : null
      if (!recipientEmail) {
        tally.skipped_no_email++
        continue
      }

      // Charge org + profile
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name, iban, bic, bank_name')
        .eq('id', inv.organization_id)
        .maybeSingle()
      const org = (orgData ?? { name: 'KOVAS', iban: null, bic: null, bank_name: null }) as OrgRow

      let profile: ProfileRow = { full_name: 'KOVAS', email: 'noreply@kovas.fr' }
      if (inv.user_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', inv.user_id)
          .maybeSingle()
        if (profileData) profile = profileData as ProfileRow
      }

      const ttc = Number(inv.amount_ttc)
      const paid = Number(inv.paid_amount ?? 0)
      const unpaid = Math.max(0, ttc - paid)

      // Compose email selon niveau
      let template: { subject: string; text: string; html: string }
      const baseArgs = {
        firstName,
        ref: inv.reference,
        ttc,
        unpaid,
        daysLate,
        dueDate: inv.due_date,
        paymentLink: inv.stripe_payment_link_url,
        org,
      }
      if (level === 'j7') template = buildJ7Email(baseArgs)
      else if (level === 'j15') template = buildJ15Email(baseArgs)
      else template = buildJ30Email(baseArgs)

      const diagnosticianName = profile.full_name ?? org.name
      const diagnosticianEmail = profile.email ?? 'noreply@kovas.fr'

      if (!resendApiKey) {
        // Mode dev sans clé Resend — stub log
        console.log('[invoice-reminders:stub]', {
          to: recipientEmail,
          subject: template.subject,
          level,
          invoiceId: inv.id,
        })
      } else {
        const fullHtml = wrapHtml({
          bodyHtml: template.html,
          diagnosticianName,
          diagnosticianEmail,
        })
        const result = await sendEmailViaResend({
          apiKey: resendApiKey,
          from: resendFrom,
          to: recipientEmail,
          subject: template.subject,
          text: template.text,
          html: fullHtml,
        })
        if (!result.ok) {
          console.error('[invoice-reminders] send failed', inv.id, result.error)
          tally.errors++
          continue
        }
      }

      // Marque le timestamp correspondant
      const update: Record<string, unknown> = {}
      if (level === 'j7') update.reminder_j7_sent_at = new Date().toISOString()
      else if (level === 'j15') update.reminder_j15_sent_at = new Date().toISOString()
      else update.reminder_j30_sent_at = new Date().toISOString()

      await supabase.from('invoices').update(update).eq('id', inv.id)

      if (level === 'j7') tally.sent_j7++
      else if (level === 'j15') tally.sent_j15++
      else tally.sent_j30++
    } catch (err) {
      tally.errors++
      console.error('[invoice-reminders] invoice failed', inv.id, err)
    }
  }

  return jsonResponse({
    ok: true,
    processedAt: new Date().toISOString(),
    batchSize: invoices.length,
    tally,
  })
})
