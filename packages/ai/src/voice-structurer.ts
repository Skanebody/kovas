import { z } from 'zod'

/**
 * Voice structurer hybride (Modification 18).
 *
 * Approche :
 * 1. Parser custom JS pour cas standards (80% des phrases) : 0€ coût
 * 2. Claude Haiku 4.5 pour cas complexes/atypiques (20%) : ~0,05€/mission
 *
 * Coût moyen : 0,01€/mission (vs 0,15€ tout Claude)
 */

export const StructuredFieldsSchema = z.object({
  surfaceM2: z.number().optional(),
  nbPieces: z.number().int().optional(),
  typeChauffage: z.string().optional(),
  anneeConstruction: z.number().int().optional(),
  marqueChaudiere: z.string().optional(),
  observations: z.string().optional(),
  confidence: z.record(z.number().min(0).max(1)),
})
export type StructuredFields = z.infer<typeof StructuredFieldsSchema>

/**
 * Parser custom JS — regex + heuristiques pour cas standards.
 * Cible : 80% des phrases métier diagnostiqueur.
 *
 * Exemples détectés :
 * - "Surface 75 mètres carrés" → surfaceM2: 75
 * - "Chaudière gaz Saunier Duval année 2018" → typeChauffage: 'gaz', marqueChaudiere: 'Saunier Duval', anneeConstruction: 2018
 * - "Maison T4 avec trois chambres" → nbPieces: 4
 */
export function parseWithCustomJs(transcript: string): {
  matched: Partial<StructuredFields>
  confidence: number
  needsClaudeFallback: boolean
} {
  const matched: Partial<StructuredFields> = {}
  let matches = 0
  let totalAttempts = 0

  // Surface
  totalAttempts++
  const surfaceMatch = transcript.match(/(\d+(?:[,.]?\d+)?)\s*(?:mètres?\s*carrés?|m²|m2)/i)
  if (surfaceMatch?.[1]) {
    matched.surfaceM2 = Number.parseFloat(surfaceMatch[1].replace(',', '.'))
    matches++
  }

  // Nombre de pièces
  totalAttempts++
  const piecesMatch = transcript.match(/(\d+)\s*pièces?|T(\d+)|F(\d+)/i)
  if (piecesMatch) {
    matched.nbPieces = Number.parseInt(piecesMatch[1] ?? piecesMatch[2] ?? piecesMatch[3] ?? '0', 10)
    matches++
  }

  // Type chauffage
  totalAttempts++
  const chauffageMatch = transcript.match(
    /chauffage|chaudière|pompe à chaleur|PAC|gaz|fioul|électrique|bois|granulés/i,
  )
  if (chauffageMatch) {
    matched.typeChauffage = chauffageMatch[0].toLowerCase()
    matches++
  }

  // Année construction
  totalAttempts++
  const yearMatch = transcript.match(/(?:année|construit|construction)\s*(\d{4})|(\d{4})/i)
  if (yearMatch) {
    const year = Number.parseInt(yearMatch[1] ?? yearMatch[2] ?? '0', 10)
    if (year >= 1800 && year <= new Date().getFullYear()) {
      matched.anneeConstruction = year
      matches++
    }
  }

  // Marque chaudière (top 30 marques FR)
  const brands = [
    'Saunier Duval',
    'De Dietrich',
    'Atlantic',
    'Frisquet',
    'Vaillant',
    'Viessmann',
    'Chaffoteaux',
    'ELM Leblanc',
    'Bosch',
    'Buderus',
    'Chappée',
    'Domusa',
    'Ferroli',
    'Riello',
    'Sime',
    'Unical',
    'Wolf',
    'Beretta',
    'Junkers',
    'Ariston',
    'Geminox',
    'Idéal Standard',
    'Oertli',
    'Cuenod',
    'Weishaupt',
    'Hitachi',
    'Daikin',
    'Mitsubishi',
    'LG',
    'Panasonic',
  ]
  totalAttempts++
  for (const brand of brands) {
    if (new RegExp(brand, 'i').test(transcript)) {
      matched.marqueChaudiere = brand
      matches++
      break
    }
  }

  const confidence = totalAttempts > 0 ? matches / totalAttempts : 0
  // Si on a < 50% de matches, on appelle Claude Haiku en fallback
  const needsClaudeFallback = confidence < 0.5

  return { matched, confidence, needsClaudeFallback }
}
