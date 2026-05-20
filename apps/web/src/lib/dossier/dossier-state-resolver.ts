/**
 * KOVAS — Résolveur d'état visuel d'un dossier (refonte page dossier).
 *
 * Authority : CLAUDE.md §3 (workflow dossier) + refonte UI dossier.
 *
 * Mapping :
 *  - 'to-start'    : pas encore démarré (aucune session terrain)
 *  - 'in-progress' : démarré, pas validé OU validé mais jamais exporté
 *  - 'completed'   : validé ET exporté au moins une fois
 *
 * L'état est calculé à partir de 3 colonnes ajoutées sur `dossiers` :
 *  - mission_started_at : 1er démarrage de mission terrain
 *  - validated_at       : validation manuelle avant export
 *  - exported_count     : nombre d'exports déclenchés
 */

export type DossierVisualState = 'to-start' | 'in-progress' | 'completed'

export interface DossierStateInput {
  mission_started_at: string | null
  validated_at: string | null
  exported_count: number
}

/**
 * Calcule l'état visuel d'un dossier (résolveur pur, déterministe).
 *
 * @param dossier - les 3 colonnes pertinentes du dossier
 * @returns l'état visuel pour piloter l'UI (badge, couleur, CTAs)
 */
export function resolveDossierState(dossier: DossierStateInput): DossierVisualState {
  if (!dossier.mission_started_at) return 'to-start'
  if (dossier.validated_at && dossier.exported_count > 0) return 'completed'
  return 'in-progress'
}

/**
 * Labels FR pour les états (utile pour badges UI).
 * Vocabulaire SOBRE PROFESSIONNEL (CLAUDE.md §21bis avatar client).
 */
export const DOSSIER_STATE_LABEL: Record<DossierVisualState, string> = {
  'to-start': 'À démarrer',
  'in-progress': 'En cours',
  completed: 'Terminé',
}
