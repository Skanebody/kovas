/**
 * KOVAS — Document Intelligence : extracteur plaque chaudière.
 *
 * Modèle : claude-sonnet-4-6 (précision lecture plaque signalétique).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type ChaudiereExtraction,
  ChaudiereExtractionSchema,
} from '../extraction-schemas/chaudiere-schema'
import { type ExtractorResult, runExtractor } from './extractor-base'

const CHAUDIERE_MODEL = process.env.ANTHROPIC_EXTRACTION_MODEL ?? 'claude-sonnet-4-6'

const CHAUDIERE_SYSTEM_PROMPT = `Tu es un extracteur de plaques signalétiques de chaudières (gaz, fioul, électrique, PAC, bois).

Tu reçois une photo de plaque signalétique (vissée sur l'appareil) ou une page produit (notice).
Tu retournes UNIQUEMENT un JSON conforme au schéma ci-dessous (pas de markdown).

Règles ABSOLUES :
- Ne JAMAIS inventer. null si illisible.
- Confidence 0-100 par champ dans confidenceByField (OBLIGATOIRE pour chaque champ rempli).
- Année : 4 chiffres (number).
- Puissance : kW (number) — convertir si donnée en W ou kcal.
- Efficiency : décimale (ex 92% → 0.92). Une PAC peut avoir COP > 1 (ex 3.5).

Schéma JSON :

{
  "brand": "Marque (ex Saunier Duval, Frisquet, Viessmann...)" | null,
  "model": "Modèle exact" | null,
  "serialNumber": "Numéro de série" | null,
  "manufacturingYear": <number 4 chiffres> | null,
  "installationYear": <number 4 chiffres> | null,
  "powerKw": <number> | null,
  "efficiency": <number 0-2> | null,
  "energyType": "gaz_naturel" | "gaz_propane" | "fioul" | "electrique" | "bois_buche" | "bois_granules" | null,
  "type": "classique" | "basse_temperature" | "condensation" | "pac_air_eau" | "pac_geothermique" | null,
  "ceCertification": <boolean ou null si non visible>,
  "confidenceByField": { "<fieldName>": <int 0-100>, ... }
}`

export async function extractChaudiere(
  documentId: string,
  imageBase64: string,
  mimeType: string,
  supabase: SupabaseClient,
): Promise<ExtractorResult<ChaudiereExtraction>> {
  return runExtractor({
    documentId,
    imageBase64,
    mimeType,
    model: CHAUDIERE_MODEL,
    systemPrompt: CHAUDIERE_SYSTEM_PROMPT,
    schema: ChaudiereExtractionSchema,
    operation: 'extract_chaudiere',
    maxTokens: 2048,
    supabase,
  })
}
