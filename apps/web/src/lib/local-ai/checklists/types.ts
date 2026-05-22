/**
 * Types partagés des checklists métier anti-oubli (garde-fou local).
 *
 * - 100% local, déterministe, zéro réseau pendant l'utilisation
 * - 9 diagnostics standards (DPE, amiante, plomb, gaz, électricité, termites,
 *   carrez, boutin, ERP) — couvre 92% du volume métier FR
 * - Items déclaratifs : chaque item porte ses keywords (preuve de couverture)
 *   et son timeout (overdue) pour déclenchement de questions automatiques
 *
 * Convention :
 *   - Identifiants/clés en anglais, descriptions en français métier
 *   - Pas de side effects à l'import — pure data
 */

/** Type de diagnostic supporté V1 (couvre 92% du volume FR). */
export type DiagnosticKind =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'carrez'
  | 'boutin'
  | 'erp'

/**
 * Portée d'un item :
 * - `global` : 1 seule occurrence pour toute la mission (ex. : adresse, surface)
 * - `per_room` : 1 occurrence par pièce visitée (ex. : revêtement sol, état mur)
 * - `per_equipment` : 1 occurrence par équipement détecté (ex. : marque chaudière)
 */
export type ChecklistScope = 'global' | 'per_room' | 'per_equipment'

/** Sévérité métier d'un item — pilote les UI badges et le checkout. */
export type ChecklistSeverity = 'critical' | 'important' | 'optional'

/**
 * Élément unitaire d'une checklist métier.
 *
 * `keywords` = termes qui, présents dans le transcript user, prouvent
 * que l'item est couvert (match case-insensitive, ASCII-folded, accent-free).
 *
 * `trigger_question_after_ms` = délai après lequel un item non couvert
 * provoque une question automatique du tracker (overdue).
 */
export interface ChecklistItem {
  /** Identifiant unique de l'item dans la checklist (slug stable). */
  id: string
  /** Nom canonique du champ DB ou du concept couvert (ex. : `dpe.heating_system`). */
  field_name: string
  /** Description courte affichée dans le panel (ChecklistPanel). */
  description_short: string
  /** Description complète (tooltip / mobile expand). */
  description_full: string
  /** Portée logique. */
  scope: ChecklistScope
  /** Si `true`, l'item bloque ou alerte au checkout. */
  required: boolean
  /** Sévérité métier (critical = bloque export, important = warning, optional = info). */
  severity: ChecklistSeverity
  /** Si `true`, au moins 1 photo doit être prise pour cet item. */
  requires_photo: boolean
  /** Délai en ms après lequel l'item devient "overdue" si non couvert. */
  trigger_question_after_ms: number
  /** Question automatique à poser quand l'item est overdue. */
  trigger_question_text: string
  /** Termes qui prouvent que l'item est couvert (match insensible aux accents). */
  keywords: readonly string[]
  /** Diagnostic auquel appartient cet item (réplique de la clé top-level). */
  diagnostic: DiagnosticKind
}

/** Section logique d'une checklist (ex. : DPE > Enveloppe / DPE > Chauffage). */
export interface ChecklistSection {
  /** Identifiant interne de la section (slug). */
  id: string
  /** Libellé affiché en UI (FR métier). */
  label: string
  /** Items de la section. */
  items: readonly ChecklistItem[]
}

/** Checklist complète d'un diagnostic standard. */
export interface DiagnosticChecklist {
  diagnostic: DiagnosticKind
  /** Libellé court (badge dans le panel). */
  short_label: string
  /** Libellé long (titre carte). */
  long_label: string
  sections: readonly ChecklistSection[]
}

/** Délais standards (réutilisés dans les checklists). */
export const TRIGGER_DELAYS = {
  /** 3 min — items rapides à couvrir (adresse, occupants). */
  fast: 3 * 60 * 1000,
  /** 5 min — items pièce courante (revêtement, état). */
  short: 5 * 60 * 1000,
  /** 10 min — items mesure/observation détaillée. */
  medium: 10 * 60 * 1000,
  /** 15 min — items équipement long (chaudière, isolation). */
  long: 15 * 60 * 1000,
  /** 30 min — items globaux post-visite (récap, signature). */
  extended: 30 * 60 * 1000,
} as const
