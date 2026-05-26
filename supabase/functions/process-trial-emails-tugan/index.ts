/**
 * KOVAS — Edge Function : process-trial-emails-tugan (TUGAN-EMAIL-WIRING).
 *
 * Endpoint POST /functions/v1/process-trial-emails-tugan
 *
 * Cron : 1× / heure (résolution suffisante pour J+0..J+30 avec marge < 1h).
 *
 *   SELECT cron.schedule(
 *     'process-trial-emails-tugan',
 *     '5 * * * *',
 *     $$ SELECT net.http_post(
 *          url := current_setting('app.settings.supabase_functions_url') || '/process-trial-emails-tugan',
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
 *   1. SELECT automated_email_sequences WHERE sequence_type='trial_tugan'
 *        AND status='pending' AND next_send_at <= now() AND step <= 8
 *        ORDER BY next_send_at ASC LIMIT 50
 *   2. Pour chaque row :
 *        a. Charge le user (auth + profile + subscription)
 *        b. Calcule les variables d'activité (missions_count, hours_saved, conformity_score)
 *           sur la fenêtre roulante 7j (steps 1-4) ou 30j (steps 5-8)
 *        c. Render le template via renderTuganEmail()
 *        d. Convertit le markdown brut en HTML minimal (paragraphes / bold / italic / links)
 *        e. Envoie via Brevo API v3
 *        f. Si OK : step++, next_send_at = computeNextSendAt(step+1, signup_date),
 *           si step+1 > 8 → status='completed'
 *        g. Si KO : status='failed' + last_error (idempotent — pas d'incrément step)
 *   3. Batching : LIMIT 50 par invocation (timeout 10s Edge Functions).
 *
 * Idempotency : `step++` et `next_send_at` mis à jour dans la même UPDATE que
 * `last_sent_at = now()` — si l'UPDATE échoue, la row reste 'pending' et sera
 * retraitée au prochain tick. Le compromis : si Brevo répond 200 mais le UPDATE
 * crash juste après, on enverra le même email 2× (acceptable vs perdre un email).
 *
 * Bonus enrôlement : helper `enrollUserInTuganTrialSequence(user_id, signup_date)`
 * exposé en POST /enroll body { userId, signupDate } — à appeler depuis le webhook
 * Stripe `customer.subscription.created` (wiring séparé hors de cette fonction).
 *
 * Variables d'env requises :
 *   - SUPABASE_URL                 (toujours injectée par la plateforme)
 *   - SUPABASE_SERVICE_ROLE_KEY    (toujours injectée par la plateforme)
 *   - CRON_SECRET                  (Bearer token cron, à provisionner)
 *   - BREVO_API_KEY                (clé API Brevo SMTP transactionnel)
 *
 * Variables d'env optionnelles :
 *   - BREVO_SENDER_NAME            (défaut: "Benjamin Bel — KOVAS")
 *   - BREVO_SENDER_EMAIL           (défaut: "benjamin@kovas.fr")
 *   - APP_URL                      (défaut: "https://kovas.fr")
 *
 * AUCUNE mention de provider IA tiers dans le code source de cette fonction
 * (directive transversale 2026-05). Les variables nommées `cost_eur` (pas
 * `claude_cost_eur`), `ai_cost_eur` (pas `whisper_cost_eur`), etc.
 *
 * Authority : CLAUDE.md §10 (contraintes) + TUGAN-4 module + brief
 * TUGAN-EMAIL-WIRING 2026-05-26.
 */

// @ts-nocheck — Deno-only Edge Function ; non compilée par tsc Node.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { TUGAN_TRIAL_EMAILS, type TuganEmailTemplate, renderTuganEmail } from './_templates.ts'

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Constantes                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

const BATCH_SIZE = 50
const MAX_STEP = 8

/** Heures de décalage par step (step 1 = J+0, step 8 = J+30). */
const STEP_OFFSETS_HOURS: readonly number[] = [
  0, // step 1 → J+0
  24, // step 2 → J+1
  72, // step 3 → J+3
  168, // step 4 → J+7
  336, // step 5 → J+14
  504, // step 6 → J+21
  672, // step 7 → J+28
  720, // step 8 → J+30
]

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

interface AutomatedEmailSequenceRow {
  id: string
  user_id: string
  sequence_type: string
  step: number
  status: string
  signup_date: string | null
  next_send_at: string | null
  last_sent_at: string | null
  last_error: string | null
}

