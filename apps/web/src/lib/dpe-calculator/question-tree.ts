/**
 * KOVAS — Calculateur DPE gratuit (Lot #143)
 *
 * Définition des 8 questions séquentielles posées au prospect particulier
 * sur la page publique `/calculateur-dpe-gratuit`.
 *
 * Le calcul d'estimation se fait 100% côté client (transparent, RGPD-friendly,
 * zero appel API tant que le prospect n'a pas saisi ses coordonnées en fin
 * de parcours).
 *
 * Avatar visé : particulier propriétaire / locataire, NON-expert. Vocabulaire
 * SOBRE et précis (vouvoiement, jamais de jargon).
 */

export type PropertyType = 'maison' | 'appartement'

export type YearBucket =
  | 'before_1948'
  | '1948_1974'
  | '1975_1989'
  | '1990_2000'
  | '2001_2012'
  | '2013_2020'
  | 'after_2020'

export type HeatingType =
  | 'gaz'
  | 'fioul'
  | 'electricite'
  | 'pompe_chaleur'
  | 'bois'
  | 'reseau_chaleur'
  | 'autre'

export type IsolationLevel = 'tres_bonne' | 'bonne' | 'moyenne' | 'mauvaise' | 'inconnue'

export type OccupationMode = 'residence_principale' | 'residence_secondaire' | 'vacant' | 'locatif'

export type ProjectContext = 'vente' | 'location' | 'renovation' | 'curiosite'

export type DpeClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export type ExistingDpe =
  | { known: false; value: null }
  | { known: true; value: DpeClass | null }
  // l'utilisateur a un DPE mais ne se souvient pas de la classe → on traite comme inconnu
  | { known: 'unsure'; value: null }

/**
 * Réponses cumulées au fil du stepper. Toutes les clés sont nullable
 * jusqu'à la fin du parcours.
 */
export interface CalculatorAnswers {
  property_type: PropertyType | null
  surface_m2: number | null
  year_bucket: YearBucket | null
  existing_dpe: ExistingDpe | null
  heating: HeatingType | null
  isolation: IsolationLevel | null
  occupation: OccupationMode | null
  context: ProjectContext[] | null
}

export const QUESTION_ORDER = [
  'property_type',
  'surface_m2',
  'year_bucket',
  'existing_dpe',
  'heating',
  'isolation',
  'occupation',
  'context',
] as const satisfies ReadonlyArray<keyof CalculatorAnswers>

export type QuestionKey = (typeof QUESTION_ORDER)[number]

export const TOTAL_QUESTIONS = QUESTION_ORDER.length

/**
 * Helpers d'affichage — chaînes UI prêtes pour le stepper (vouvoiement sobre).
 */
export const YEAR_BUCKET_LABEL: Record<YearBucket, string> = {
  before_1948: 'Avant 1948',
  '1948_1974': '1948 – 1974',
  '1975_1989': '1975 – 1989',
  '1990_2000': '1990 – 2000',
  '2001_2012': '2001 – 2012',
  '2013_2020': '2013 – 2020',
  after_2020: 'Après 2020',
}

export const HEATING_LABEL: Record<HeatingType, string> = {
  gaz: 'Gaz',
  fioul: 'Fioul',
  electricite: 'Électricité',
  pompe_chaleur: 'Pompe à chaleur',
  bois: 'Bois / granulés',
  reseau_chaleur: 'Réseau de chaleur',
  autre: 'Autre',
}

export const ISOLATION_LABEL: Record<IsolationLevel, string> = {
  tres_bonne: 'Très bonne',
  bonne: 'Bonne',
  moyenne: 'Moyenne',
  mauvaise: 'Mauvaise',
  inconnue: 'Je ne sais pas',
}

export const OCCUPATION_LABEL: Record<OccupationMode, string> = {
  residence_principale: 'Résidence principale',
  residence_secondaire: 'Résidence secondaire',
  vacant: 'Vacant',
  locatif: 'Bien locatif',
}

export const CONTEXT_LABEL: Record<ProjectContext, string> = {
  vente: 'Je vends',
  location: 'Je loue',
  renovation: 'Je rénove',
  curiosite: 'Par curiosité',
}

/**
 * Brouillon vide pour initialiser le formulaire.
 */
export function createEmptyAnswers(): CalculatorAnswers {
  return {
    property_type: null,
    surface_m2: null,
    year_bucket: null,
    existing_dpe: null,
    heating: null,
    isolation: null,
    occupation: null,
    context: null,
  }
}

/**
 * Validation d'une étape — retourne true si la question courante a une
 * réponse exploitable et que l'utilisateur peut passer à la suivante.
 */
export function isAnswerComplete(key: QuestionKey, answers: CalculatorAnswers): boolean {
  switch (key) {
    case 'property_type':
      return answers.property_type !== null
    case 'surface_m2':
      return (
        typeof answers.surface_m2 === 'number' &&
        answers.surface_m2 >= 8 &&
        answers.surface_m2 <= 1000
      )
    case 'year_bucket':
      return answers.year_bucket !== null
    case 'existing_dpe':
      return answers.existing_dpe !== null
    case 'heating':
      return answers.heating !== null
    case 'isolation':
      return answers.isolation !== null
    case 'occupation':
      return answers.occupation !== null
    case 'context':
      return Array.isArray(answers.context) && answers.context.length > 0
  }
}

/**
 * Indique si toutes les réponses sont complètes (prêt à calculer).
 */
export function areAllAnswersComplete(answers: CalculatorAnswers): boolean {
  return QUESTION_ORDER.every((key) => isAnswerComplete(key, answers))
}
