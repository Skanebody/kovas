/**
 * RGPD compliance helpers — KOVAS App
 * ─────────────────────────────────────────────────────────────
 * Utilitaires (pas server actions) pour :
 *   1. valider les consentements explicites des formulaires
 *   2. logger les accès aux données personnelles (audit trail)
 *   3. vérifier que la politique de confidentialité a été acceptée
 *      dans les 12 derniers mois (RGPD art. 7 — preuve du consentement)
 *
 * Multi-tenant : tous les helpers attendent un userId Supabase. La table
 * `audit_data_access` est protégée par RLS admin-only (cf. migration
 * 20260520000000_audit_data_access.sql).
 *
 * Cf. docs/SECURITY.md > "Politique RGPD résumée".
 */

import { createClient } from '@/lib/supabase/server'

// ─── Validation des consentements ─────────────────────────────────────

export interface ConsentValidationResult {
  valid: boolean
  missing: string[]
}

/**
 * Vérifie que chaque consentement requis a bien été coché (valeur 'on' ou 'true')
 * dans le FormData. Retourne la liste des consentements manquants si invalide.
 *
 * @param formData         FormData reçu côté server action
 * @param requiredConsents Liste des clés FormData attendues (ex. ['cgu', 'rgpd'])
 */
export function validateConsent(
  formData: FormData,
  requiredConsents: string[],
): ConsentValidationResult {
  const missing: string[] = []

  for (const key of requiredConsents) {
    const value = formData.get(key)
    const isAccepted = value === 'on' || value === 'true' || value === '1' || value === 'accepted'
    if (!isAccepted) {
      missing.push(key)
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  }
}

// ─── Audit trail des accès aux données ────────────────────────────────

export type DataAction = 'read' | 'export' | 'delete'

export interface DataAccessLogEntry {
  userId: string
  dataType: string
  action: DataAction
  ip?: string | null
  userAgent?: string | null
  organizationId?: string | null
}

/**
 * Logge un accès à une donnée personnelle dans la table audit_data_access.
 * Best-effort : ne lève pas d'erreur si le log échoue (l'opération métier
 * doit pouvoir continuer même si l'audit ne passe pas).
 *
 * @example
 *   await logDataAccess({
 *     userId: 'uuid-...',
 *     dataType: 'client.email',
 *     action: 'read',
 *     ip: request.headers.get('x-forwarded-for'),
 *   })
 */
export async function logDataAccess(entry: DataAccessLogEntry): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('audit_data_access').insert({
      user_id: entry.userId,
      organization_id: entry.organizationId ?? null,
      data_type: entry.dataType,
      action: entry.action,
      ip: entry.ip ?? null,
      user_agent: entry.userAgent ?? null,
    })
    if (error) {
      console.warn('[rgpd-checker] logDataAccess insert error', error.message)
    }
  } catch (err) {
    // Audit trail ne doit jamais bloquer l'opération métier.
    console.warn('[rgpd-checker] logDataAccess unexpected error', err)
  }
}

// ─── Vérification de la politique de confidentialité ──────────────────

const PRIVACY_POLICY_VALIDITY_DAYS = 365

export interface PrivacyPolicyStatus {
  current: boolean
  acceptedAt: Date | null
  expiresAt: Date | null
  daysRemaining: number | null
}

/**
 * Vérifie que la politique de confidentialité a été acceptée par
 * l'utilisateur authentifié dans les 12 derniers mois.
 *
 * Lit la colonne `profiles.privacy_policy_accepted_at` (timestamp).
 * Retourne `current: false` si jamais acceptée ou expirée.
 */
export async function assertPrivacyPolicyCurrent(): Promise<PrivacyPolicyStatus> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { current: false, acceptedAt: null, expiresAt: null, daysRemaining: null }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('privacy_policy_accepted_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !profile?.privacy_policy_accepted_at) {
    return { current: false, acceptedAt: null, expiresAt: null, daysRemaining: null }
  }

  const acceptedAt = new Date(profile.privacy_policy_accepted_at as string)
  const expiresAt = new Date(acceptedAt)
  expiresAt.setDate(expiresAt.getDate() + PRIVACY_POLICY_VALIDITY_DAYS)

  const now = Date.now()
  const daysRemaining = Math.floor((expiresAt.getTime() - now) / (1000 * 60 * 60 * 24))
  const current = expiresAt.getTime() > now

  return { current, acceptedAt, expiresAt, daysRemaining }
}
