/**
 * KOVAS — Edge Function : Tick cron des séquences de relance (Module 5).
 *
 * Endpoint POST /functions/v1/follow-up-sequence-tick
 *
 * Cron : toutes les 15 minutes
 *
 *   SELECT cron.schedule(
 *     'follow-up-sequence-tick',
 *     '*\/15 * * * *',
 *     $$ SELECT net.http_post(
 *          url := current_setting('app.settings.supabase_functions_url') || '/follow-up-sequence-tick',
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
 *   1. SELECT follow_up_sequences WHERE status='active' AND next_action_at <= now()
 *      ORDER BY next_action_at ASC LIMIT 100
 *   2. Pour chaque séquence :
 *        a. Charge la définition (steps[]) depuis sequences.context
 *        b. Vérifie opt-out user (user_preferences.email_marketing_enabled)
 *        c. Charge le destinataire (contact/quote/invoice/mission) selon target_entity_type
 *        d. Compose le contenu (subject + text + html) via le template approprié
 *        e. Envoie via Resend (email) ou Brevo (SMS)
 *        f. Logge dans outgoing_message_log
 *        g. Incrémente current_step, recalcule next_action_at
 *        h. Si current_step >= total_steps : status='completed'
 *   3. Si erreur sur 1 séquence : status='paused' + last_action_result='error: ...'
 *
 * Garde-fous :
 *   - Max 100 séquences traitées par tick (évite les pics d'envoi)
 *   - Rate limit applicatif : pas 2 emails au même destinataire < 6 h (anti-spam)
 *   - Opt-out global respecté via user_preferences.email_marketing_enabled
 *
 * Authority : CLAUDE.md §10 contraintes + module 5 follow-up.
 */

// @ts-nocheck — Deno-only Edge Function ; non compilée par tsc Node.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const BATCH_SIZE = 100
const RATE_LIMIT_HOURS = 6

interface SequenceStep {
  delayDays: number
  channel: 'email' | 'sms' | 'in_app' | 'task'
  templateVariant?: string
  manualSubject?: string
  manualBody?: string
}

interface FollowUpSequenceRow {
  id: string
  organization_id: string
  user_id: string | null
  target_entity_type: 'quote' | 'invoice' | 'mission' | 'auto_quote' | 'contact'
  target_entity_id: string
  sequence_template: string
  current_step: number
  total_steps: number
  status: string
  next_action_at: string | null
  context: {
    steps?: SequenceStep[]
    [key: string]: unknown
  }
}

