/**
 * KOVAS — Document Intelligence : extracteur facture énergie.
 *
 * Modèle : claude-sonnet-4-6.
 *
 * Champ stratégique : `estimatedAnnualConsumptionKwh` — utilisé pour pré-remplir
 * la classe énergétique attendue du DPE.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type FactureEnergieExtraction,
  FactureEnergieExtractionSchema,
} from '../extraction-schemas/facture-energie-schema'
import { type ExtractorResult, runExtractor } from './extractor-base'

const FACTURE_MODEL = process.env.ANTHROPIC_EXTRACTION_MODEL ?? 'claude-sonnet-4-6'

const FACTURE_SYSTEM_PROMPT = `Tu es un extracteur de factures d'énergie françaises (EDF, Engie, TotalEnergies, etc.).

Tu reçois UNE facture (image ou PDF). Tu retournes UNIQUEMENT un JSON conforme au schéma ci-dessous.

Règles ABSOLUES :
- Ne JAMAIS inventer. null si illisible.
- Confidence 0-100 par champ dans confidenceByField (OBLIGATOIRE pour chaque champ rempli).
- Dates : ISO YYYY-MM-DD strict.
- Énergie type : "electricite", "gaz", "fioul", "bois", "reseau_chaleur".
- consumptionKwh : kWh sur la période facturée (number).
- consumptionM3 : m³ (gaz seulement, null pour électricité).
- estimatedAnnualConsumptionKwh : conso annuelle estimée si présente sur la facture
  (souvent dans un encart "votre consommation annuelle" ou "vous avez consommé sur 12 mois").
  Si seulement consumption sur période courte, EXTRAPOLE prudemment si la durée est >= 6 mois,
  sinon laisse null.

Schéma JSON :

{
  "provider": "EDF" | "Engie" | "TotalEnergies" | "ekWateur" | autre,
  "energyType": "electricite" | "gaz" | "fioul" | "bois" | "reseau_chaleur" | null,
  "periodStart": "YYYY-MM-DD" | null,
  "periodEnd": "YYYY-MM-DD" | null,
  "consumptionKwh": <number> | null,
  "consumptionM3": <number> | null,
  "estimatedAnnualConsumptionKwh": <number> | null,
  "pricingType": "base" | "heures_creuses" | "tempo" | "effacement_jour_pointe" | "fixe" | "indexe" | null,
  "meterNumber": "Numéro compteur (Linky / etc.)" | null,
  "pdlNumber": "PDL (élec, 14 chiffres) ou PCE (gaz, 14 chiffres)" | null,
  "confidenceByField": { "<fieldName>": <int 0-100>, ... }
}`

export async function extractFactureEnergie(
  documentId: string,
  imageBase64: string,
  mimeType: string,
  supabase: SupabaseClient,
): Promise<ExtractorResult<FactureEnergieExtraction>> {
  return runExtractor({
    documentId,
    imageBase64,
    mimeType,
    model: FACTURE_MODEL,
    systemPrompt: FACTURE_SYSTEM_PROMPT,
    schema: FactureEnergieExtractionSchema,
    operation: 'extract_facture_energie',
    maxTokens: 2048,
    supabase,
  })
}
