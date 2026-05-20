/**
 * KOVAS — Document Intelligence : extracteur DPE.
 *
 * Modèle : claude-sonnet-4-6 (précision élevée requise — DPE = doc dense
 * réglementaire, beaucoup de champs structurés).
 *
 * Prompt strict :
 *   - Liste exhaustive des champs attendus
 *   - Format de date ISO YYYY-MM-DD
 *   - Confidence par champ (0-100) renvoyée OBLIGATOIREMENT dans confidenceByField
 *   - null si information non lisible (PAS d'invention)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { type DpeExtraction, DpeExtractionSchema } from '../extraction-schemas/dpe-schema'
import { type ExtractorResult, runExtractor } from './extractor-base'

const DPE_MODEL = process.env.ANTHROPIC_EXTRACTION_MODEL ?? 'claude-sonnet-4-6'

const DPE_SYSTEM_PROMPT = `Tu es un extracteur de données DPE (Diagnostic de Performance Énergétique français).

Tu reçois un DPE (image ou PDF) au format français (typiquement DPE 3CL-2021).
Tu retournes UNIQUEMENT un JSON conforme au schéma ci-dessous (pas de markdown, pas de texte additionnel).

Règles ABSOLUES :
- Ne JAMAIS inventer une valeur. Si tu ne lis pas clairement → null.
- Confidence par champ (0-100) OBLIGATOIRE pour CHAQUE champ extrait dans confidenceByField :
  - 95+ : lisibilité parfaite, marquage explicite
  - 80-94 : lisible mais nécessite interprétation
  - 60-79 : inférence raisonnable
  - <60 : doute important (préfère mettre la valeur à null)
- Dates : format ISO YYYY-MM-DD strict (ex "2024-03-15"). null si illisible.
- Surface en m² (number, pas string)
- Année construction : 4 chiffres (number)
- Consommations : valeurs numériques sans unité (kWh/m²/an ou kgCO2/m²/an)

Schéma JSON attendu :

{
  "realizationDate": "YYYY-MM-DD" | null,
  "diagnosticianName": "Nom Prénom du diagnostiqueur" | null,
  "diagnosticianCompany": "Nom de la société" | null,
  "diagnosticianCertificate": "Numéro de certification" | null,
  "dpeNumber": "Numéro identifiant DPE (13 chiffres)" | null,
  "propertyAddress": "Adresse complète" | null,
  "propertyType": "maison" | "appartement" | "immeuble" | "local_commercial" | "bureau" | "autre" | null,
  "constructionYear": <number 4 chiffres> | null,
  "habitableSurface": <number m²> | null,
  "energyClass": "A" | "B" | "C" | "D" | "E" | "F" | "G" | null,
  "energyConsumption": <number kWh/m²/an> | null,
  "gesClass": "A" | "B" | "C" | "D" | "E" | "F" | "G" | null,
  "gesEmissions": <number kgCO2/m²/an> | null,
  "heatingType": "gaz" | "fioul" | "electrique" | "pompe_chaleur" | "bois" | "reseau_chaleur" | "mixte" | "autre" | null,
  "heatingBrand": "Marque chaudière" | null,
  "heatingModel": "Modèle chaudière" | null,
  "heatingYear": <number 4 chiffres> | null,
  "hotWaterType": "gaz" | "electrique" | "pompe_chaleur" | "solaire" | "mixte" | "autre" | null,
  "hotWaterBrand": "Marque ECS" | null,
  "hotWaterYear": <number 4 chiffres> | null,
  "ventilationType": "naturelle" | "vmc_simple_flux" | "vmc_double_flux" | "vmc_hygro" | "absente" | "autre" | null,
  "confidenceByField": {
    "<fieldName>": <int 0-100>,
    ...
  }
}

Important : confidenceByField DOIT contenir une entrée pour CHAQUE champ que tu remplis avec une valeur non-null.`

/**
 * Extrait les données d'un DPE.
 */
export async function extractDpe(
  documentId: string,
  imageBase64: string,
  mimeType: string,
  supabase: SupabaseClient,
): Promise<ExtractorResult<DpeExtraction>> {
  return runExtractor({
    documentId,
    imageBase64,
    mimeType,
    model: DPE_MODEL,
    systemPrompt: DPE_SYSTEM_PROMPT,
    schema: DpeExtractionSchema,
    operation: 'extract_dpe',
    maxTokens: 4096,
    supabase,
  })
}
