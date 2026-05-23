/**
 * Séquence 3 emails RGPD préalable diagnostiqueurs (Mission B1).
 *
 * Stratégie : information progressive sur 30j (J+0, J+7, J+21) pour maximiser
 * le claim sans spammer, avec smart skip si:
 *  - unsubscribe explicite,
 *  - retrait demandé,
 *  - fiche déjà réclamée,
 *  - délai < 7j depuis le dernier envoi,
 *  - 2 derniers emails non-ouverts (proxy mauvais email).
 *
 * Cf. CLAUDE.md §14 (Légal — RGPD article 6.1.f intérêt légitime).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/send'

// ============================================
// Types
// ============================================

/**
 * Type local de la table `diagnosticians` (créée par Agent A1).
 * Réplique manuelle car non encore présente dans @kovas/database/types
 * tant que la migration A1 n'a pas été appliquée + types regen.
 */
export interface Diagnostician {
  id: string
  first_name: string
  last_name: string
  email: string
  city: string | null
  department_code: string | null
  department_name: string | null
  phone: string | null
  certifications: string[] | null
  certification_organization: string | null
  public_page_slug: string | null
  claim_status: 'unclaimed' | 'claimed' | 'disputed'
  claim_token: string | null
  is_published: boolean
  unsubscribed: boolean
  unsubscribed_at: string | null
  withdrawal_requested: boolean
  withdrawal_requested_at: string | null
  pre_notification_email_1_sent_at: string | null
  pre_notification_email_2_sent_at: string | null
  pre_notification_email_3_sent_at: string | null
}

export type EmailStep = 1 | 2 | 3

export type SendDecision =
  | { send: false; reason: SkipReason }
  | { send: true; step: EmailStep }

export type SkipReason =
  | 'unsubscribed'
  | 'withdrawal_requested'
  | 'already_claimed'
  | 'too_soon_since_last_send'
  | 'two_consecutive_unopened'
  | 'sequence_completed'
  | 'no_email'

// ============================================
// Identité légale NEXUS 1993 — depuis source vérité unique
// (cf. apps/web/src/lib/legal/company-identity.ts)
// ============================================
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'

const KOVAS_LEGAL = {
  address: `${COMPANY_IDENTITY.address.line1}, ${COMPANY_IDENTITY.address.postalCode} ${COMPANY_IDENTITY.address.city}`,
  siret: COMPANY_IDENTITY.siretFormatted,
  siren: COMPANY_IDENTITY.sirenFormatted,
  fromEmail: 'KOVAS · Benjamin Bel <contact@kovas.fr>',
  replyTo: 'contact@kovas.fr',
} as const

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kovas.fr'

// ============================================
// Subjects + chemins templates
// ============================================
const STEP_CONFIG: Record<EmailStep, { templateFile: string; subject: (d: Diagnostician) => string }> = {
  1: {
    templateFile: 'email-1-information.html',
    subject: (d) => `${d.first_name}, votre fiche professionnelle est sur KOVAS`,
  },
  2: {
    templateFile: 'email-2-benefits.html',
    subject: (d) =>
      `${d.first_name}, 3 particuliers cherchent un diagnostiqueur à ${d.city ?? 'votre secteur'} cette semaine`,
  },
  3: {
    templateFile: 'email-3-testimonial.html',
    subject: (d) => `${d.first_name}, comment Marc a converti 12 leads en 30 jours avec KOVAS`,
  },
}

// ============================================
// Cache templates (lus 1 fois par process)
// ============================================
const templateCache = new Map<EmailStep, string>()

function loadTemplate(step: EmailStep): string {
  const cached = templateCache.get(step)
  if (cached) return cached
  // Path relatif au cwd du process Node (apps/web racine en build Next.js)
  const templatePath = join(
    process.cwd(),
    'src',
    'emails',
    'diagnostician-rgpd',
    STEP_CONFIG[step].templateFile,
  )
  const raw = readFileSync(templatePath, 'utf-8')
  templateCache.set(step, raw)
  return raw
}

// ============================================
// Admin Supabase client (service_role, server-only)
// ============================================
function getAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase URL or service_role key missing in env')
  }
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ============================================
// Helpers URLs publiques
// ============================================
function buildUrls(diag: Diagnostician) {
  return {
    public_page_url: `${APP_URL}/diagnostiqueurs/${diag.public_page_slug ?? diag.id}`,
    claim_url: `${APP_URL}/reclamer-ma-fiche/${diag.id}${
      diag.claim_token ? `?token=${diag.claim_token}` : ''
    }`,
    correction_url: `${APP_URL}/d/${diag.id}/corriger`,
    withdrawal_url: `${APP_URL}/d/${diag.id}/demander-retrait`,
    unsubscribe_url: `${APP_URL}/d/${diag.id}/desabonner`,
  }
}

