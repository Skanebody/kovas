/**
 * KOVAS — Algo A1.3.1 — Détection DPE shopping.
 *
 * Avertit le diagnostiqueur qu'un DPE existant a été réalisé récemment sur le
 * bien et qu'un écart de classe pourrait déclencher un contrôle ADEME.
 *
 * Process :
 *   1. Récupère historique DPE 12 mois pour la parcelle (via profil unifié)
 *   2. Compare classe précédente vs classe estimée actuelle
 *   3. Si écart >= 2 classes → alerte info
 *   4. Si écart >= 3 classes → alerte warning
 *
 * Ton aidant, jamais accusateur (philosophie alertes KOVAS).
 * Authority : REFONTE-ACQUI-TARGET-V2 chapitre 9.2.
 */

import type { PropertyUnifiedProfile } from '@/lib/property/unified-profile'

const DPE_CLASS_RANK: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
}

export interface DpeShoppingResult {
  has_recent_dpe: boolean
  previous_class: string | null
  previous_date: string | null
  previous_diagnostician_anonymous_id: string | null
  days_since_previous: number | null
  class_gap: number | null
  alert_level: 'none' | 'info' | 'warning'
  user_message: string
}

/** Computes class gap entre A-G (positif = amélioration, négatif = dégradation). */
function classGap(previous: string, current: string): number {
  const p = DPE_CLASS_RANK[previous?.toUpperCase()]
  const c = DPE_CLASS_RANK[current?.toUpperCase()]
  if (!p || !c) return 0
  return p - c // F (6) vs A (1) = 5 (amélioration improbable)
}

export function detectDpeShopping(
  profile: PropertyUnifiedProfile,
  estimatedClass: string | null,
): DpeShoppingResult {
  // Filtre DPE des 12 derniers mois
  const oneYearAgo = Date.now() - 365 * 24 * 3600 * 1000
  const recent = profile.dpe_history
    .filter((d) => new Date(d.date).getTime() > oneYearAgo)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (recent.length === 0) {
    return {
      has_recent_dpe: false,
      previous_class: null,
      previous_date: null,
      previous_diagnostician_anonymous_id: null,
      days_since_previous: null,
      class_gap: null,
      alert_level: 'none',
      user_message: '',
    }
  }

  const latest = recent[0]
  if (!latest) {
    return {
      has_recent_dpe: false,
      previous_class: null,
      previous_date: null,
      previous_diagnostician_anonymous_id: null,
      days_since_previous: null,
      class_gap: null,
      alert_level: 'none',
      user_message: '',
    }
  }
  const daysSince = Math.floor((Date.now() - new Date(latest.date).getTime()) / (24 * 3600 * 1000))
  const gap = estimatedClass ? Math.abs(classGap(latest.class_dpe, estimatedClass)) : 0

  let alertLevel: 'none' | 'info' | 'warning' = 'none'
  let userMessage = ''

  if (gap >= 3) {
    alertLevel = 'warning'
    userMessage = `Un DPE classe ${latest.class_dpe} a été réalisé sur ce bien il y a ${daysSince} jours. Un écart de ${gap} classes pourrait déclencher un contrôle ADEME. Vérifiez les éléments justifiant l'écart (travaux récents, etc.).`
  } else if (gap >= 2) {
    alertLevel = 'info'
    userMessage = `Un DPE classe ${latest.class_dpe} a été réalisé sur ce bien il y a ${daysSince} jours. Écart de ${gap} classes — documentez les éléments expliquant la différence.`
  } else if (recent.length > 0) {
    alertLevel = 'info'
    userMessage = `Un DPE classe ${latest.class_dpe} a été réalisé sur ce bien il y a ${daysSince} jours. Pensez à comparer vos relevés pour cohérence.`
  }

  return {
    has_recent_dpe: true,
    previous_class: latest.class_dpe,
    previous_date: latest.date,
    previous_diagnostician_anonymous_id: null, // ADEME ne fournit pas l'ID diag
    days_since_previous: daysSince,
    class_gap: estimatedClass ? gap : null,
    alert_level: alertLevel,
    user_message: userMessage,
  }
}
