/**
 * KOVAS — Algo A1.3.2 — Cohérence cadastre vs surface déclarée.
 *
 * Détecte écarts entre surface bâtie cadastrale officielle (IGN) et surface
 * déclarée dans la mission. Si > 15% → alerte info. > 25% → alerte recheck.
 *
 * Ton aidant, jamais bloquant.
 * Authority : REFONTE-ACQUI-TARGET-V2 chapitre 9.2.
 */

import type { PropertyUnifiedProfile } from '@/lib/property/unified-profile'

export interface CadastreCoherenceResult {
  cadastre_surface_m2: number | null
  declared_surface_m2: number
  gap_pct: number | null
  alert: boolean
  alert_level: 'none' | 'info' | 'warning'
  suggested_action: string | null
}

export function checkCadastreCoherence(
  profile: PropertyUnifiedProfile,
  declaredSurfaceM2: number,
): CadastreCoherenceResult {
  const cadastre = profile.parcelle?.surface_bati_m2 ?? null

  if (!cadastre || declaredSurfaceM2 <= 0) {
    return {
      cadastre_surface_m2: cadastre,
      declared_surface_m2: declaredSurfaceM2,
      gap_pct: null,
      alert: false,
      alert_level: 'none',
      suggested_action: null,
    }
  }

  const gapPct = Math.abs(cadastre - declaredSurfaceM2) / cadastre

  if (gapPct >= 0.25) {
    return {
      cadastre_surface_m2: cadastre,
      declared_surface_m2: declaredSurfaceM2,
      gap_pct: Math.round(gapPct * 100) / 100,
      alert: true,
      alert_level: 'warning',
      suggested_action: `Surface déclarée ${declaredSurfaceM2}m² vs cadastre ${cadastre}m² (écart ${Math.round(gapPct * 100)}%). Vérifiez votre mesure ou justifiez les annexes non cadastrées (combles aménagés, dépendances, etc.).`,
    }
  }

  if (gapPct >= 0.15) {
    return {
      cadastre_surface_m2: cadastre,
      declared_surface_m2: declaredSurfaceM2,
      gap_pct: Math.round(gapPct * 100) / 100,
      alert: true,
      alert_level: 'info',
      suggested_action: `Écart de ${Math.round(gapPct * 100)}% avec le cadastre (${cadastre}m²). Si vous incluez des annexes, mentionnez-le dans le diagnostic.`,
    }
  }

  return {
    cadastre_surface_m2: cadastre,
    declared_surface_m2: declaredSurfaceM2,
    gap_pct: Math.round(gapPct * 100) / 100,
    alert: false,
    alert_level: 'none',
    suggested_action: null,
  }
}
