/**
 * KOVAS — Edge Function : purge-old-data
 *
 * Purge automatique des données obsolètes pour conformité RGPD (data
 * minimization, article 5.1.c) et nettoyage des tables intermédiaires.
 *
 * Tables purgées :
 *   1. quote_requests > 12 mois : ANONYMISATION (pas DELETE) — on garde les
 *      stats agrégées (intent_score, status, geo, etc.) mais on supprime
 *      toutes les PII (email, phone, nom, adresse, IP, UA).
 *   2. otp_codes expirés > 24h : DELETE direct (codes éphémères, plus
 *      utilisables après expiration de 5 min).
 *   3. bandit_events > 6 mois : DELETE (signaux trop anciens pour le
 *      bandit annuaire, table grossit vite).
 *   4. admin_2fa_attempts > 90 jours : DELETE (rate-limit fenêtre 5 min,
 *      ne sert plus à l'analytics au-delà).
 *   5. csp_violations > 30 jours : DELETE si table existe (sentry replay
 *      / CSP reports, valeur opérationnelle < 30j).
 *
 * Déclencheurs :
 *   - cron pg_cron quotidien 03:00 UTC (cf. migration 20260527240000_*)
 *   - invocation manuelle admin :
 *     POST /functions/v1/purge-old-data
 *     Header : Authorization: Bearer $INTERNAL_PURGE_SECRET
 *
 * Retour JSON :
 *   {
 *     ok: true,
 *     ran_at: ISO timestamp,
 *     purged: PurgeResult[],
 *     total: number,
 *     errors: Array<{ table: string, error: string }>
 *   }
 *
 * Sécurité :
 *   - Auth Bearer via INTERNAL_PURGE_SECRET (secret Vault distinct de la
 *     service_role_key pour limiter le blast radius en cas de fuite).
 *   - service_role_key utilisée côté Supabase pour bypass RLS (UPDATE +
 *     DELETE sur tables sensibles).
 */

// deno-lint-ignore-file no-explicit-any
import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

// ────────────────────────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const INTERNAL_PURGE_SECRET = Deno.env.get('INTERNAL_PURGE_SECRET') ?? ''

// Rétentions (en ms)
const MS_DAY = 24 * 60 * 60 * 1000
const RETENTION_QUOTE_REQUESTS_MS = 365 * MS_DAY // 12 mois
const RETENTION_OTP_CODES_MS = 1 * MS_DAY // 24h après expiration
const RETENTION_BANDIT_EVENTS_MS = 183 * MS_DAY // ~6 mois
const RETENTION_ADMIN_2FA_MS = 90 * MS_DAY // 90 jours
const RETENTION_CSP_VIOLATIONS_MS = 30 * MS_DAY // 30 jours

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface PurgeResult {
  table: string
  action: 'anonymize' | 'delete' | 'skipped'
  rows_purged: number
  oldest_kept: string // ISO date (cutoff timestamp)
  duration_ms: number
  error?: string
}

