/**
 * KOVAS — Document Intelligence : registry des extracteurs.
 *
 * Dispatch par document_type vers l'extracteur approprié. Les types V1.5
 * (audit énergétique, amiante, plomb, règlement copro, etc.) renvoient
 * ExtractionError 'not_implemented' (HTTP 501 côté route).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { type BackendDocumentType, V1_EXTRACTABLE_TYPES } from '../backend-types'
import { extractChaudiere } from './chaudiere-extractor'
import { extractDpe } from './dpe-extractor'
import { ExtractionError, type ExtractorResult } from './extractor-base'
import { extractFactureEnergie } from './facture-energie-extractor'
import { extractPlan } from './plan-extractor'

export interface DispatchResult {
  documentType: BackendDocumentType
  /** Data structurée (typée selon document_type). */
  data: unknown
  /** Map { fieldPath: confidence 0-100 }. */
  confidenceByField: Record<string, number>
  costEur: number
  model: string
  durationMs: number
  inputTokens: number
  outputTokens: number
}

export async function dispatchExtraction(
  documentType: BackendDocumentType,
  documentId: string,
  imageBase64: string,
  mimeType: string,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  if (!V1_EXTRACTABLE_TYPES.has(documentType)) {
    throw new ExtractionError(
      `Extracteur "${documentType}" non implémenté en V1`,
      'not_implemented',
    )
  }

  let result: ExtractorResult<unknown>

  switch (documentType) {
    case 'dpe':
      result = await extractDpe(documentId, imageBase64, mimeType, supabase)
      break
    case 'plaque_chaudiere':
      result = await extractChaudiere(documentId, imageBase64, mimeType, supabase)
      break
    case 'facture_energie':
      result = await extractFactureEnergie(documentId, imageBase64, mimeType, supabase)
      break
    case 'plan':
      result = await extractPlan(documentId, imageBase64, mimeType, supabase)
      break
    default:
      throw new ExtractionError(
        `Extracteur "${documentType}" non implémenté en V1`,
        'not_implemented',
      )
  }

  // Récupère confidenceByField depuis la data
  const confidenceByField = extractConfidenceMap(result.data)

  return {
    documentType,
    data: result.data,
    confidenceByField,
    costEur: result.costEur,
    model: result.model,
    durationMs: result.durationMs,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  }
}

function extractConfidenceMap(data: unknown): Record<string, number> {
  if (typeof data !== 'object' || data === null) return {}
  const obj = data as Record<string, unknown>
  const map = obj.confidenceByField
  if (typeof map !== 'object' || map === null) return {}
  const cleaned: Record<string, number> = {}
  for (const [k, v] of Object.entries(map as Record<string, unknown>)) {
    if (typeof v === 'number' && v >= 0 && v <= 100) {
      cleaned[k] = Math.round(v)
    }
  }
  return cleaned
}

export { ExtractionError } from './extractor-base'
