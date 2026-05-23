/**
 * KOVAS — Scorer E-E-A-T méthode Amandine Bart.
 *
 * Évalue automatiquement un article Markdown selon les 4 axes Google Quality
 * Rater Guidelines (Experience, Expertise, Authoritativeness, Trustworthiness)
 * sur 0-100 pour fournir un pré-scoring à l'admin reviewer.
 *
 * Heuristiques :
 *  - Experience : présence d'exemples chiffrés, dates précises, retours terrain
 *  - Expertise  : densité termes techniques métier (DPE, GES, COFRAC, etc.)
 *  - Authoritativeness : citations sources officielles (Légifrance, ADEME, INSEE)
 *  - Trustworthiness : disclaimers, dates de mise à jour, liens externes credibles
 *
 * Les scores sont des indicateurs — l'admin reviewer reste juge final.
 */

const OFFICIAL_SOURCES = [
  'légifrance',
  'legifrance',
  'ademe',
  'insee',
  'observatoire-dpe',
  'georisques',
  'géorisques',
  'cofrac',
  'qualigaz',
  'consuel',
  'maprimerenov',
  'ministère',
  'arrêté',
  'arrete',
  'décret',
  'decret',
  'circulaire',
  'jurisprudence',
  'cour de cassation',
  "conseil d'état",
  "conseil d'état",
] as const

const TECHNICAL_TERMS = [
  'DPE',
  '3CL',
  'RE2020',
  'COFRAC',
  'GES',
  'kWh/m²',
  'kWh/m2',
  'CO2',
  'CO₂',
  'classe énergétique',
  'amiante',
  'plomb',
  'CREP',
  'termites',
  'Carrez',
  'Boutin',
  'ERP',
  'audit énergétique',
  'rénovation',
  'isolation',
  'chaudière',
  'pompe à chaleur',
  'VMC',
  'enveloppe thermique',
  'pont thermique',
  'shab',
  'surface habitable',
  'plancher haut',
  'plancher bas',
  'baie vitrée',
  'menuiserie',
  'PPT',
  'DTA',
  'PEMD',
  'NF X46-020',
] as const

const EXPERIENCE_MARKERS = [
  'en pratique',
  'sur le terrain',
  'notre expérience',
  'concrètement',
  'exemple',
  'cas concret',
  "à titre d'exemple",
  'illustration',
  "retour d'expérience",
  'observé',
  'constaté',
] as const

const TRUST_MARKERS = [
  'mise à jour',
  'dernière révision',
  'à jour au',
  'attention',
  'avertissement',
  'cet article ne remplace pas',
  'cas par cas',
  'auprès de',
  'consultation',
] as const

const YEAR_PATTERN = /\b(19|20)\d{2}\b/g
const PERCENTAGE_PATTERN = /\d+([.,]\d+)?\s*%/g
const CURRENCY_PATTERN = /\d+([.,\s]\d+)*\s*€/g
const URL_PATTERN = /https?:\/\/[^\s)]+/g

