/**
 * KOVAS — Edge Function : Winback email J+7 post-résiliation.
 *
 * Endpoint POST /functions/v1/winback-email-sender
 *
 * Cron : tous les jours à 10h UTC (12h CET en hiver / 11h en été)
 *
 *   SELECT cron.schedule(
 *     'winback-email-sender',
 *     '0 10 * * *',
 *     $$ SELECT net.http_post(
 *          url := current_setting('app.settings.supabase_functions_url') || '/winback-email-sender',
 *          headers := jsonb_build_object(
 *            'Content-Type', 'application/json',
 *            'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
 *          )
 *        ); $$
 *   );
 *
 * Auth : header `Authorization: Bearer <CRON_SECRET>` requis.
 *
 * Workflow :
 *   1. SELECT cancellations WHERE confirmed_at IS NOT NULL
 *      AND winback_email_sent_at IS NULL
 *      AND confirmed_at <= now() - interval '7 days'
 *      ORDER BY confirmed_at ASC LIMIT 100
 *   2. Pour chaque cancellation :
 *        a. Charge user_email + first_name via profiles
 *        b. Compose email via template winback-cancellation
 *        c. Envoie via Resend
 *        d. UPDATE winback_email_sent_at = now()
 *   3. Si erreur sur 1 cancellation : on log + on continue (retry au tick suivant).
 *
 * Authority : CLAUDE.md §10 contraintes + cancellation workflow décret 2023-417.
 */

// @ts-nocheck — Deno-only Edge Function ; non compilée par tsc Node.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const BATCH_SIZE = 100
const DELAY_DAYS = Number.parseInt(Deno.env.get('WINBACK_EMAIL_DELAY_DAYS') ?? '7', 10)
const DISCOUNT_PERCENT = Number.parseInt(Deno.env.get('WINBACK_DISCOUNT_PERCENT') ?? '50', 10)
const DISCOUNT_DURATION_MONTHS = Number.parseInt(
  Deno.env.get('WINBACK_DISCOUNT_DURATION_MONTHS') ?? '3',
  10,
)
const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://kovas.fr'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'KOVAS <contact@kovas.fr>'

interface CancellationRow {
  id: string
  user_id: string
  feedback_text: string
  winback_code: string
  confirmed_at: string
}

interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
}

