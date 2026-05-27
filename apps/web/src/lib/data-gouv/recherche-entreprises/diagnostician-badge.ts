/**
 * KOVAS — Helper d'affichage badge "Activité diagnostic immobilier vérifiée"
 * pour les fiches publiques de l'annuaire (/trouver-un-diagnostiqueur/...).
 *
 * Source : cache `sirene_check_cache` (TTL 7j, alimenté au signup et lors
 * des rafraîchissements admin).
 *
 * Sécurité :
 *   - Lecture publique autorisée par la RLS (open data INSEE).
 *   - Aucune mention IA — c'est de l'open data officiel État.
 *
 * Authority : CLAUDE.md §6, docs/data-gouv-opportunities.md §2.5.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { lookupVerificationCache } from './cache'

export interface DiagnosticianSireneBadge {
  /** L'établissement existe et est actif au registre SIRENE. */
  isVerified: boolean
  /** Code NAF normalisé (`"71.20B"`) si disponible. */
  nafCode: string | null
  /** Libellé humain du NAF (ex. "Analyses, essais et inspections techniques"). */
  nafLabel: string | null
  /**
   * Identité légale enrichie (open data — affichable publiquement, équivalent
   * du RPPS pour les médecins sur Doctolib). Tous les champs sont nullables
   * pour permettre une dégradation gracieuse si l'API n'a pas l'information.
   */
  companyName: string | null
  legalForm: string | null
  siret: string | null
}

const EMPTY: DiagnosticianSireneBadge = {
  isVerified: false,
  nafCode: null,
  nafLabel: null,
  companyName: null,
  legalForm: null,
  siret: null,
}

/**
 * Récupère le badge SIRENE depuis le cache pour un SIRET donné.
 * Retourne `EMPTY` si pas de cache, expiré, ou SIRET non vérifié activité diag.
 */
export async function fetchDiagnosticianSireneBadge(
  // biome-ignore lint/suspicious/noExplicitAny: Supabase générique
  supabase: SupabaseClient<any, any, any>,
  siret: string | null | undefined,
): Promise<DiagnosticianSireneBadge> {
  if (!siret) return EMPTY
  const cleaned = siret.replace(/\s/g, '')
  if (!/^\d{14}$/.test(cleaned)) return EMPTY

  const cached = await lookupVerificationCache(supabase, cleaned)
  if (!cached.hit || !cached.result) return EMPTY

  const r = cached.result
  if (!r.found || !r.isActive || !r.isDiagnosticNAF) return EMPTY

  return {
    isVerified: true,
    nafCode: r.nafCode,
    nafLabel: r.nafLabel,
    companyName: r.companyName ?? null,
    legalForm: r.legalForm ?? null,
    siret: r.siret ?? cleaned,
  }
}