function countOccurrences(text: string, needles: ReadonlyArray<string>): number {
  const lower = text.toLowerCase()
  let count = 0
  for (const needle of needles) {
    const escaped = needle.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matches = lower.match(new RegExp(escaped, 'g'))
    if (matches) count += matches.length
  }
  return count
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export interface EeatScoreResult {
  readonly experience: number
  readonly expertise: number
  readonly authoritativeness: number
  readonly trustworthiness: number
  readonly composite: number
  readonly diagnostics: {
    readonly officialSourceCount: number
    readonly technicalTermCount: number
    readonly yearMentionCount: number
    readonly percentageCount: number
    readonly currencyCount: number
    readonly externalLinkCount: number
    readonly experienceMarkerCount: number
    readonly trustMarkerCount: number
  }
}

export function scoreEeat(markdown: string): EeatScoreResult {
  if (!markdown || markdown.length < 50) {
    return {
      experience: 0,
      expertise: 0,
      authoritativeness: 0,
      trustworthiness: 0,
      composite: 0,
      diagnostics: {
        officialSourceCount: 0,
        technicalTermCount: 0,
        yearMentionCount: 0,
        percentageCount: 0,
        currencyCount: 0,
        externalLinkCount: 0,
        experienceMarkerCount: 0,
        trustMarkerCount: 0,
      },
    }
  }

  const officialSourceCount = countOccurrences(markdown, OFFICIAL_SOURCES)
  const technicalTermCount = countOccurrences(markdown, TECHNICAL_TERMS)
  const yearMatches = markdown.match(YEAR_PATTERN)
  const percentageMatches = markdown.match(PERCENTAGE_PATTERN)
  const currencyMatches = markdown.match(CURRENCY_PATTERN)
  const urlMatches = markdown.match(URL_PATTERN)
  const experienceMarkerCount = countOccurrences(markdown, EXPERIENCE_MARKERS)
  const trustMarkerCount = countOccurrences(markdown, TRUST_MARKERS)

  const yearMentionCount = yearMatches?.length ?? 0
  const percentageCount = percentageMatches?.length ?? 0
  const currencyCount = currencyMatches?.length ?? 0
  const externalLinkCount = urlMatches?.length ?? 0

  // Experience : exemples concrets + chiffres tangibles + retours terrain
  const experience = clampScore(
    experienceMarkerCount * 10 +
      percentageCount * 4 +
      currencyCount * 4 +
      yearMentionCount * 3,
  )

  // Expertise : densité jargon métier (1 point par occurrence, plafonné)
  const expertise = clampScore(technicalTermCount * 3.5)

  // Authoritativeness : citations sources officielles + liens externes
  const authoritativeness = clampScore(
    officialSourceCount * 8 + externalLinkCount * 5,
  )

  // Trustworthiness : disclaimers, dates de mise à jour, indications de doute
  const trustworthiness = clampScore(
    trustMarkerCount * 12 +
      (markdown.toLowerCase().includes('mise à jour') ? 20 : 0) +
      (externalLinkCount >= 3 ? 15 : externalLinkCount * 5),
  )

  const composite = Math.round(
    (experience + expertise + authoritativeness + trustworthiness) / 4,
  )

  return {
    experience,
    expertise,
    authoritativeness,
    trustworthiness,
    composite,
    diagnostics: {
      officialSourceCount,
      technicalTermCount,
      yearMentionCount,
      percentageCount,
      currencyCount,
      externalLinkCount,
      experienceMarkerCount,
      trustMarkerCount,
    },
  }
}

export interface ArticleStructure {
  readonly wordCount: number
  readonly h2Count: number
  readonly h3Count: number
  readonly faqQuestionCount: number
  readonly internalLinkCount: number
  readonly externalLinkCount: number
  readonly hasFaqSection: boolean
  readonly hasTableOfContents: boolean
  readonly hasUpdateDate: boolean
}

const INTERNAL_LINK_PATTERN = /\[[^\]]+\]\((\/[^)]+)\)/g
const EXTERNAL_LINK_PATTERN = /\[[^\]]+\]\((https?:\/\/[^)]+)\)/g
const H2_PATTERN = /^##\s+.+$/gm
const H3_PATTERN = /^###\s+.+$/gm

export function analyzeStructure(markdown: string): ArticleStructure {
  const wordCount = markdown
    .replace(/[#*_`>\[\]()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1).length

  const internalLinkCount = [...markdown.matchAll(INTERNAL_LINK_PATTERN)].length
  const externalLinkCount = [...markdown.matchAll(EXTERNAL_LINK_PATTERN)].length

  const h2Count = [...markdown.matchAll(H2_PATTERN)].length
  const h3Count = [...markdown.matchAll(H3_PATTERN)].length

  // FAQ : compte des "## Question..." ou "**Question..."
  const faqSection = markdown.toLowerCase().includes('questions fréquentes')
    || markdown.toLowerCase().includes('faq')
  const faqQuestionCount = faqSection
    ? (markdown.match(/^\*\*[QQ][^*]+\?\*\*$/gm)?.length
        ?? markdown.match(/^###?\s+.+\?$/gm)?.length
        ?? 0)
    : 0

  return {
    wordCount,
    h2Count,
    h3Count,
    faqQuestionCount,
    internalLinkCount,
    externalLinkCount,
    hasFaqSection: faqSection,
    hasTableOfContents:
      markdown.toLowerCase().includes('sommaire')
      || markdown.toLowerCase().includes('table des matières'),
    hasUpdateDate:
      markdown.toLowerCase().includes('mise à jour')
      || markdown.toLowerCase().includes('dernière révision'),
  }
}