// ============================================
// Render template (placeholder substitution)
// ============================================
function renderTemplate(step: EmailStep, diag: Diagnostician, extras: Record<string, string> = {}): string {
  const raw = loadTemplate(step)
  const urls = buildUrls(diag)
  const certificationsList = (diag.certifications ?? []).join(', ') || 'Non renseignées'

  const vars: Record<string, string> = {
    first_name: diag.first_name,
    last_name: diag.last_name,
    city: diag.city ?? '',
    department_name: diag.department_name ?? '',
    department_code: diag.department_code ?? '',
    certifications_list: certificationsList,
    certification_organization: diag.certification_organization ?? 'Non renseigné',
    public_page_url: urls.public_page_url,
    claim_url: urls.claim_url,
    correction_url: urls.correction_url,
    withdrawal_url: urls.withdrawal_url,
    unsubscribe_url: urls.unsubscribe_url,
    kovas_legal_address: KOVAS_LEGAL.address,
    kovas_siret: KOVAS_LEGAL.siret,
    ...extras,
  }

  // Remplacement simple {{var}} → value (échappement HTML basique)
  return raw.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = vars[key]
    return value !== undefined ? escapeHtml(value) : match
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ============================================
// Smart skip logic
// ============================================
const MIN_DAYS_BETWEEN_SENDS = 7
const STEP_2_DELAY_DAYS = 7
const STEP_3_DELAY_DAYS = 14 // après email 2 = J+21 depuis J+0

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24))
}

/**
 * Calcule quel email envoyer pour ce diagnostiqueur, ou skip.
 *
 * Logique :
 * 1. Skip si unsubscribed / withdrawal_requested / claim_status != 'unclaimed'
 * 2. Skip si pas d'email
 * 3. Skip si 2 derniers emails envoyés non-ouverts (proxy mauvais email)
 * 4. Step 1 : si email 1 jamais envoyé
 * 5. Step 2 : si email 1 envoyé il y a ≥ 7j et email 2 jamais envoyé
 * 6. Step 3 : si email 2 envoyé il y a ≥ 14j et email 3 jamais envoyé
 * 7. Sinon : skip (séquence terminée ou en attente)
 */
export async function shouldSendNextEmail(diag: Diagnostician): Promise<SendDecision> {
  if (!diag.email) return { send: false, reason: 'no_email' }
  if (diag.unsubscribed) return { send: false, reason: 'unsubscribed' }
  if (diag.withdrawal_requested) return { send: false, reason: 'withdrawal_requested' }
  if (diag.claim_status !== 'unclaimed') return { send: false, reason: 'already_claimed' }

  const sent1 = diag.pre_notification_email_1_sent_at
  const sent2 = diag.pre_notification_email_2_sent_at
  const sent3 = diag.pre_notification_email_3_sent_at

  // Quick "too soon" guard sur dernier envoi (toutes étapes)
  const lastSent = [sent1, sent2, sent3].filter((x): x is string => x !== null).sort().pop() ?? null
  const daysSinceLast = daysSince(lastSent)
  if (daysSinceLast !== null && daysSinceLast < MIN_DAYS_BETWEEN_SENDS) {
    return { send: false, reason: 'too_soon_since_last_send' }
  }

  // Step 1 : jamais envoyé
  if (!sent1) return { send: true, step: 1 }

  // Step 2 : envoi 1 ≥ 7j et 2 jamais envoyé
  // Note : on n'attend pas que email 1 soit "opened" pour envoyer 2 — le préheader
  // peut suffire à informer, et certains clients mail bloquent les pixels d'ouverture.
  // C'est uniquement à l'étape 3 qu'on coupe si 2 non-ouverts consécutifs.
  if (!sent2) {
    const d = daysSince(sent1)
    if (d !== null && d >= STEP_2_DELAY_DAYS) {
      return { send: true, step: 2 }
    }
    return { send: false, reason: 'too_soon_since_last_send' }
  }

  // Step 3 : envoi 2 ≥ 14j et 3 jamais envoyé
  if (!sent3) {
    const d = daysSince(sent2)
    if (d !== null && d >= STEP_3_DELAY_DAYS) {
      // Check : si email 1 ET email 2 non-ouverts → skip définitivement (mauvais email)
      const [opened1, opened2] = await Promise.all([hasOpened(diag.id, 1), hasOpened(diag.id, 2)])
      if (!opened1 && !opened2) {
        return { send: false, reason: 'two_consecutive_unopened' }
      }
      return { send: true, step: 3 }
    }
    return { send: false, reason: 'too_soon_since_last_send' }
  }

  // Séquence complète
  return { send: false, reason: 'sequence_completed' }
}

