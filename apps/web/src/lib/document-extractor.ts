/**
 * Extraction de données structurées depuis les documents propriétaire
 * (factures énergie, anciens DPE, plans, actes…) via Claude Sonnet 4.6 vision.
 *
 * Stratégie :
 * - PDF / images directement passés au modèle (Claude lit nativement les PDFs ≤ 32 Mo)
 * - Schéma JSON strict par doc_kind, on demande explicitement les champs
 * - Suggestions d'imports : couples (target, value) actionnables côté UI
 * - Coût : ~$0.003-0.010 par document (Sonnet 4.6, 1-3 pages typique)
 */

import Anthropic from '@anthropic-ai/sdk'

const SONNET_MODEL = process.env.ANTHROPIC_MODEL_VISION ?? 'claude-sonnet-4-6'

export type DocumentKind =
  | 'facture_energie'
  | 'ancien_dpe'
  | 'plan'
  | 'acte'
  | 'reglement_copro'
  | 'autre'

export interface SuggestedImport {
  target: string // 'property.surface_total' | 'property.year_built' | 'property.energy_class' | 'mission.dpe_letter' | ...
  label: string
  value: string | number | null
}

export interface ExtractedDocument {
  doc_kind: DocumentKind
  raw_fields: Record<string, unknown>
  suggested_imports: SuggestedImport[]
  confidence: number
  summary: string
}

interface ExtractionResult {
  data: ExtractedDocument
  costEur: number
  latencyMs: number
}

const SYSTEM_PROMPT = `Tu es un assistant qui extrait les données structurées de documents immobiliers français.

Tu reçois UN document (facture énergie, ancien DPE, acte, plan, règlement de copropriété, ou autre).
Tu retournes UN seul JSON conforme au schéma indiqué — pas de markdown, pas de texte additionnel.

Règles :
- Ne jamais inventer une donnée absente. Si tu ne trouves pas, mets null.
- Confidence (0-1) : 0.9+ pour docs lisibles texte natif, 0.6-0.8 pour scans propres, <0.5 pour cas douteux.
- raw_fields : tout ce que tu trouves d'utile (consommation, classe, surface, marque équipement, dates…)
- suggested_imports : couples {target, label, value} ACTIONNABLES pour pré-remplir un bien/mission KOVAS
- summary : 1 phrase humaine "DPE 2018, classe E (280 kWh/m²/an), 85 m², chaudière Saunier Duval 2010"

Targets KOVAS valides pour suggested_imports.target :
- 'property.surface_total' (m²)
- 'property.year_built' (année 4 chiffres)
- 'property.property_type' ('maison' | 'appartement' | 'immeuble' | 'local_commercial' | 'bureau' | 'autre')
- 'property.energy_class' ('A'|'B'|'C'|'D'|'E'|'F'|'G')
- 'property.ges_class' (idem A-G)
- 'mission.dpe_letter' (idem A-G — actuelle classe DPE)
- 'mission.energy_value' (kWh/m²/an)
- 'mission.ges_value' (kgCO2/m²/an)`

