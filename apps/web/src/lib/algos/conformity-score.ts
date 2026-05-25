/**
 * KOVAS — Algo A1.3.3 — Score conformité multi-dimensionnel pré-export.
 *
 * Produit score 0-100 + breakdown + ≤5 anomalies + ≤3 opportunités avant
 * export vers Liciel/OBBC/DS8.
 *
 * Breakdown :
 *   - Cohérence Données (30%) : cross-check entre champs liés
 *   - Risque ADEME (30%) : match patterns historiques + DPE shopping + cadastre
 *   - Risque Litigation (20%) : clauses obligatoires, photos min, mentions réserves
 *   - Complétude (20%) : % champs obligatoires remplis pondérés
 *
 * Performance budget : < 800 ms.
 * Authority : REFONTE-ACQUI-TARGET-V2 chapitres 9.2 + 6.2.
 */

import type { PropertyUnifiedProfile } from '@/lib/property/unified-profile'
import { checkCadastreCoherence } from './cadastre-coherence'
import { detectDpeShopping } from './dpe-shopping'

export interface ConformityAnomaly {
  id: string
  title: string
  description: string
  suggested_action: string
  severity: 'info' | 'warning' | 'danger'
  auto_fixable: boolean
}

export interface ConformityOpportunity {
  id: string
  title: string
  estimated_gain: string
  action: string
}

export interface ConformityScoreResult {
  global_score: number
  breakdown: {
    coherence: number
    ademe_risk: number
    litigation_risk: number
    completude: number
  }
  anomalies: ConformityAnomaly[]
  opportunities: ConformityOpportunity[]
}

export interface MissionContextForConformity {
  diagnostic_type:
    | 'DPE'
    | 'AMIANTE'
    | 'PLOMB'
    | 'GAZ'
    | 'ELECTRICITE'
    | 'TERMITES'
    | 'CARREZ'
    | 'ERP'
  declared_surface_m2: number | null
  estimated_dpe_class: string | null
  has_photos: boolean
  photos_count: number
  has_reserves_mentioned: boolean
  required_fields_filled: number
  required_fields_total: number
}

const MAX_ANOMALIES = 5
const MAX_OPPORTUNITIES = 3

export function computeConformityScore(
  profile: PropertyUnifiedProfile,
  mission: MissionContextForConformity,
): ConformityScoreResult {
  const anomalies: ConformityAnomaly[] = []
  const opportunities: ConformityOpportunity[] = []

  // ─── Score Cohérence (30%) ──────────────────────────────────────────
  // Check surface vs cadastre
  let coherenceScore = 100
  if (mission.declared_surface_m2 != null) {
    const cadastre = checkCadastreCoherence(profile, mission.declared_surface_m2)
    if (cadastre.alert_level === 'warning') {
      coherenceScore -= 30
      anomalies.push({
        id: 'cadastre-gap-warning',
        title: 'Écart surface cadastrale important',
        description: cadastre.suggested_action ?? '',
        suggested_action: 'Re-vérifier la mesure ou documenter les annexes.',
        severity: 'warning',
        auto_fixable: false,
      })
    } else if (cadastre.alert_level === 'info') {
      coherenceScore -= 10
      anomalies.push({
        id: 'cadastre-gap-info',
        title: 'Léger écart cadastre',
        description: cadastre.suggested_action ?? '',
        suggested_action: 'Mentionner les annexes si applicable.',
        severity: 'info',
        auto_fixable: false,
      })
    }
  }

  // ─── Score Risque ADEME (30%) ──────────────────────────────────────
  let ademeScore = 100
  if (mission.diagnostic_type === 'DPE' && mission.estimated_dpe_class) {
    const shopping = detectDpeShopping(profile, mission.estimated_dpe_class)
    if (shopping.alert_level === 'warning') {
      ademeScore -= 40
      anomalies.push({
        id: 'dpe-shopping-warning',
        title: 'DPE récent avec écart important',
        description: shopping.user_message,
        suggested_action: "Documenter travaux ou justifier l'écart de classe.",
        severity: 'warning',
        auto_fixable: false,
      })
    } else if (shopping.alert_level === 'info' && shopping.class_gap && shopping.class_gap >= 2) {
      ademeScore -= 15
      anomalies.push({
        id: 'dpe-shopping-info',
        title: 'DPE récent à comparer',
        description: shopping.user_message,
        suggested_action: 'Comparer vos relevés au DPE précédent.',
        severity: 'info',
        auto_fixable: false,
      })
    }
  }

  // ─── Score Risque Litigation (20%) ─────────────────────────────────
  let litigationScore = 100
  if (!mission.has_photos || mission.photos_count < 5) {
    litigationScore -= 30
    anomalies.push({
      id: 'photos-insufficient',
      title: 'Photos insuffisantes',
      description: `Seulement ${mission.photos_count} photo${mission.photos_count > 1 ? 's' : ''} prise${mission.photos_count > 1 ? 's' : ''}. En cas de litige, plus de photos = meilleure défense.`,
      suggested_action:
        "Prendre au moins 5-10 photos clés (vue d'ensemble, équipements, étiquettes, défauts).",
      severity: 'warning',
      auto_fixable: false,
    })
  }
  if (!mission.has_reserves_mentioned && mission.diagnostic_type !== 'CARREZ') {
    litigationScore -= 10
    opportunities.push({
      id: 'add-reserves',
      title: 'Mentionner les réserves',
      estimated_gain: 'Couverture juridique +15%',
      action: 'Documenter les zones non accessibles ou non visitables.',
    })
  }

  // ─── Score Complétude (20%) ────────────────────────────────────────
  const completudeScore =
    mission.required_fields_total > 0
      ? Math.round((mission.required_fields_filled / mission.required_fields_total) * 100)
      : 100

  if (completudeScore < 80) {
    anomalies.push({
      id: 'completude-low',
      title: 'Champs obligatoires manquants',
      description: `${mission.required_fields_filled}/${mission.required_fields_total} champs remplis (${completudeScore}%).`,
      suggested_action: 'Compléter les champs manquants avant export.',
      severity: completudeScore < 60 ? 'warning' : 'info',
      auto_fixable: false,
    })
  }

  // ─── Score global pondéré ──────────────────────────────────────────
  const globalScore = Math.round(
    coherenceScore * 0.3 + ademeScore * 0.3 + litigationScore * 0.2 + completudeScore * 0.2,
  )

  // ─── Opportunités basées sur profil ────────────────────────────────
  if (profile.dpe_history.length === 0 && mission.diagnostic_type === 'DPE') {
    opportunities.push({
      id: 'first-dpe',
      title: 'Premier DPE sur ce bien',
      estimated_gain: 'Aucun risque de contrôle ADEME pour écart historique',
      action: 'Profitez-en pour documenter exhaustivement.',
    })
  }
  if (profile.erp_risks.naturels.length > 0 && mission.diagnostic_type === 'ERP') {
    opportunities.push({
      id: 'erp-aligned',
      title: 'Risques ERP officiels disponibles',
      estimated_gain: 'Source Géorisques pré-renseignée',
      action: 'Vérifier que votre ERP intègre les risques détectés automatiquement.',
    })
  }

  return {
    global_score: globalScore,
    breakdown: {
      coherence: coherenceScore,
      ademe_risk: ademeScore,
      litigation_risk: litigationScore,
      completude: completudeScore,
    },
    anomalies: anomalies.slice(0, MAX_ANOMALIES),
    opportunities: opportunities.slice(0, MAX_OPPORTUNITIES),
  }
}
