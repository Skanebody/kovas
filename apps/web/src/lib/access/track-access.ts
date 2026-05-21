import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * KOVAS — Track access dual track (Annuaire B2C + Logiciel B2B).
 *
 * Source de vérité côté server pour répondre à : "l'organisation courante
 * dispose-t-elle d'un accès Annuaire seul, Logiciel seul, des deux (dual)
 * ou d'aucun (free) ?".
 *
 * Memoized via React `cache()` pour une seule requête par cycle (server
 * component layouts + pages), donc utilisable dans plusieurs blocs sans
 * coût additionnel.
 */

/** Type d'accès dual track. */
export type TrackAccess = 'free' | 'annuaire-only' | 'logiciel-only' | 'dual'

export interface TrackAccessResult {
  track: TrackAccess
  annuaireActive: boolean
  logicielActive: boolean
  bundleActive: boolean
  bundleCode: string | null
}

const EMPTY_RESULT: TrackAccessResult = {
  track: 'free',
  annuaireActive: false,
  logicielActive: false,
  bundleActive: false,
  bundleCode: null,
}

/**
 * Retourne l'accès dual track de l'organisation courante :
 * - `'free'`         : aucune souscription active (essai ou plan gratuit)
 * - `'annuaire-only'`: souscription KOVAS Annuaire active uniquement
 * - `'logiciel-only'`: souscription KOVAS 360 active uniquement
 * - `'dual'`         : les deux souscriptions actives OU bundle souscrit
 *
 * Memoized via React `cache()` pour une seule requête par request lifecycle.
 */
export const getUserTrackAccess = cache(async (): Promise<TrackAccessResult> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return EMPTY_RESULT

  // Lookup org_id via profil (default_org_id pointe vers l'organisation principale).
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_org_id')
    .eq('id', user.id)
    .maybeSingle()

  const orgId = (profile as { default_org_id?: string | null } | null)?.default_org_id
  if (!orgId) return EMPTY_RESULT

  // Souscriptions actives : `plan_code` (V3 dual track) + fallback `tier`
  // (schéma legacy E2c) — colonne plan_code introduite par la migration Phase B,
  // pas encore dans les types Database générés → cast untyped local.
  const untyped = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => Promise<{ data: unknown[] | null }>
          limit: (n: number) => Promise<{ data: unknown[] | null }>
        }
      }
    }
  }

  // La colonne `plan_code` n'existe pas encore dans toutes les DBs (introduite
  // par la migration Phase B). On essaie d'abord avec ; si le select complet
  // renvoie [] (colonne manquante = postgrest error silencieuse), on retombe
  // sur `tier` seul. Sans ce fallback, `rawSubs` reste vide et track='free'
  // pour les comptes legacy → sidebar quasi-vide.
  let rawSubs: unknown[] | null = null
  const subWithPlanCode = await untyped
    .from('subscriptions')
    .select('plan_code, tier, status')
    .eq('organization_id', orgId)
    .eq('status', 'active')
  rawSubs = subWithPlanCode.data ?? null
  if (!rawSubs || rawSubs.length === 0) {
    const subTierOnly = await untyped
      .from('subscriptions')
      .select('tier, status')
      .eq('organization_id', orgId)
      .eq('status', 'active')
    rawSubs = subTierOnly.data ?? null
  }

  // Bundles actifs (table `bundle_subscriptions` introduite Phase B).
  // Tolérance erreur si la table n'existe pas encore en dev — return null silencieux.
  let bundleCode: string | null = null
  try {
    const { data: rawBundles } = await untyped
      .from('bundle_subscriptions')
      .select('bundle_code, status')
      .eq('organization_id', orgId)
      .eq('status', 'active')
    const firstBundle = (rawBundles ?? [])[0] as { bundle_code?: string | null } | undefined
    bundleCode = firstBundle?.bundle_code ?? null
  } catch {
    bundleCode = null
  }

  const subs = (rawSubs ?? []) as Array<{ plan_code?: string | null; tier?: string | null }>
  const planCodes = subs
    .map((s) => s.plan_code ?? s.tier)
    .filter((c): c is string => Boolean(c))

  const annuaireActive = planCodes.some((c) => c.startsWith('annuaire_') && c !== 'annuaire_free')

  const logicielActive = planCodes.some((c) => {
    if (c.startsWith('logiciel_')) return c !== 'logiciel_free'
    if (c === 'essential' || c === 'decouverte' || c === 'pro' || c === 'all_inclusive' || c === 'cabinet') return true
    // Tiers grandfather bruts (avant suffixe `_legacy`) — la colonne `subscriptions.tier`
    // utilise encore ces noms historiques pour les comptes pré-migration B.
    if (c === 'volume' || c === 'standard' || c === 'founder') return true
    if (c.endsWith('_legacy')) return true
    return false
  })

  const bundleActive = bundleCode !== null

  let track: TrackAccess = 'free'
  if (bundleActive || (annuaireActive && logicielActive)) track = 'dual'
  else if (annuaireActive) track = 'annuaire-only'
  else if (logicielActive) track = 'logiciel-only'

  return {
    track,
    annuaireActive,
    logicielActive,
    bundleActive,
    bundleCode,
  }
})
