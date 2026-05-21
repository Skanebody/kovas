/**
 * KOVAS — Module 2 (Standardisation IA) — Types des suggestions de paramètres.
 *
 * Types partagés entre Edge Function `parameter-suggest` et helpers UI/Web.
 * Aucun import Deno : ce module est consommable côté Node et Edge.
 */

// ============================================================
// Noms de paramètres supportés en V1 (extensible).
// ============================================================
//
// Convention : nom du champ tel qu'il est manipulé côté UI / table métier.
// Chaque paramètre a un domaine de valeurs documenté dans `static-rules.ts`.

export type ParameterName =
  | 'type_ventilation' // VMC SF / VMC DF / hygro A / hygro B / VHN
  | 'type_chauffage' // électrique / gaz / fioul / PAC / bois / réseau
  | 'type_ecs' // chauffe-eau électrique / gaz / thermo / solaire / chaudière mixte
  | 'type_isolation_murs' // ITE / ITI / vide d'air / non isolé
  | 'type_isolation_toiture' // combles perdus / sous rampants / toiture-terrasse
  | 'type_menuiseries' // simple / double / triple vitrage
  | 'type_climatisation' // aucune / split / multi-split / centralisée

// ============================================================
// Contexte d'inférence — features utilisées pour la prédiction.
// ============================================================

export interface SuggestionContext {
  /** Année de construction du bien (utilisée pour matcher règles statiques). */
  yearBuilt?: number
  /** Surface habitable m² (matching ADEME ± 20%). */
  surface?: number
  /** Code INSEE de la commune (sert à dériver la région). */
  inseeCode?: string
  /** Code postal (fallback si insee absent). */
  postalCode?: string
  /** maison | appartement | immeuble. */
  buildingType?: 'maison' | 'appartement' | 'immeuble' | string
  /** Étiquette DPE existante (rénovation). */
  etiquetteDpe?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  /** Nombre d'étages (immeuble). */
  floors?: number
  /** Champs métier complémentaires (extensible). */
  [key: string]: string | number | boolean | null | undefined
}

export interface SuggestionInput {
  parameterName: ParameterName
  context: SuggestionContext
  /** UUID organisation appelante (RLS + audit). */
  organizationId: string
  /** UUID mission optionnel (lien d'audit). */
  missionId?: string
  /** UUID user appelant (audit). */
  userId?: string
}

// ============================================================
// Sortie — suggestion + alternatives + justification.
// ============================================================

export interface SuggestionAlternative {
  value: string
  probability: number // 0-1
  count: number
}

export interface ReglementaryReference {
  /** Référence textuelle (arrêté, NF DTU, fiche Cerema). */
  label: string
  /** URL source canonique (Légifrance, Cerema, ADEME). */
  url: string
  /** Date publication (ISO). */
  publishedAt?: string
}

export type SuggestionSource = 'ademe_statistics' | 'static_rule' | 'no_data'

export interface SuggestionOutput {
  parameterName: ParameterName
  suggestedValue: string
  /** Score de confiance 0-1 (proba modale ou pondération règle). */
  confidenceScore: number
  alternatives: SuggestionAlternative[]
  justification: string
  reglementaryReferences: ReglementaryReference[]
  similarCasesCount: number
  source: SuggestionSource
  /** Identifiant de cache (signature contexte). */
  cacheKey: string
  /** Timestamp ISO génération. */
  computedAt: string
}