async function hasOpened(diagnosticianId: string, step: EmailStep): Promise<boolean> {
  const admin = getAdmin()
  const { count } = await admin
    .from('diagnostician_email_events')
    .select('*', { count: 'exact', head: true })
    .eq('diagnostician_id', diagnosticianId)
    .eq('email_step', step)
    .in('event_type', ['opened', 'clicked'])
  return (count ?? 0) > 0
}

// ============================================
// Core send (utilisé par les 3 wrappers)
// ============================================
async function sendPreNotificationEmail(diagId: string, step: EmailStep): Promise<void> {
  const admin = getAdmin()

  // Fetch diagnostician
  const { data: rawDiag, error: fetchErr } = await admin
    .from('diagnosticians')
    .select('*')
    .eq('id', diagId)
    .single()
  if (fetchErr || !rawDiag) {
    throw new Error(`Diagnostician ${diagId} not found: ${fetchErr?.message ?? 'unknown'}`)
  }

  // Narrowing : on assume la structure type Diagnostician (cf. Agent A1)
  const diag = rawDiag as unknown as Diagnostician

  // Double-check skip (idempotence — la cron peut appeler en parallèle)
  const decision = await shouldSendNextEmail(diag)
  if (!decision.send) {
    console.log(`[rgpd-sender] Skip diag=${diagId} step=${step} reason=${decision.reason}`)
    return
  }
  if (decision.step !== step) {
    console.log(
      `[rgpd-sender] Step mismatch diag=${diagId} requested=${step} actual=${decision.step}, sending actual.`,
    )
    // On envoie l'étape réelle calculée (cohérence)
    return sendPreNotificationEmail(diagId, decision.step)
  }

  const config = STEP_CONFIG[step]
  const html = renderTemplate(step, diag)
  const subject = config.subject(diag)

  // Tags Resend pour tracking webhook : diag_id + step + sequence name
  const result = await sendEmail({
    to: diag.email,
    subject,
    html,
    category: 'product',
    from: KOVAS_LEGAL.fromEmail,
    replyTo: KOVAS_LEGAL.replyTo,
    tags: [
      { name: 'sequence', value: 'diagnostician_rgpd' },
      { name: 'step', value: String(step) },
      { name: 'diag_id', value: diagId },
    ],
  })

  if (!result.success) {
    throw new Error(`Resend failed diag=${diagId} step=${step}: ${result.error ?? 'unknown'}`)
  }

  // Update timestamp sur diagnosticians
  const stepColumn = `pre_notification_email_${step}_sent_at` as const
  const { error: updateErr } = await admin
    .from('diagnosticians')
    .update({ [stepColumn]: new Date().toISOString() })
    .eq('id', diagId)
  if (updateErr) {
    console.error(`[rgpd-sender] Update timestamp failed: ${updateErr.message}`)
  }

  // Log 'sent' event (idempotent même si webhook réagit aussi)
  await admin.from('diagnostician_email_events').insert({
    diagnostician_id: diagId,
    email_step: step,
    event_type: 'sent',
    resend_message_id: result.id ?? null,
  })
}

// ============================================
// Wrappers publics
// ============================================
export async function sendPreNotificationEmail1(diagId: string): Promise<void> {
  return sendPreNotificationEmail(diagId, 1)
}

export async function sendPreNotificationEmail2(diagId: string): Promise<void> {
  return sendPreNotificationEmail(diagId, 2)
}

export async function sendPreNotificationEmail3(diagId: string): Promise<void> {
  return sendPreNotificationEmail(diagId, 3)
}

/**
 * Envoie l'étape suivante adaptée (smart). Utilisé par le cron quotidien.
 * Retourne true si un email a été envoyé, false sinon.
 */
export async function sendNextRgpdEmail(diagId: string): Promise<boolean> {
  const admin = getAdmin()
  const { data: rawDiag, error } = await admin
    .from('diagnosticians')
    .select('*')
    .eq('id', diagId)
    .single()
  if (error || !rawDiag) {
    console.error(`[rgpd-sender] Fetch failed for ${diagId}: ${error?.message}`)
    return false
  }
  const diag = rawDiag as unknown as Diagnostician
  const decision = await shouldSendNextEmail(diag)
  if (!decision.send) return false
  await sendPreNotificationEmail(diagId, decision.step)
  return true
}