function jsonSchemaForKind(kind: DocumentKind): string {
  const base = `{
  "doc_kind": "${kind}",
  "raw_fields": {},
  "suggested_imports": [{ "target": "...", "label": "...", "value": "..." }],
  "confidence": 0.0,
  "summary": "..."
}`

  switch (kind) {
    case 'ancien_dpe':
      return `${base}

raw_fields attendus :
{
  "date_dpe": "YYYY-MM",
  "energy_class": "A-G",
  "ges_class": "A-G",
  "kwh_m2_year": number,
  "ges_m2_year": number,
  "surface_m2": number,
  "year_built": number,
  "heating_type": "gaz" | "fioul" | "electrique" | "pompe_chaleur" | "bois" | "reseau" | null,
  "equipment_mentioned": [{ "kind": "...", "brand": "...", "year_install": number }],
  "validity_expires": "YYYY-MM-DD",
  "recommendations": ["scénario travaux 1", "..."]
}`

    case 'facture_energie':
      return `${base}

raw_fields attendus :
{
  "energy_type": "electricite" | "gaz" | "fioul" | "bois" | "reseau",
  "provider": "EDF" | "Engie" | "TotalEnergies" | ...,
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "consumption_kwh": number,
  "amount_eur": number,
  "address": "..."
}`

    case 'acte':
      return `${base}

raw_fields attendus :
{
  "type_acte": "vente" | "bail" | "donation" | ...,
  "date_acte": "YYYY-MM-DD",
  "vendeur_acheteur": "...",
  "adresse_bien": "...",
  "surface_loi_carrez": number,
  "prix_vente_eur": number,
  "notaire": "..."
}`

    case 'reglement_copro':
      return `${base}

raw_fields attendus :
{
  "syndic": "...",
  "annee_construction": number,
  "nombre_lots": number,
  "chauffage_collectif": boolean,
  "type_chauffage_collectif": "gaz" | "fioul" | "pac" | "reseau",
  "ascenseur": boolean
}`

    default:
      return `${base}

raw_fields : tout ce qui peut être pertinent pour un diagnostic immobilier.`
  }
}

/**
 * Détermine le doc_kind à partir du doc_kind utilisateur ou auto-detect.
 */
export function normalizeDocKind(userKind: string | null): DocumentKind {
  const k = (userKind ?? 'autre').toLowerCase()
  if (
    k === 'facture_energie' ||
    k === 'ancien_dpe' ||
    k === 'acte' ||
    k === 'plan' ||
    k === 'reglement_copro'
  ) {
    return k as DocumentKind
  }
  return 'autre'
}

/**
 * Appelle Claude Sonnet avec le document.
 * @param fileBytes contenu binaire du document (PDF ou image)
 * @param mimeType ex 'application/pdf', 'image/jpeg'
 * @param docKind type fourni par l'utilisateur (peut être 'autre')
 */
export async function extractDocument(
  fileBytes: Buffer,
  mimeType: string,
  docKind: DocumentKind,
): Promise<ExtractionResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const t0 = Date.now()

  // Encode le document en base64 pour l'API Anthropic
  const base64 = fileBytes.toString('base64')

  // Type de contenu Anthropic : 'document' pour PDF, 'image' pour images
  const isPdf = mimeType === 'application/pdf'
  const isImage = mimeType.startsWith('image/')

  if (!isPdf && !isImage) {
    throw new Error(`Type ${mimeType} non supporté par l'extracteur (PDF/images seulement)`)
  }

  // biome-ignore lint/suspicious/noExplicitAny: union complexe Anthropic content blocks
  const docBlock: any = isPdf
    ? {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      }
    : {
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: base64 },
      }

  const response = await client.messages.create({
    model: SONNET_MODEL,
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          docBlock,
          {
            type: 'text',
            text: `Extrait les données de ce document de type "${docKind}".\n\nRetourne UNIQUEMENT le JSON conforme à ce schéma :\n${jsonSchemaForKind(docKind)}`,
          },
        ],
      },
    ],
  })

  const latencyMs = Date.now() - t0
  const block = response.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Claude returned non-text content')
  }

  const cleaned = block.text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')

  let parsed: ExtractedDocument
  try {
    parsed = JSON.parse(cleaned) as ExtractedDocument
  } catch (err) {
    throw new Error(`JSON Claude invalide: ${err instanceof Error ? err.message : 'parse error'}`)
  }

  // Sonnet 4.6 pricing: $3/M input, $15/M output (approx)
  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const cachedInput = response.usage.cache_read_input_tokens ?? 0
  const billableInput = inputTokens - cachedInput
  const costUsd = billableInput * 0.000003 + cachedInput * 0.0000003 + outputTokens * 0.000015
  const costEur = Math.round(costUsd * 0.93 * 100000) / 100000

  return { data: parsed, costEur, latencyMs }
}
