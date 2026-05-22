import { createClient } from '@/lib/supabase/server'

/**
 * Statistiques publiques (preuve sociale) affichées sous le hero homepage.
 * Si la RPC Supabase n'existe pas encore (Phase 1 pré-launch) ou échoue,
 * on renvoie les chiffres baseline statiques validés dans le PRD (Sprint 14j).
 *
 * Pas de throw — la homepage doit toujours rendre, même offline.
 */
export type PublicStats = {
  /** Missions traitées dans les 30 derniers jours (toutes orgs confondues). */
  missionsLast30Days: number
  /** Diagnostiqueurs certifiés inscrits (compte trial + payant + archivés). */
  diagnosticiensInscrits: number
}

/** Fallback affiché si Supabase indisponible (chiffres baseline PRD). */
const FALLBACK_STATS: PublicStats = {
  missionsLast30Days: 5200,
  diagnosticiensInscrits: 15000,
}

/** Nom de la RPC Supabase (à créer en migration future — Lot #142+). */
const PUBLIC_STATS_RPC = 'public_stats_landing'

type PublicStatsRow = {
  missions_last_30_days: number | string | null
  diagnosticiens_inscrits: number | string | null
}

/**
 * Lit les KPIs publics depuis la RPC Supabase `public_stats_landing`.
 * Cette RPC doit retourner un row unique avec colonnes
 * `missions_last_30_days` (bigint) + `diagnosticiens_inscrits` (bigint).
 * Si elle n'existe pas encore (Phase 1), on dégrade silencieusement.
 *
 * NB: la RPC n'étant pas encore déclarée dans le schéma TypeScript généré,
 * on cast le nom de fonction. Quand la migration Lot #142 la créera,
 * `pnpm db:types` régénérera les types et le cast deviendra inutile.
 */
export async function getPublicStats(): Promise<PublicStats> {
  try {
    const supabase = await createClient()
    // Cast volontaire — la RPC sera ajoutée en migration future
    const rpcName = PUBLIC_STATS_RPC as unknown as 'is_member_of'
    const { data, error } = await supabase.rpc(rpcName).single()

    if (error || !data) {
      return FALLBACK_STATS
    }

    const row = data as unknown as PublicStatsRow

    return {
      missionsLast30Days: Number(row.missions_last_30_days) || FALLBACK_STATS.missionsLast30Days,
      diagnosticiensInscrits:
        Number(row.diagnosticiens_inscrits) || FALLBACK_STATS.diagnosticiensInscrits,
    }
  } catch {
    return FALLBACK_STATS
  }
}

/** Helper format français (espace insécable comme séparateur de milliers). */
export function formatStatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}
