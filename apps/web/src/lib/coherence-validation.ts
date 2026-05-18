/**
 * Validation de cohérence métier — feature 7 des 10 MVP.
 * Cf. CLAUDE.md §3 — "Maison 1850 + étiquette A = à vérifier"
 *
 * Règles simples (pas d'IA) qui détectent les incohérences évidentes avant l'export.
 * Affichées comme warnings non bloquants dans la check-list.
 */

import type { VoiceParsedData } from './voice-parser'

export interface CoherenceWarning {
  id: string
  severity: 'info' | 'warning' | 'error'
  category: 'surface' | 'energy' | 'equipment' | 'date'
  message: string
}

export interface CoherenceContext {
  property: {
    surface_total: number | null
    year_built: number | null
    property_type: string | null
    energy_class?: string | null
  }
  voiceNotes: Pick<VoiceParsedData, 'surface_m2' | 'year_built' | 'equipment'>[]
}

export function runCoherenceChecks(ctx: CoherenceContext): CoherenceWarning[] {
  const warnings: CoherenceWarning[] = []

  // === Règle 1 : Surface trop faible / trop grande ===
  if (ctx.property.surface_total !== null) {
    const s = ctx.property.surface_total
    if (s < 8) {
      warnings.push({
        id: 'surface_too_low',
        severity: 'warning',
        category: 'surface',
        message: `Surface ${s} m² très faible — vérifier (mesure prise correctement ?).`,
      })
    } else if (s > 1000 && ctx.property.property_type !== 'immeuble') {
      warnings.push({
        id: 'surface_too_high',
        severity: 'warning',
        category: 'surface',
        message: `Surface ${s} m² atypique pour un logement individuel — confirmer.`,
      })
    }
  }

  // === Règle 2 : Surface DB vs surface mentionnée vocalement ===
  const voiceSurfaces = ctx.voiceNotes
    .map((v) => v.surface_m2)
    .filter((s): s is number => typeof s === 'number')

  if (ctx.property.surface_total && voiceSurfaces.length > 0) {
    const totalVoice = voiceSurfaces.reduce((a, b) => a + b, 0)
    const dbSurface = ctx.property.surface_total
    const ratio = totalVoice / dbSurface
    if (ratio > 1.5 || ratio < 0.5) {
      warnings.push({
        id: 'surface_db_voice_mismatch',
        severity: 'warning',
        category: 'surface',
        message: `Surface bien (${dbSurface} m²) ≠ somme surfaces pièces mentionnées (~${totalVoice.toFixed(0)} m²). Vérifier.`,
      })
    }
  }

  // === Règle 3 : Année construction vs classe énergie ===
  const year = ctx.property.year_built
  const energyClass = ctx.property.energy_class
  if (year !== null && energyClass) {
    // Maison < 1948 + classe A/B = très improbable sans rénovation lourde
    if (year < 1948 && (energyClass === 'A' || energyClass === 'B')) {
      warnings.push({
        id: 'old_house_high_class',
        severity: 'warning',
        category: 'energy',
        message: `Bâtiment ${year} + étiquette ${energyClass} : à vérifier (rénovation lourde nécessaire pour cette classe sur ce bâti).`,
      })
    }
    // Bâtiment > 2012 + classe F/G = théoriquement impossible (RT2012)
    if (year >= 2012 && (energyClass === 'F' || energyClass === 'G')) {
      warnings.push({
        id: 'recent_low_class',
        severity: 'error',
        category: 'energy',
        message: `Bâtiment ${year} (RT2012/RE2020) + étiquette ${energyClass} : incohérent réglementairement.`,
      })
    }
  }

  // === Règle 4 : Équipement chauffage manquant ===
  const hasHeatingMention = ctx.voiceNotes.some((v) =>
    v.equipment.some(
      (e) => e.kind === 'chaudiere' || e.kind === 'pac' || e.kind === 'radiateur',
    ),
  )
  if (ctx.voiceNotes.length >= 2 && !hasHeatingMention) {
    warnings.push({
      id: 'no_heating_detected',
      severity: 'info',
      category: 'equipment',
      message:
        'Aucun système de chauffage détecté dans les notes vocales — pensez à le renseigner.',
    })
  }

  // === Règle 5 : Date construction future ou trop ancienne ===
  if (year !== null) {
    const currentYear = new Date().getFullYear()
    if (year > currentYear) {
      warnings.push({
        id: 'year_future',
        severity: 'error',
        category: 'date',
        message: `Année ${year} dans le futur — corriger.`,
      })
    }
    if (year < 1700) {
      warnings.push({
        id: 'year_too_old',
        severity: 'warning',
        category: 'date',
        message: `Année ${year} très ancienne — confirmer ou estimer une période plus large.`,
      })
    }
  }

  return warnings
}
