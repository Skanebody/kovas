/**
 * KOVAS — Algo A1.3.6 — Vision IA classifier équipements.
 *
 * Sur photo de plaque signalétique, extrait : marque, modèle, année, puissance,
 * type énergie, classe énergétique. Cross-check contre data.equipment_brands_models.
 *
 * Process :
 *   1. Pré-traitement image (rotation auto, expo) — fait côté upload
 *   2. Claude Vision API avec prompt structuré JSON
 *   3. Parser response, confidence scoring par champ
 *   4. Cross-check base interne, enrichir specs
 *   5. Si confidence < 70% → fallback manuel (UI demande validation)
 *
 * Coût : ~0.02€ par analyse (Claude Sonnet Vision).
 * Performance budget : < 4s par photo.
 * Authority : REFONTE-ACQUI-TARGET-V2 chapitre 9.2.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export type EquipmentType =
  | 'chaudiere'
  | 'pompe_chaleur'
  | 'chauffe_eau'
  | 'radiateur'
  | 'vmc'
  | 'climatisation'
  | 'panneau_solaire'
  | 'compteur'
  | 'tableau_electrique'
  | 'detecteur_fumee'
  | 'autre'

export interface VisionEquipmentField<T> {
  value: T | null
  confidence: number // 0-1
}

export interface VisionEquipmentResult {
  equipment_type: EquipmentType
  brand: VisionEquipmentField<string>
  model: VisionEquipmentField<string>
  serial_number: VisionEquipmentField<string>
  manufacture_year: VisionEquipmentField<number>
  power_kw: VisionEquipmentField<number>
  energy_type: VisionEquipmentField<'gaz' | 'electricite' | 'fioul' | 'pompe_chaleur' | 'bois'>
  energy_class: VisionEquipmentField<string>
  enriched_from_database: boolean
  raw_ocr_text: string
  overall_confidence: number
  needs_manual_validation: boolean
}

const SYSTEM_PROMPT = `Tu es un assistant expert diagnostic immobilier. Tu analyses des photos de plaques signalétiques d'équipements (chaudières, VMC, pompes à chaleur, compteurs, etc.).

Extrais STRICTEMENT en JSON les champs visibles. N'invente JAMAIS. Si un champ n'est pas visible, mets null avec confidence: 0.

Format JSON OBLIGATOIRE (sans markdown, sans texte hors JSON) :
{
  "equipment_type": "chaudiere|pompe_chaleur|chauffe_eau|radiateur|vmc|climatisation|panneau_solaire|compteur|tableau_electrique|detecteur_fumee|autre",
  "brand": {"value": "...", "confidence": 0.95},
  "model": {"value": "...", "confidence": 0.85},
  "serial_number": {"value": "...", "confidence": 0.7},
  "manufacture_year": {"value": 2018, "confidence": 0.9},
  "power_kw": {"value": 25.0, "confidence": 0.85},
  "energy_type": {"value": "gaz|electricite|fioul|pompe_chaleur|bois", "confidence": 0.95},
  "energy_class": {"value": "A|B|...", "confidence": 0.8},
  "raw_ocr_text": "tout le texte visible sur la plaque"
}

Confidence guidelines :
- 1.0 = champ parfaitement lisible et indiscutable
- 0.8-0.9 = champ lisible avec léger doute
- 0.5-0.7 = partiellement deviné/inféré
- < 0.5 = très incertain → préfère null + confidence 0.0`

export interface VisionAnalyzeInput {
  imageUrl: string // URL signed Supabase Storage ou base64 data URL
}

export async function analyzeEquipmentPhoto(
  input: VisionAnalyzeInput,
): Promise<VisionEquipmentResult | { error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: 'ANTHROPIC_API_KEY missing' }

  const client = new Anthropic({ apiKey })
  const model = process.env.ANTHROPIC_MODEL_VISION ?? 'claude-sonnet-4-6'

  let response: Awaited<ReturnType<typeof client.messages.create>>
  try {
    response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: input.imageUrl.startsWith('data:')
                ? {
                    type: 'base64',
                    media_type: extractMediaType(input.imageUrl),
                    data: input.imageUrl.split(',')[1] ?? '',
                  }
                : { type: 'url', url: input.imageUrl },
            },
            {
              type: 'text',
              text: 'Analyse cette plaque signalétique. Réponds STRICTEMENT en JSON valide.',
            },
          ],
        },
      ],
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'claude vision call failed' }
  }

  const textBlock = response.content.find(
    (b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text',
  )
  if (!textBlock) return { error: 'no text response from Claude' }

  // Parse JSON (strip markdown fences si présents)
  const cleaned = textBlock.text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: VisionEquipmentResult
  try {
    parsed = JSON.parse(cleaned) as VisionEquipmentResult
  } catch {
    return { error: 'invalid JSON from Claude Vision' }
  }

  // Cross-check base interne data.equipment_brands_models
  const enriched = await enrichFromDatabase(parsed)

  // Compute overall confidence (moyenne pondérée des champs critiques)
  const overallConfidence = computeOverallConfidence(enriched)
  enriched.overall_confidence = overallConfidence
  enriched.needs_manual_validation = overallConfidence < 0.7

  return enriched
}

function extractMediaType(
  dataUrl: string,
): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  const match = dataUrl.match(/^data:([^;]+);/)
  const mime = match?.[1] ?? 'image/jpeg'
  if (mime === 'image/png' || mime === 'image/webp' || mime === 'image/gif') return mime
  return 'image/jpeg'
}

async function enrichFromDatabase(result: VisionEquipmentResult): Promise<VisionEquipmentResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || !result.brand.value || !result.model.value) return result

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const { data } = await supabase
    .schema('data' as never)
    .from('equipment_brands_models')
    .select('*')
    .eq('brand', result.brand.value)
    .eq('model', result.model.value)
    .maybeSingle()

  if (!data) return result

  type BrandModelRow = {
    power_kw?: number
    energy_type?: string
    energy_class?: string
    year_min?: number
    year_max?: number
  }
  const row = data as unknown as BrandModelRow

  // Enrichit les champs manquants depuis le catalogue
  if (result.power_kw.value == null && row.power_kw != null) {
    result.power_kw = { value: row.power_kw, confidence: 0.95 }
  }
  if (result.energy_type.value == null && row.energy_type) {
    result.energy_type = {
      value: row.energy_type as VisionEquipmentResult['energy_type']['value'],
      confidence: 0.95,
    }
  }
  if (result.energy_class.value == null && row.energy_class) {
    result.energy_class = { value: row.energy_class, confidence: 0.9 }
  }

  result.enriched_from_database = true
  return result
}

function computeOverallConfidence(result: VisionEquipmentResult): number {
  const weights = {
    brand: 0.25,
    model: 0.2,
    manufacture_year: 0.15,
    power_kw: 0.15,
    energy_type: 0.15,
    energy_class: 0.1,
  }
  let total = 0
  let used = 0
  for (const [key, weight] of Object.entries(weights)) {
    const field = result[key as keyof typeof weights]
    if (field?.value != null) {
      total += field.confidence * weight
      used += weight
    }
  }
  return used > 0 ? total / used : 0
}