interface RunSummary {
  candidates: number
  sent: number
  errors: number
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

function buildWinbackEmail(opts: {
  firstName: string
  feedbackExcerpt: string
  winbackCode: string
}): { subject: string; text: string; html: string } {
  const firstNameClean = (opts.firstName || '').trim().split(' ')[0] || 'bonjour'
  const reactivateUrl = `${APP_URL.replace(/\/+$/, '')}/app/account?reactivate=${encodeURIComponent(opts.winbackCode)}`

  const subject = `On regrette de vous voir partir, ${firstNameClean}`

  const feedbackPart = opts.feedbackExcerpt
    ? `Vous nous avez écrit : « ${opts.feedbackExcerpt}${opts.feedbackExcerpt.length >= 100 ? '…' : ''} ». Nous l'avons lu attentivement.`
    : 'Nous avons relu votre retour attentivement.'

  const text = `${firstNameClean},

Cela fait une semaine que vous avez quitté KOVAS. Pas de relance — juste un mot rapide.

${feedbackPart}

Si vous souhaitez revenir, voici un code unique valide 6 mois :

  ${opts.winbackCode}

Il vous donne accès à votre formule précédente avec -${DISCOUNT_PERCENT}% pendant ${DISCOUNT_DURATION_MONTHS} mois.

Réactiver mon compte :
${reactivateUrl}

Pas de pression, pas de relance — ce code expire dans 6 mois et c'est tout.

Cordialement,

Benjamin Bel
Fondateur KOVAS
contact@kovas.fr
`

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>KOVAS</title></head>
<body style="margin:0;padding:0;background:#F8F5EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0F1E3D;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8F5EE;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF6;border:1px solid #D5CDB8;border-radius:18px;padding:32px;max-width:600px;">
        <tr><td style="font-size:15px;line-height:1.6;color:#0F1E3D;">
          <p style="margin:0 0 16px 0;">${escapeHtml(firstNameClean)},</p>
          <p style="margin:0 0 16px 0;">Cela fait une semaine que vous avez quitté KOVAS. Pas de relance — juste un mot rapide.</p>
          <p style="margin:0 0 16px 0;color:#4A5878;font-style:italic;">${escapeHtml(feedbackPart)}</p>
          <p style="margin:0 0 8px 0;">Si vous souhaitez revenir, voici un code unique valide 6 mois :</p>
          <p style="margin:0 0 16px 0;font-family:'JetBrains Mono',monospace;font-size:16px;background:#F8F5EE;border:1px solid #D5CDB8;border-radius:8px;padding:10px 16px;display:inline-block;">${escapeHtml(opts.winbackCode)}</p>
          <p style="margin:0 0 24px 0;">Il vous donne accès à votre formule précédente avec <strong>-${DISCOUNT_PERCENT}% pendant ${DISCOUNT_DURATION_MONTHS} mois</strong>.</p>
          <p style="margin:24px 0;">
            <a href="${escapeHtml(reactivateUrl)}" style="display:inline-block;background:#0F1E3D;color:#F8F5EE;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;">Réactiver mon compte</a>
          </p>
          <p style="margin:0 0 16px 0;font-size:13px;color:#7E8AA4;">Pas de pression, pas de relance — ce code expire dans 6 mois et c'est tout.</p>
          <p style="margin-top:32px;color:#4A5878;">— Benjamin Bel<br/>Fondateur KOVAS<br/><a href="mailto:contact@kovas.fr" style="color:#4A5878;">contact@kovas.fr</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return { subject, text, html }
}

async function sendResendEmail(opts: {
  to: string
  subject: string
  text: string
  html: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    return { ok: true, id: 'stub' }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      tags: [{ name: 'category', value: 'winback' }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`)
    return { ok: false, error: errText.slice(0, 500) }
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string }
  return { ok: true, id: data.id }
}

Deno.serve(async (req) => {
  // Auth : Bearer CRON_SECRET (jamais accessible aux users)
  const authHeader = req.headers.get('authorization') ?? ''
  const expectedSecret = Deno.env.get('CRON_SECRET') ?? ''
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const cutoffIso = new Date(Date.now() - DELAY_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // 1) SELECT cancellations éligibles
  const { data: cancellations, error: selErr } = await supabase
    .from('cancellations')
    .select('id, user_id, feedback_text, winback_code, confirmed_at')
    .not('confirmed_at', 'is', null)
    .is('winback_email_sent_at', null)
    .lte('confirmed_at', cutoffIso)
    .order('confirmed_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (selErr) {
    return jsonResponse({ error: selErr.message }, 500)
  }

  const rows = (cancellations ?? []) as CancellationRow[]
  const summary: RunSummary = { candidates: rows.length, sent: 0, errors: 0 }

  for (const c of rows) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', c.user_id)
        .maybeSingle()

      const p = profile as ProfileRow | null
      if (!p?.email) {
        summary.errors += 1
        console.warn('[winback] no email for user', c.user_id)
        continue
      }

      const email = buildWinbackEmail({
        firstName: p.full_name ?? '',
        feedbackExcerpt: (c.feedback_text ?? '').slice(0, 100),
        winbackCode: c.winback_code,
      })

      const result = await sendResendEmail({
        to: p.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      })

      if (!result.ok) {
        summary.errors += 1
        console.error('[winback] resend error', c.id, result.error)
        continue
      }

      // UPDATE winback_email_sent_at
      const { error: updErr } = await supabase
        .from('cancellations')
        .update({ winback_email_sent_at: new Date().toISOString() })
        .eq('id', c.id)

      if (updErr) {
        summary.errors += 1
        console.error('[winback] update sent_at failed', c.id, updErr.message)
        continue
      }

      summary.sent += 1
    } catch (e) {
      summary.errors += 1
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[winback] unexpected error', c.id, msg)
    }
  }

  return jsonResponse({ ok: true, ...summary })
})
