/**
 * Types publics du wrapper Mes Aides Réno (France Rénov').
 *
 * Source : https://mesaidesreno.beta.gouv.fr/ (publi.codes).
 * L'API publique en bêta n'a pas (encore) de schéma officiellement gelé ;
 * on encapsule donc nos propres entrées/sorties stables et on map en interne
 * vers ce que retourne l'API au moment du fetch.
 */

export type DpeClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export type LogementType = 'maison' | 'appartement'

export type Occupation = 'proprietaire_occupant' | 'proprietaire_bailleur' | 'syndic'

/**
 * Entrée du calcul simulation Mes Aides Réno.
 * Tous les champs marqués obligatoires sont nécessaires pour le calcul.
 */
export interface AideInput {
  /** Surface habitable du logement en m². */
  surface_m2: number
  /** Année de construction du logement (4 chiffres). */
  annee_construction: number
  /** Classe DPE actuelle (avant rénovation). */
  dpe_actuel: DpeClass
  /** Classe DPE projetée après rénovation. */
  dpe_projete: DpeClass
  /** Revenu fiscal de référence annuel. Si omis, valeur médiane FR utilisée. */
  revenu_fiscal_reference?: number
  /** Code postal (5 chiffres) du bien. */
  code_postal: string
  /** Type de logement. */
  type_logement: LogementType
  /** Statut d'occupation du demandeur. */
  occupation: Occupation
}

/**
 * Code d'aide normalisé KOVAS.
 * On agrège les retours bruts de l'API sous ces 5 grandes catégories
 * pour rendre l'affichage côté annexe PDF stable.
 */
export type AideCode = 'mpr' | 'cee' | 'eco_ptz' | 'tva_5_5' | 'aide_locale'

export interface AideResult {
  /** Code stable côté KOVAS. */
  code: AideCode
  /** Libellé long affichable. */
  label: string
  /** Estimation en euros (entier, arrondi). */
  montant_eur: number
  /** Conditions principales à vérifier (3-5 lignes max). */
  conditions: string[]
  /** Lien officiel pour le client (page d'info ou simulateur). */
  source_url: string
}

/**
 * Erreur typée renvoyée par le client en cas d'échec définitif.
 */
export class MesAidesRenoError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'MesAidesRenoError'
  }
}