interface ComposedContent {
  subject: string
  text: string
  html: string
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Mappe un nom de template vers la valeur de `outgoing_message_log.category`
 * (CHECK constraint en SQL — voir migration 20260525193000).
 */
function mapTemplateToCategory(
  template: string,
):
  | 'follow_up_quote'
  | 'follow_up_invoice'
  | 'follow_up_post_dpe'
  | 'follow_up_prescriber'
  | 'follow_up_review' {
  switch (template) {
    case 'quote_pending':
      return 'follow_up_quote'
    case 'invoice_unpaid':
      return 'follow_up_invoice'
    case 'post_dpe_fg':
      return 'follow_up_post_dpe'
    case 'prescriber_silent':
      return 'follow_up_prescriber'
    case 'review_request':
      return 'follow_up_review'
    default:
      return 'follow_up_quote'
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function wrapEmailHtml(args: {
  bodyHtml: string
  unsubscribeUrl: string
  diagnosticianName: string
}): string {
  const safeName = escapeHtml(args.diagnosticianName)
  const unsub = escapeHtml(args.unsubscribeUrl)
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>KOVAS</title></head>
<body style="margin:0;padding:0;background:#F8F5EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0F1E3D;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8F5EE;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF6;border:1px solid #D5CDB8;border-radius:18px;padding:32px;max-width:600px;">
        <tr><td style="font-size:15px;line-height:1.55;color:#0F1E3D;">
          ${args.bodyHtml}
          <p style="margin-top:32px;color:#4A5878;">— ${safeName}<br/>KOVAS</p>
        </td></tr>
        <tr><td style="border-top:1px solid #E5DECB;padding-top:16px;font-size:12px;color:#7E8AA4;">
          Cet email vous est envoyé via la plateforme KOVAS. <a href="${unsub}" style="color:#4A5878;">Se désinscrire des relances</a>.
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
  return `<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0F1E3D;color:#F8F5EE;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">${escapeHtml(label)}</a></p>`
}

// ────────────────────────────────────────────────────────────
// Composition par template (mirror minimal des templates.ts Node)
// ────────────────────────────────────────────────────────────

function composeForTemplate(args: {
  template: string
  step: number
  recipientFirstName: string | null
  diagnosticianName: string
  diagnosticianEmail: string
  unsubscribeUrl: string
  contextData: Record<string, unknown>
}): ComposedContent {
  const greeting = args.recipientFirstName ? `Bonjour ${args.recipientFirstName},` : 'Bonjour,'

  // Récupère champs context (best effort, defensive).
  const ref =
    (args.contextData.reference as string | undefined) ??
    (args.contextData.quoteRef as string | undefined) ??
    (args.contextData.invoiceNumber as string | undefined) ??
    'N/A'
  const amount = Number(args.contextData.amountEur ?? 0)
  const viewUrl = (args.contextData.viewUrl as string | undefined) ?? args.contextData.appUrl ?? '#'
  const paymentUrl =
    (args.contextData.paymentUrl as string | undefined) ?? (viewUrl as string)
  const propertyAddress =
    (args.contextData.propertyAddress as string | undefined) ?? 'votre bien'
  const dpeClass = (args.contextData.dpeClass as string | undefined) ?? 'F'
  const reviewUrl = (args.contextData.reviewUrl as string | undefined) ?? '#'

  const wrap = (subject: string, lines: string[], buttonLabel?: string, buttonUrl?: string): ComposedContent => {
    const bodyTxt = `${greeting}\n\n${lines.join('\n\n')}\n\nSe désinscrire : ${args.unsubscribeUrl}`
    const bodyHtml =
      paragraph(greeting) +
      lines.map(paragraph).join('') +
      (buttonLabel && buttonUrl ? buttonHtml(buttonLabel, buttonUrl) : '')
    return {
      subject,
      text: bodyTxt,
      html: wrapEmailHtml({
        bodyHtml,
        unsubscribeUrl: args.unsubscribeUrl,
        diagnosticianName: args.diagnosticianName,
      }),
    }
  }

  switch (args.template) {
    case 'quote_pending':
      if (args.step === 0) {
        return wrap(
          `Votre devis ${ref} — un point rapide ?`,
          [
            `Je reviens vers vous concernant le devis ${ref} (${amount.toFixed(0)} €).`,
            `Avez-vous pu en prendre connaissance ? Je reste disponible pour répondre à vos questions ou ajuster la prestation.`,
          ],
          'Consulter le devis',
          viewUrl,
        )
      }
      if (args.step === 1) {
        return wrap(
          `Devis ${ref} — toujours d'actualité ?`,
          [
            `Je n'ai pas eu de retour concernant le devis ${ref} (${amount.toFixed(0)} €).`,
            `Si votre projet a évolué (report, annulation, ajustement de périmètre), faites-le moi savoir.`,
          ],
          'Voir le devis',
          viewUrl,
        )
      }
      return wrap(`Devis ${ref} — dernière relance`, [
        `Sans retour de votre part dans les prochains jours, je clôturerai le devis ${ref}.`,
        `Vous pouvez bien sûr revenir vers moi à tout moment pour relancer le projet.`,
      ])

    case 'invoice_unpaid':
      if (args.step === 0) {
        return wrap(
          `Facture ${ref} — rappel`,
          [
            `La facture ${ref} (${amount.toFixed(2)} €) est arrivée à échéance.`,
            `Si le règlement est en cours, merci d'ignorer ce message. Sinon vous pouvez procéder au paiement en quelques clics.`,
          ],
          'Régler la facture',
          paymentUrl as string,
        )
      }
      if (args.step === 1) {
        return wrap(
          `Facture ${ref} — règlement attendu`,
          [
            `Sans nouvelle de votre part, la facture ${ref} (${amount.toFixed(2)} €) reste impayée.`,
            `Les pénalités de retard s'appliquent à compter du 31e jour suivant l'échéance (taux d'intérêt légal + 10 € forfaitaires).`,
            `Contactez-moi si vous rencontrez une difficulté ponctuelle.`,
          ],
          'Régler en ligne',
          paymentUrl as string,
        )
      }
      return wrap(
        `Facture ${ref} — mise en demeure préalable`,
        [
          `À ce jour, la facture ${ref} (${amount.toFixed(2)} €) n'a toujours pas été réglée malgré mes précédents rappels.`,
          `Sans paiement sous 8 jours, je serai contraint d'engager une procédure de recouvrement, ce que je préférerais éviter.`,
        ],
        'Régler immédiatement',
        paymentUrl as string,
      )

    case 'post_dpe_fg':
      if (args.step === 0) {
        return wrap(
          `Diagnostic ${ref} — pistes d'amélioration énergétique`,
          [
            `Suite au diagnostic réalisé sur le bien situé ${propertyAddress}, votre logement a été classé ${dpeClass}.`,
            `Les biens F et G entrent progressivement dans le calendrier d'interdiction de location (loi Climat et Résilience).`,
            `Si vous envisagez des travaux, je peux vous orienter vers les dispositifs d'aide disponibles (MaPrimeRénov', CEE, Éco-PTZ).`,
          ],
        )
      }
      return wrap(`Vos travaux d'amélioration énergétique — point d'étape ?`, [
        `Trois mois se sont écoulés depuis votre diagnostic ${ref} (étiquette ${dpeClass}).`,
        `Avez-vous pu avancer sur d'éventuels travaux ? Si vous souhaitez planifier un nouveau diagnostic après travaux, je peux vous accompagner.`,
      ])

    case 'prescriber_silent':
      return wrap(`Un point rapide`, [
        `Je profite de cet email pour reprendre contact.`,
        `Si vous avez des biens nécessitant un diagnostic prochainement, je peux intervenir rapidement et vous transmettre devis et planning sous 24 h.`,
      ])

    case 'review_request':
      return wrap(
        `Votre avis sur le diagnostic ${ref}`,
        [
          `J'espère que mon intervention pour le diagnostic ${ref} s'est déroulée à votre satisfaction.`,
          `Si vous avez quelques minutes, votre retour me serait précieux.`,
        ],
        'Laisser un avis',
        reviewUrl,
      )

    default:
      throw new Error(`unknown template "${args.template}"`)
  }
}

// ────────────────────────────────────────────────────────────
// I/O : Resend (email) + Brevo (SMS)
// ────────────────────────────────────────────────────────────

async function sendEmailViaResend(args: {
  apiKey: string
  from: string
  to: string
  subject: string
  text: string
  html: string
  category: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: args.from,
        to: [args.to],
        subject: args.subject,
        text: args.text,
        html: args.html,
        tags: [{ name: 'category', value: args.category }],
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

async function sendSmsViaBrevo(args: {
  apiKey: string
  to: string
  text: string
  sender: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const resp = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST',
      headers: { 'api-key': args.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: args.sender.slice(0, 11),
        recipient: args.to,
        content: args.text.slice(0, 320),
        type: 'transactional',
      }),
    })
    if (!resp.ok) {
      const t = await resp.text().catch(() => '')
      return { ok: false, error: t.slice(0, 400) }
    }
    const data = (await resp.json().catch(() => ({}))) as { messageId?: string }
    return { ok: true, id: data.messageId ? String(data.messageId) : undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network_error' }
  }
}

// ────────────────────────────────────────────────────────────
// Helpers DB
// ────────────────────────────────────────────────────────────

async function loadRecipientContact(
  supabase: ReturnType<typeof createClient>,
  targetType: string,
  targetId: string,
): Promise<{
  email: string | null
  phone: string | null
  firstName: string | null
  companyName: string | null
} | null> {
  if (targetType === 'contact') {
    const { data } = await supabase
      .from('contacts')
      .select('email, phone, display_name, company_name')
      .eq('id', targetId)
      .maybeSingle()
    if (!data) return null
    return {
      email: (data as { email: string | null }).email ?? null,
      phone: (data as { phone: string | null }).phone ?? null,
      firstName: ((data as { display_name: string | null }).display_name ?? '').split(' ')[0] ?? null,
      companyName: (data as { company_name: string | null }).company_name ?? null,
    }
  }
  if (targetType === 'quote' || targetType === 'invoice') {
    const { data } = await supabase
      .from(targetType === 'quote' ? 'quotes' : 'invoices')
      .select('contact_id')
      .eq('id', targetId)
      .maybeSingle()
    const contactId = (data as { contact_id?: string | null } | null)?.contact_id ?? null
    if (!contactId) return null
    return loadRecipientContact(supabase, 'contact', contactId)
  }
  if (targetType === 'mission') {
    const { data } = await supabase
      .from('clients')
      .select('email, phone, first_name, last_name')
      .eq('mission_id', targetId)
      .maybeSingle()
    if (!data) return null
    return {
      email: (data as { email: string | null }).email ?? null,
      phone: (data as { phone: string | null }).phone ?? null,
      firstName: (data as { first_name: string | null }).first_name ?? null,
      companyName: null,
    }
  }
  if (targetType === 'auto_quote') {
    const { data } = await supabase
      .from('auto_quotes')
      .select('contact_id')
      .eq('id', targetId)
      .maybeSingle()
    const contactId = (data as { contact_id?: string | null } | null)?.contact_id ?? null
    if (!contactId) return null
    return loadRecipientContact(supabase, 'contact', contactId)
  }
  return null
}

async function loadDiagnostician(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
): Promise<{ name: string; email: string }> {
  if (!userId) return { name: 'KOVAS', email: 'noreply@kovas.fr' }
  const { data } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .maybeSingle()
  return {
    name: (data as { full_name: string | null } | null)?.full_name ?? 'KOVAS',
    email: (data as { email: string | null } | null)?.email ?? 'noreply@kovas.fr',
  }
}

async function isOptedOut(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
): Promise<{ email: boolean; sms: boolean }> {
  if (!userId) return { email: false, sms: false }
  const { data } = await supabase
    .from('user_preferences')
    .select('email_marketing_enabled, sms_marketing_enabled, follow_up_opt_out_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return { email: false, sms: false }
  const row = data as {
    email_marketing_enabled?: boolean
    sms_marketing_enabled?: boolean
    follow_up_opt_out_at?: string | null
  }
  const globalOptOut = row.follow_up_opt_out_at !== null && row.follow_up_opt_out_at !== undefined
  return {
    email: globalOptOut || row.email_marketing_enabled === false,
    sms: globalOptOut || row.sms_marketing_enabled === false,
  }
}

async function hasRecentSend(
  supabase: ReturnType<typeof createClient>,
  recipient: string,
  hours: number,
): Promise<boolean> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString()
  const { count } = await supabase
    .from('outgoing_message_log')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_to', recipient)
    .eq('status', 'sent')
    .gte('sent_at', since)
  return (count ?? 0) > 0
}

function computeNextActionAt(
  steps: SequenceStep[],
  newCurrentStep: number,
  fromIso: string,
): string | null {
  if (newCurrentStep >= steps.length) return null
  const step = steps[newCurrentStep]
  if (!step) return null
  const delayHours = Math.max(step.delayDays * 24, 24)
  const next = new Date(new Date(fromIso).getTime() + delayHours * 3_600_000)
  return next.toISOString()
}

// ────────────────────────────────────────────────────────────
// Process une séquence
// ────────────────────────────────────────────────────────────

async function processSequence(
  supabase: ReturnType<typeof createClient>,
  env: {
    resendApiKey: string | null
    resendFrom: string
    brevoApiKey: string | null
    brevoSender: string
    appUrl: string
  },
  seq: FollowUpSequenceRow,
): Promise<{ status: 'sent' | 'completed' | 'paused' | 'skipped'; detail?: string }> {
  const steps = (seq.context?.steps ?? []) as SequenceStep[]
  if (steps.length === 0) {
    await supabase
      .from('follow_up_sequences')
      .update({
        status: 'failed',
        last_action_result: 'no_steps_defined_in_context',
        next_action_at: null,
      })
      .eq('id', seq.id)
    return { status: 'paused', detail: 'no_steps' }
  }

  const step = steps[seq.current_step]
  if (!step) {
    await supabase
      .from('follow_up_sequences')
      .update({
        status: 'completed',
        last_action_at: new Date().toISOString(),
        last_action_result: 'no_more_steps',
        next_action_at: null,
      })
      .eq('id', seq.id)
    return { status: 'completed' }
  }

  // 1. Contact destinataire
  const recipient = await loadRecipientContact(
    supabase,
    seq.target_entity_type,
    seq.target_entity_id,
  )
  if (!recipient || (!recipient.email && !recipient.phone)) {
    await supabase
      .from('follow_up_sequences')
      .update({
        status: 'paused',
        last_action_result: 'no_recipient_contact_info',
      })
      .eq('id', seq.id)
    return { status: 'paused', detail: 'no_contact' }
  }

  // 2. Opt-out check
  const optOut = await isOptedOut(supabase, seq.user_id)
  const channel = step.channel
  if (channel === 'email' && optOut.email) {
    await supabase
      .from('outgoing_message_log')
      .insert({
        organization_id: seq.organization_id,
        user_id: seq.user_id,
        channel: 'email',
        category: mapTemplateToCategory(seq.sequence_template),
        recipient_to: recipient.email ?? 'unknown',
        sequence_id: seq.id,
        sequence_step: seq.current_step,
        target_entity_type: seq.target_entity_type,
        target_entity_id: seq.target_entity_id,
        status: 'skipped_optout',
      })
    // On marque la séquence completed plutôt que continuer à boucler
    await supabase
      .from('follow_up_sequences')
      .update({
        status: 'cancelled',
        last_action_result: 'recipient_opted_out',
        next_action_at: null,
      })
      .eq('id', seq.id)
    return { status: 'skipped', detail: 'opted_out' }
  }

  // 3. Rate limit (anti-spam : max 1 envoi / 6 h vers même destinataire)
  const recipientKey = channel === 'sms' ? recipient.phone ?? '' : recipient.email ?? ''
  if (recipientKey && (await hasRecentSend(supabase, recipientKey, RATE_LIMIT_HOURS))) {
    await supabase
      .from('outgoing_message_log')
      .insert({
        organization_id: seq.organization_id,
        user_id: seq.user_id,
        channel,
        category: mapTemplateToCategory(seq.sequence_template),
        recipient_to: recipientKey,
        sequence_id: seq.id,
        sequence_step: seq.current_step,
        target_entity_type: seq.target_entity_type,
        target_entity_id: seq.target_entity_id,
        status: 'skipped_rate_limit',
      })
    // Reporte de RATE_LIMIT_HOURS
    await supabase
      .from('follow_up_sequences')
      .update({
        next_action_at: new Date(Date.now() + RATE_LIMIT_HOURS * 3_600_000).toISOString(),
        last_action_result: 'rate_limited',
      })
      .eq('id', seq.id)
    return { status: 'skipped', detail: 'rate_limited' }
  }

  // 4. Charge le diagnostiqueur
  const diag = await loadDiagnostician(supabase, seq.user_id)
  const unsubscribeUrl = `${env.appUrl}/preferences/unsubscribe?seq=${seq.id}`

  // 5. Compose le contenu
  let content: ComposedContent
  try {
    content = composeForTemplate({
      template: seq.sequence_template,
      step: seq.current_step,
      recipientFirstName: recipient.firstName,
      diagnosticianName: diag.name,
      diagnosticianEmail: diag.email,
      unsubscribeUrl,
      contextData: { ...(seq.context ?? {}), appUrl: env.appUrl },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'compose_failed'
    await supabase
      .from('follow_up_sequences')
      .update({ status: 'paused', last_action_result: `compose_error: ${msg.slice(0, 200)}` })
      .eq('id', seq.id)
    return { status: 'paused', detail: msg }
  }

  // 6. Surcharges manuelles
  if (step.manualSubject && step.manualBody) {
    content = { subject: step.manualSubject, text: step.manualBody, html: content.html }
  }

  // 7. Envoi
  let sendResult: { ok: boolean; id?: string; error?: string } = { ok: false, error: 'no_channel' }
  if (channel === 'email' && recipient.email && env.resendApiKey) {
    sendResult = await sendEmailViaResend({
      apiKey: env.resendApiKey,
      from: env.resendFrom,
      to: recipient.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      category: `follow_up_${seq.sequence_template}`,
    })
  } else if (channel === 'sms' && recipient.phone && env.brevoApiKey) {
    sendResult = await sendSmsViaBrevo({
      apiKey: env.brevoApiKey,
      to: recipient.phone,
      text: content.text,
      sender: env.brevoSender,
    })
  } else if (channel === 'in_app' || channel === 'task') {
    // V1 : on logge en sent sans destinataire externe (UI lira outgoing_message_log).
    sendResult = { ok: true }
  } else {
    sendResult = {
      ok: false,
      error: `unsupported_channel_or_missing_provider (channel=${channel})`,
    }
  }

  // 8. Log
  await supabase.from('outgoing_message_log').insert({
    organization_id: seq.organization_id,
    user_id: seq.user_id,
    channel,
    category: mapTemplateToCategory(seq.sequence_template),
    recipient_to: recipientKey || '(in_app)',
    subject: content.subject,
    template_slug: `${seq.sequence_template}_step${seq.current_step}`,
    sequence_id: seq.id,
    sequence_step: seq.current_step,
    target_entity_type: seq.target_entity_type,
    target_entity_id: seq.target_entity_id,
    status: sendResult.ok ? 'sent' : 'failed',
    provider_id: sendResult.id ?? null,
    error_message: sendResult.error ?? null,
  })

  // 9. Mise à jour séquence
  if (!sendResult.ok) {
    await supabase
      .from('follow_up_sequences')
      .update({
        status: 'paused',
        last_action_result: `send_error: ${(sendResult.error ?? 'unknown').slice(0, 200)}`,
        last_action_at: new Date().toISOString(),
      })
      .eq('id', seq.id)
    return { status: 'paused', detail: sendResult.error }
  }

  const newCurrentStep = seq.current_step + 1
  const nowIso = new Date().toISOString()
  const completed = newCurrentStep >= steps.length
  const nextAt = completed ? null : computeNextActionAt(steps, newCurrentStep, nowIso)

  await supabase
    .from('follow_up_sequences')
    .update({
      current_step: newCurrentStep,
      next_action_at: nextAt,
      last_action_at: nowIso,
      last_action_result: `sent_step_${seq.current_step}`,
      status: completed ? 'completed' : 'active',
    })
    .eq('id', seq.id)

  return { status: completed ? 'completed' : 'sent' }
}

// ────────────────────────────────────────────────────────────
// Entry point
// ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? null
  const resendFrom = Deno.env.get('RESEND_FROM') ?? 'KOVAS <noreply@kovas.fr>'
  const brevoApiKey = Deno.env.get('BREVO_API_KEY') ?? null
  const brevoSender = Deno.env.get('BREVO_SMS_SENDER') ?? 'KOVAS'
  const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://kovas.fr'

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

  const nowIso = new Date().toISOString()
  const { data: rows, error } = await supabase
    .from('follow_up_sequences')
    .select(
      'id, organization_id, user_id, target_entity_type, target_entity_id, sequence_template, current_step, total_steps, status, next_action_at, context',
    )
    .eq('status', 'active')
    .not('next_action_at', 'is', null)
    .lte('next_action_at', nowIso)
    .order('next_action_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    return jsonResponse({ error: 'db_error', detail: error.message }, 500)
  }

  const sequences = (rows ?? []) as FollowUpSequenceRow[]
  const tally: Record<string, number> = {
    sent: 0,
    completed: 0,
    paused: 0,
    skipped: 0,
    errors: 0,
  }

  for (const seq of sequences) {
    try {
      const r = await processSequence(
        supabase,
        { resendApiKey, resendFrom, brevoApiKey, brevoSender, appUrl },
        seq,
      )
      tally[r.status] = (tally[r.status] ?? 0) + 1
    } catch (err) {
      tally.errors += 1
      console.error('[follow-up-sequence-tick] sequence failed', seq.id, err)
      await supabase
        .from('follow_up_sequences')
        .update({
          status: 'paused',
          last_action_result: `tick_exception: ${(err instanceof Error ? err.message : 'unknown').slice(0, 200)}`,
        })
        .eq('id', seq.id)
    }
  }

  return jsonResponse({
    ok: true,
    processedAt: nowIso,
    batchSize: sequences.length,
    tally,
  })
})