interface PurgeSummary {
  ok: boolean
  ran_at: string
  purged: PurgeResult[]
  total: number
  errors: Array<{ table: string; error: string }>
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function isoCutoff(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

// ────────────────────────────────────────────────────────────────────────────
// Purge 1 — Anonymisation des quote_requests > 12 mois
// ────────────────────────────────────────────────────────────────────────────
/**
 * RGPD article 5.1.c (minimisation) — On ne peut pas garder les PII des
 * leads au-delà du délai nécessaire à leur traitement. 12 mois est la
 * durée standard pour les leads B2C non convertis (cf. CNIL guide marketing
 * direct). On garde les LIGNES (pour stats `intent_score`, conversion
 * funnel, etc.) mais on EFFACE les PII.
 */
async function anonymizeOldQuoteRequests(supabase: SupabaseClient): Promise<PurgeResult> {
  const startedAt = Date.now()
  const cutoff = isoCutoff(RETENTION_QUOTE_REQUESTS_MS)

  try {
    // UPDATE (pas DELETE) — garde les agrégats statistiques
    const { data, error } = await (supabase as any)
      .from('quote_requests')
      .update({
        requester_email: 'anon@kovas.fr',
        requester_phone: null,
        requester_first_name: 'Anonyme',
        requester_last_name: 'Anonyme',
        property_address: '[anonymisé]',
        message: null,
        ip_address: null,
        user_agent: null,
        anonymized_at: new Date().toISOString(),
      })
      .lt('created_at', cutoff)
      .is('anonymized_at', null)
      .select('id')

    if (error) {
      return {
        table: 'quote_requests',
        action: 'anonymize',
        rows_purged: 0,
        oldest_kept: cutoff,
        duration_ms: Date.now() - startedAt,
        error: error.message,
      }
    }

    return {
      table: 'quote_requests',
      action: 'anonymize',
      rows_purged: Array.isArray(data) ? data.length : 0,
      oldest_kept: cutoff,
      duration_ms: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      table: 'quote_requests',
      action: 'anonymize',
      rows_purged: 0,
      oldest_kept: cutoff,
      duration_ms: Date.now() - startedAt,
      error: (err as Error).message,
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Purge 2 — DELETE des otp_codes expirés > 24h
// ────────────────────────────────────────────────────────────────────────────
/**
 * Les codes OTP ont une durée de vie de 5 minutes (cf. otp_codes.expires_at
 * DEFAULT now() + 5 min). Au-delà de 24h post-expiration, ils n'ont plus
 * aucun usage (audit, debug, etc.) — purge directe.
 */
async function purgeExpiredOtpCodes(supabase: SupabaseClient): Promise<PurgeResult> {
  const startedAt = Date.now()
  const cutoff = isoCutoff(RETENTION_OTP_CODES_MS)

  try {
    const { data, error } = await (supabase as any)
      .from('otp_codes')
      .delete()
      .lt('expires_at', cutoff)
      .select('id')

    if (error) {
      return {
        table: 'otp_codes',
        action: 'delete',
        rows_purged: 0,
        oldest_kept: cutoff,
        duration_ms: Date.now() - startedAt,
        error: error.message,
      }
    }

    return {
      table: 'otp_codes',
      action: 'delete',
      rows_purged: Array.isArray(data) ? data.length : 0,
      oldest_kept: cutoff,
      duration_ms: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      table: 'otp_codes',
      action: 'delete',
      rows_purged: 0,
      oldest_kept: cutoff,
      duration_ms: Date.now() - startedAt,
      error: (err as Error).message,
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Purge 3 — DELETE des bandit_events > 6 mois
// ────────────────────────────────────────────────────────────────────────────
/**
 * Note : la spec parlait de `bandit_assignments` mais la table réelle est
 * `bandit_events` (cf. migration 20260522200000_bandit_annuaire.sql).
 * Les events > 6 mois ne sont plus exploités par le decay du bandit
 * (cf. compute via bandit_diagnostician_stats agrégés). Purge OK.
 */
async function purgeOldBanditEvents(supabase: SupabaseClient): Promise<PurgeResult> {
  const startedAt = Date.now()
  const cutoff = isoCutoff(RETENTION_BANDIT_EVENTS_MS)

  try {
    const { data, error } = await (supabase as any)
      .from('bandit_events')
      .delete()
      .lt('occurred_at', cutoff)
      .select('id')

    if (error) {
      // Table peut ne pas exister sur certains envs — tolérant
      if (error.code === '42P01') {
        return {
          table: 'bandit_events',
          action: 'skipped',
          rows_purged: 0,
          oldest_kept: cutoff,
          duration_ms: Date.now() - startedAt,
          error: 'table_does_not_exist',
        }
      }
      return {
        table: 'bandit_events',
        action: 'delete',
        rows_purged: 0,
        oldest_kept: cutoff,
        duration_ms: Date.now() - startedAt,
        error: error.message,
      }
    }

    return {
      table: 'bandit_events',
      action: 'delete',
      rows_purged: Array.isArray(data) ? data.length : 0,
      oldest_kept: cutoff,
      duration_ms: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      table: 'bandit_events',
      action: 'delete',
      rows_purged: 0,
      oldest_kept: cutoff,
      duration_ms: Date.now() - startedAt,
      error: (err as Error).message,
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Purge 4 — DELETE des admin_2fa_attempts > 90 jours
// ────────────────────────────────────────────────────────────────────────────
/**
 * La fenêtre de rate-limit est de quelques minutes. 90 jours suffisent
 * pour des audits de sécurité a posteriori. Au-delà, on purge.
 */
async function purgeOldAdmin2faAttempts(supabase: SupabaseClient): Promise<PurgeResult> {
  const startedAt = Date.now()
  const cutoff = isoCutoff(RETENTION_ADMIN_2FA_MS)

  try {
    const { data, error } = await (supabase as any)
      .from('admin_2fa_attempts')
      .delete()
      .lt('created_at', cutoff)
      .select('id')

    if (error) {
      if (error.code === '42P01') {
        return {
          table: 'admin_2fa_attempts',
          action: 'skipped',
          rows_purged: 0,
          oldest_kept: cutoff,
          duration_ms: Date.now() - startedAt,
          error: 'table_does_not_exist',
        }
      }
      return {
        table: 'admin_2fa_attempts',
        action: 'delete',
        rows_purged: 0,
        oldest_kept: cutoff,
        duration_ms: Date.now() - startedAt,
        error: error.message,
      }
    }

    return {
      table: 'admin_2fa_attempts',
      action: 'delete',
      rows_purged: Array.isArray(data) ? data.length : 0,
      oldest_kept: cutoff,
      duration_ms: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      table: 'admin_2fa_attempts',
      action: 'delete',
      rows_purged: 0,
      oldest_kept: cutoff,
      duration_ms: Date.now() - startedAt,
      error: (err as Error).message,
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Purge 5 — DELETE des csp_violations > 30 jours (si la table existe)
// ────────────────────────────────────────────────────────────────────────────
/**
 * Table optionnelle, peut ne pas exister sur tous les envs. Si elle
 * n'existe pas, on log et on retourne action=skipped sans bloquer.
 */
async function purgeOldCspViolations(supabase: SupabaseClient): Promise<PurgeResult> {
  const startedAt = Date.now()
  const cutoff = isoCutoff(RETENTION_CSP_VIOLATIONS_MS)

  try {
    const { data, error } = await (supabase as any)
      .from('csp_violations')
      .delete()
      .lt('created_at', cutoff)
      .select('id')

    if (error) {
      if (error.code === '42P01') {
        return {
          table: 'csp_violations',
          action: 'skipped',
          rows_purged: 0,
          oldest_kept: cutoff,
          duration_ms: Date.now() - startedAt,
          error: 'table_does_not_exist',
        }
      }
      return {
        table: 'csp_violations',
        action: 'delete',
        rows_purged: 0,
        oldest_kept: cutoff,
        duration_ms: Date.now() - startedAt,
        error: error.message,
      }
    }

    return {
      table: 'csp_violations',
      action: 'delete',
      rows_purged: Array.isArray(data) ? data.length : 0,
      oldest_kept: cutoff,
      duration_ms: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      table: 'csp_violations',
      action: 'delete',
      rows_purged: 0,
      oldest_kept: cutoff,
      duration_ms: Date.now() - startedAt,
      error: (err as Error).message,
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// HTTP handler
// ────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Auth check via Authorization header — secret distinct service_role_key
  const auth = req.headers.get('Authorization')
  const expected = `Bearer ${INTERNAL_PURGE_SECRET}`
  if (!INTERNAL_PURGE_SECRET || auth !== expected) {
    console.warn('[purge-old-data] unauthorized request')
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const summary: PurgeSummary = {
    ok: true,
    ran_at: new Date().toISOString(),
    purged: [],
    total: 0,
    errors: [],
  }

  // Exécute les 5 purges séquentiellement (pas de risque de contention
  // sur des tables différentes, mais log plus lisible en séquentiel)
  try {
    const purges = [
      anonymizeOldQuoteRequests,
      purgeExpiredOtpCodes,
      purgeOldBanditEvents,
      purgeOldAdmin2faAttempts,
      purgeOldCspViolations,
    ]

    for (const purgeFn of purges) {
      const result = await purgeFn(supabase)
      summary.purged.push(result)
      summary.total += result.rows_purged
      if (result.error && result.action !== 'skipped') {
        summary.errors.push({ table: result.table, error: result.error })
      }
      console.log(
        `[purge-old-data] ${result.table} (${result.action}) : rows=${result.rows_purged}, duration=${result.duration_ms}ms${result.error ? `, error=${result.error}` : ''}`,
      )
    }

    if (summary.errors.length > 0) {
      summary.ok = false
    }

    return new Response(JSON.stringify(summary, null, 2), {
      status: summary.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[purge-old-data] fatal error', err)
    return new Response(
      JSON.stringify({
        ok: false,
        ran_at: new Date().toISOString(),
        error: 'fatal',
        detail: (err as Error).message,
        purged: summary.purged,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})
