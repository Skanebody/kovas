/**
 * KOVAS — Document Intelligence : extracteur plan (OCR simple).
 *
 * Modèle : claude-haiku-4-5 (extraction simple = OCR brut, le scoring fin
 * de pièces est V2).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { type PlanExtraction, PlanExtractionSchema } from '../extraction-schemas/plan-schema'
import { type ExtractorResult, runExtractor } from './extractor-base'

const PLAN_MODEL = process.env.ANTHROPIC_CLASSIFIER_MODEL ?? 'claude-haiku-4-5'

const PLAN_SYSTEM_PROMPT = `Tu es un extracteur de plans architecturaux français.

Tu reçois UN plan (image ou PDF). Tu retournes UNIQUEMENT un JSON conforme au schéma ci-dessous.

Règles :
- Tu fais de l'OCR brut sur les textes lisibles (légendes, annotations, surfaces).
- Tu identifies le type de plan si la légende est lisible.
- Si une surface totale est annotée explicitement, tu l'extrais.
- null partout si rien de lisible.
- Confidence 0-100 par champ dans confidenceByField.

Schéma JSON :

{
  "ocrText": "texte brut concaténé, max 5000c" | null,
  "pagesCount": <number, 1 pour image simple> | null,
  "planKind": "plan_masse" | "plan_etage" | "plan_coupe" | "plan_cadastral" | "plan_facade" | "autre" | null,
  "totalSurfaceM2": <number> | null,
  "confidenceByField": { "<fieldName>": <int 0-100>, ... }
}`

export async function extractPlan(
  documentId: string,
  imageBase64: string,
  mimeType: string,
  supabase: SupabaseClient,
): Promise<ExtractorResult<PlanExtraction>> {
  return runExtractor({
    documentId,
    imageBase64,
    mimeType,
    model: PLAN_MODEL,
    systemPrompt: PLAN_SYSTEM_PROMPT,
    schema: PlanExtractionSchema,
    operation: 'extract_plan',
    maxTokens: 2048,
    supabase,
  })
}