interface UserContext {
  email: string
  firstName: string
  planName: string
  planPriceEur: number
  nextChargeDate: string | null
}

interface ActivityStats {
  missionsCount: number
  hoursSaved: string
  conformityScore: string
}

interface SendOutcome {
  ok: boolean
  providerMessageId?: string
  error?: string
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Utility — réponses HTTP                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helper exporté : computeNextSendAt                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Retourne le timestamp UTC ISO 8601 du prochain envoi pour un step donné,
 * basé sur la date d'inscription (`signupDate`). Retourne `null` si
 * `step > MAX_STEP` (séquence terminée).
 *
 * Mapping :
 *   step 1 → signupDate + 0h    (J+0)
 *   step 2 → signupDate + 24h   (J+1)
 *   step 3 → signupDate + 72h   (J+3)
 *   step 4 → signupDate + 168h  (J+7)
 *   step 5 → signupDate + 336h  (J+14)
 *   step 6 → signupDate + 504h  (J+21)
 *   step 7 → signupDate + 672h  (J+28)
 *   step 8 → signupDate + 720h  (J+30)
 *
 * @param step - 1..8 (1 = premier email, 8 = dernier)
 * @param signupDate - ISO 8601 timestamp d'inscription
 * @returns ISO 8601 timestamp UTC du prochain envoi, ou null si fini
 */
export function computeNextSendAt(step: number, signupDate: string): string | null {
  if (step < 1 || step > MAX_STEP) return null
  const offsetHours = STEP_OFFSETS_HOURS[step - 1]
  if (offsetHours === undefined) return null
  const base = new Date(signupDate)
  if (Number.isNaN(base.getTime())) {
    throw new Error(`[process-trial-emails-tugan] signupDate invalide : "${signupDate}"`)
  }
  return new Date(base.getTime() + offsetHours * 3_600_000).toISOString()
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helper exporté : simpleMarkdownToHtml                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Convertit le markdown brut des templates Tugan en HTML minimal compatible
 * email. Couvre uniquement les patterns utilisés dans les 8 templates :
 *   - paragraphes (`\n\n` → `</p><p>`)
 *   - bold (`**text**` → `<strong>text</strong>`)
 *   - italic (`*text*` → `<em>text</em>`)
 *   - liens markdown (`[text](url)` → `<a href="url">text</a>`)
 *   - liens nus précédés de `→` (préservés tels quels, format Tugan signature)
 *   - listes `- item` (converties en `<ul><li>`)
 *
 * Échappe HTML avant traitement pour éviter injection. Pas de parser complet.
 *
 * @param markdown - Body markdown rendu (placeholders déjà substitués)
 * @returns HTML email-safe
 */
export function simpleMarkdownToHtml(markdown: string): string {
  // 1. Escape HTML d'abord (avant transformations).
  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  // 2. Split en blocs (paragraphes séparés par double saut de ligne).
  const blocks = escaped.split(/\n\n+/)

  const transformed = blocks.map((block) => {
    const trimmed = block.trim()
    if (trimmed.length === 0) return ''

    // Liste markdown : lignes commençant par `- `.
    if (trimmed.split('\n').every((line) => line.trim().startsWith('- '))) {
      const items = trimmed
        .split('\n')
        .map((line) => `<li>${applyInline(line.trim().slice(2).trim())}</li>`)
        .join('')
      return `<ul>${items}</ul>`
    }

    // Paragraphe standard (avec inline + sauts simples → <br>).
    const withBreaks = trimmed.split('\n').map(applyInline).join('<br>')
    return `<p>${withBreaks}</p>`
  })

  return transformed.filter((b) => b.length > 0).join('\n')
}

function applyInline(input: string): string {
  let out = input
  // Liens markdown [text](url) — d'abord (sinon le `*` interne casse).
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, text, url) => `<a href="${url}" target="_blank" rel="noopener">${text}</a>`,
  )
  // Bold **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // Italic *text* (après bold pour éviter conflits)
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  return out
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helper exporté : enrollUserInTuganTrialSequence                            */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Enrôle un user dans la séquence trial_tugan. Insère 1 row dans
 * `automated_email_sequences` avec step=1, next_send_at=signupDate (envoie
 * J+0 immédiatement au prochain tick cron), status='pending'.
 *
 * À appeler depuis le webhook Stripe `customer.subscription.created` après
 * vérification que la subscription est bien en `trialing`.
 *
 * Idempotent : si une row existe déjà pour (user_id, sequence_type='trial_tugan')
 * en status='pending' | 'completed' | 'failed', l'insertion est skip.
 *
 * @param supabase - Client Supabase service_role
 * @param userId - auth.users.id du user à enrôler
 * @param signupDate - ISO 8601 timestamp d'inscription (= début essai)
 * @returns { enrolled: boolean, reason?: string }
 */
export async function enrollUserInTuganTrialSequence(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  signupDate: string,
): Promise<{ enrolled: boolean; reason?: string }> {
  // Vérifie qu'aucune séquence trial_tugan n'existe déjà pour ce user.
  const { data: existing } = await supabase
    .from('automated_email_sequences')
    .select('id, status')
    .eq('user_id', userId)
    .eq('sequence_type', 'trial_tugan')
    .maybeSingle()

  if (existing) {
    return {
      enrolled: false,
      reason: `already_enrolled_status_${(existing as { status: string }).status}`,
    }
  }

  const nextSendAt = computeNextSendAt(1, signupDate)
  const { error } = await supabase.from('automated_email_sequences').insert({
    user_id: userId,
    sequence_type: 'trial_tugan',
    step: 1,
    status: 'pending',
    signup_date: signupDate,
    next_send_at: nextSendAt,
  })

  if (error) {
    return { enrolled: false, reason: `db_error: ${error.message.slice(0, 200)}` }
  }

  return { enrolled: true }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Chargement user — auth + profile + subscription                            */
/* ─────────────────────────────────────────────────────────────────────────── */

async function loadUserContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<UserContext | null> {
  // 1. Email + first_name depuis profiles (fallback auth.users).
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, first_name')
    .eq('id', userId)
    .maybeSingle()

  let email: string | null = (profile as { email?: string | null } | null)?.email ?? null
  let firstName: string =
    (profile as { first_name?: string | null } | null)?.first_name ??
    ((profile as { full_name?: string | null } | null)?.full_name ?? '').split(' ')[0] ??
    ''

  // Fallback auth.users si pas dans profiles.
  if (!email) {
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    email = authUser?.user?.email ?? null
    if (!firstName) {
      const meta = (authUser?.user?.user_metadata ?? {}) as Record<string, unknown>
      firstName =
        (meta.first_name as string | undefined) ??
        (meta.full_name as string | undefined)?.split(' ')[0] ??
        ''
    }
  }

  if (!email) return null

  // 2. Plan + prix + prochain prélèvement depuis subscriptions.
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan_name, plan_price_eur, current_period_end, status')
    .eq('user_id', userId)
    .in('status', ['trialing', 'active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const planName = (sub as { plan_name?: string | null } | null)?.plan_name ?? 'Pro'
  const planPriceEur = Number(
    (sub as { plan_price_eur?: number | null } | null)?.plan_price_eur ?? 79,
  )
  const periodEnd =
    (sub as { current_period_end?: string | null } | null)?.current_period_end ?? null

  return {
    email,
    firstName: firstName || 'Diagnostiqueur',
    planName,
    planPriceEur,
    nextChargeDate: periodEnd ? formatDateFr(periodEnd) : null,
  }
}

function formatDateFr(isoOrDate: string): string {
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return isoOrDate
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const year = d.getUTCFullYear()
  return `${day}/${month}/${year}`
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Calcul des stats d'activité (missions, hours_saved, conformity_score)      */
/* ─────────────────────────────────────────────────────────────────────────── */

async function loadActivityStats(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  windowDays: number,
): Promise<ActivityStats> {
  const since = new Date(Date.now() - windowDays * 24 * 3_600_000).toISOString()

  // missions_count : nombre de missions terminées dans la fenêtre.
  // On select toutes les colonnes utiles pour calculer hours_saved + score.
  const { data: missions } = await supabase
    .from('missions')
    .select('id, time_saved_minutes, conformity_score')
    .eq('user_id', userId)
    .gte('created_at', since)

  const rows =
    (missions as Array<{
      id: string
      time_saved_minutes?: number | null
      conformity_score?: number | null
    }> | null) ?? []

  const missionsCount = rows.length

  // hours_saved : somme des minutes économisées (si la colonne existe), formaté "Xh Ymin"
  const totalMinutesSaved = rows.reduce((sum, r) => sum + (r.time_saved_minutes ?? 0), 0)
  const hoursSaved = formatHoursMinutes(totalMinutesSaved)

  // conformity_score : moyenne arrondie (0-100).
  const scores = rows.map((r) => r.conformity_score ?? null).filter((s): s is number => s !== null)
  const avgScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const conformityScore = scores.length > 0 ? `${avgScore} / 100` : '— (pas encore de données)'

  return {
    missionsCount,
    hoursSaved,
    conformityScore,
  }
}

function formatHoursMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0h 00min'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${String(minutes).padStart(2, '0')}min`
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Envoi Brevo                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

async function sendEmailViaBrevo(args: {
  apiKey: string
  senderName: string
  senderEmail: string
  toEmail: string
  toName: string
  subject: string
  htmlContent: string
  textContent: string
}): Promise<SendOutcome> {
  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': args.apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: args.senderName, email: args.senderEmail },
        to: [{ email: args.toEmail, name: args.toName }],
        subject: args.subject,
        htmlContent: args.htmlContent,
        textContent: args.textContent,
        tags: ['trial_tugan'],
      }),
    })

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      return { ok: false, error: `brevo_${resp.status}: ${detail.slice(0, 300)}` }
    }
    const data = (await resp.json().catch(() => ({}))) as { messageId?: string }
    return { ok: true, providerMessageId: data.messageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'brevo_network_error' }
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Traitement d'une row de séquence                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

async function processSequenceRow(
  supabase: ReturnType<typeof createClient>,
  env: { brevoApiKey: string; senderName: string; senderEmail: string },
  row: AutomatedEmailSequenceRow,
): Promise<{ status: 'sent' | 'completed' | 'failed' | 'skipped'; detail?: string }> {
  // 1. Step doit être dans [1, MAX_STEP].
  if (row.step < 1 || row.step > MAX_STEP) {
    await supabase
      .from('automated_email_sequences')
      .update({
        status: 'completed',
        last_error: `out_of_range_step_${row.step}`,
        next_send_at: null,
      })
      .eq('id', row.id)
    return { status: 'completed', detail: 'out_of_range' }
  }

  // 2. Trouve le template (step 1..8 → index 0..7).
  const template: TuganEmailTemplate | undefined = TUGAN_TRIAL_EMAILS[row.step - 1]
  if (!template) {
    await supabase
      .from('automated_email_sequences')
      .update({ status: 'failed', last_error: `no_template_for_step_${row.step}` })
      .eq('id', row.id)
    return { status: 'failed', detail: 'no_template' }
  }

  // 3. Charge user context.
  const userCtx = await loadUserContext(supabase, row.user_id)
  if (!userCtx) {
    await supabase
      .from('automated_email_sequences')
      .update({ status: 'failed', last_error: 'no_user_email' })
      .eq('id', row.id)
    return { status: 'failed', detail: 'no_user' }
  }

  // 4. Charge stats activité (fenêtre 7j pour steps 1-4, 30j pour steps 5-8).
  const windowDays = row.step <= 4 ? 7 : 30
  const stats = await loadActivityStats(supabase, row.user_id, windowDays)

  // 5. Render le template (placeholders neutres si donnée absente).
  let rendered: { subject: string; body: string }
  try {
    rendered = renderTuganEmail(template, {
      first_name: userCtx.firstName,
      missions_count: String(stats.missionsCount),
      hours_saved: stats.hoursSaved,
      conformity_score: stats.conformityScore,
      plan_name: userCtx.planName,
      plan_price_eur: String(userCtx.planPriceEur),
      next_charge_date: userCtx.nextChargeDate ?? 'à venir',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'render_failed'
    await supabase
      .from('automated_email_sequences')
      .update({ status: 'failed', last_error: `render_error: ${msg.slice(0, 200)}` })
      .eq('id', row.id)
    return { status: 'failed', detail: msg }
  }

  // 6. Convertit markdown → HTML.
  const htmlContent = wrapEmailLayout(simpleMarkdownToHtml(rendered.body))
  const textContent = rendered.body

  // 7. Envoie via Brevo.
  const sendResult = await sendEmailViaBrevo({
    apiKey: env.brevoApiKey,
    senderName: env.senderName,
    senderEmail: env.senderEmail,
    toEmail: userCtx.email,
    toName: userCtx.firstName,
    subject: rendered.subject,
    htmlContent,
    textContent,
  })

  if (!sendResult.ok) {
    await supabase
      .from('automated_email_sequences')
      .update({
        status: 'failed',
        last_sent_at: new Date().toISOString(),
        last_error: (sendResult.error ?? 'unknown').slice(0, 500),
      })
      .eq('id', row.id)
    return { status: 'failed', detail: sendResult.error }
  }

  // 8. Succès — incrémente step + calcule prochain envoi.
  const nextStep = row.step + 1
  const completed = nextStep > MAX_STEP
  const nextSendAt =
    !completed && row.signup_date ? computeNextSendAt(nextStep, row.signup_date) : null
  const nowIso = new Date().toISOString()

  await supabase
    .from('automated_email_sequences')
    .update({
      step: nextStep,
      status: completed ? 'completed' : 'pending',
      last_sent_at: nowIso,
      next_send_at: nextSendAt,
      last_error: null,
      ...(completed ? { completed_at: nowIso } : {}),
    })
    .eq('id', row.id)

  return { status: completed ? 'completed' : 'sent' }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Wrapper layout email (header + footer minimal)                             */
/* ─────────────────────────────────────────────────────────────────────────── */

function wrapEmailLayout(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>KOVAS</title></head>
<body style="margin:0;padding:0;background:#F8F5EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0F1E3D;line-height:1.55;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8F5EE;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF6;border:1px solid #D5CDB8;border-radius:18px;padding:32px;max-width:600px;">
        <tr><td style="font-size:15px;line-height:1.55;color:#0F1E3D;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="border-top:1px solid #E5DECB;padding-top:16px;margin-top:24px;font-size:12px;color:#7E8AA4;">
          KOVAS — édité par Nexus 1993, SASU. <a href="https://kovas.fr/preferences/unsubscribe" style="color:#4A5878;">Se désinscrire</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Entry point — Deno.serve                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const brevoApiKey = Deno.env.get('BREVO_API_KEY')
  const senderName = Deno.env.get('BREVO_SENDER_NAME') ?? 'Benjamin Bel — KOVAS'
  const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL') ?? 'benjamin@kovas.fr'

  if (!supabaseUrl || !serviceRole || !cronSecret || !brevoApiKey) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }

  // Auth Bearer
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const url = new URL(req.url)

  // Sub-endpoint POST /enroll body { userId, signupDate } — bonus
  if (url.pathname.endsWith('/enroll')) {
    try {
      const body = (await req.json().catch(() => ({}))) as {
        userId?: string
        signupDate?: string
      }
      if (!body.userId || !body.signupDate) {
        return jsonResponse({ error: 'missing_userId_or_signupDate' }, 400)
      }
      const result = await enrollUserInTuganTrialSequence(supabase, body.userId, body.signupDate)
      return jsonResponse(result, result.enrolled ? 200 : 409)
    } catch (err) {
      return jsonResponse(
        {
          error: 'enroll_failed',
          detail: err instanceof Error ? err.message : 'unknown',
        },
        500,
      )
    }
  }

  // Main : process batch
  const nowIso = new Date().toISOString()
  const { data: rows, error } = await supabase
    .from('automated_email_sequences')
    .select(
      'id, user_id, sequence_type, step, status, signup_date, next_send_at, last_sent_at, last_error',
    )
    .eq('sequence_type', 'trial_tugan')
    .eq('status', 'pending')
    .not('next_send_at', 'is', null)
    .lte('next_send_at', nowIso)
    .lte('step', MAX_STEP)
    .order('next_send_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    return jsonResponse({ error: 'db_error', detail: error.message }, 500)
  }

  const sequences = (rows ?? []) as AutomatedEmailSequenceRow[]
  const tally: Record<string, number> = {
    sent: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    exceptions: 0,
  }

  for (const row of sequences) {
    try {
      const result = await processSequenceRow(
        supabase,
        { brevoApiKey, senderName, senderEmail },
        row,
      )
      tally[result.status] = (tally[result.status] ?? 0) + 1
    } catch (err) {
      tally.exceptions += 1
      console.error('[process-trial-emails-tugan] row failed', row.id, err)
      await supabase
        .from('automated_email_sequences')
        .update({
          status: 'failed',
          last_error: `exception: ${(err instanceof Error ? err.message : 'unknown').slice(0, 300)}`,
        })
        .eq('id', row.id)
    }
  }

  return jsonResponse({
    ok: true,
    processedAt: nowIso,
    batchSize: sequences.length,
    maxBatchSize: BATCH_SIZE,
    tally,
  })
})
