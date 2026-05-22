/**
 * Analyse IA de scans de diagnostics immobiliers existants via Claude Sonnet 4.6
 * Vision (PDF natif ou image).
 *
 * Objectif : détecter le type (DPE, amiante, plomb, gaz, élec, termites, Carrez,
 * ERP), extraire date d'émission, adresse, propriétaire, numéro ADEME (DPE),
 * classe énergétique (DPE). Le calcul de la date d'expiration se fait côté
 * `expiration-calculator.ts` (logique métier déterministe).
 *
 * Coût indicatif : ~0,003-0,010 €/scan (Sonnet 4.6, 1-3 pages typique).
 */

import Anthropic from '@anthropic-ai/sdk'
import type { DiagnosticType } from './expiration-calculator'

const SONNET_MODEL = process.env.ANTHROPIC_MODEL_VISION ?? 'claude-sonnet-4-6'

export interface ScanAnalysisResult {
  diagnostic_type: DiagnosticType | null
  date_emission: string | null
  adresse: string | null
  proprietaire: string | null
  ademe_number: string | null
  energy_class: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
  /** Résultat positif (matériaux détectés) — utile pour amiante / plomb */
  result_positive: boolean | null
  /** Confiance globale 0-1 */
  confidence: number
  /** Résumé humain 1 phrase */
  summary: string
}

export interface ScanAnalysisOutcome {
  data: ScanAnalysisResult
  costEur: number
  latencyMs: number
}

const SYSTEM_PROMPT = `Tu es un expert qui analyse les rapports de diagnostic immobilier français.

Tu reçois UN document (rapport DPE, amiante, plomb CREP, gaz, électricité, termites, mesurage Carrez/Boutin, ou ERP).
Tu retournes UN seul JSON conforme au schéma indiqué — pas de markdown, pas de texte additionnel.

Règles :
- Ne jamais inventer une donnée absente. Si tu ne trouves pas, mets null.
- diagnostic_type DOIT être exactement l'une des valeurs : 'dpe', 'amiante', 'plomb', 'gaz', 'electricite', 'termites', 'carrez', 'erp', ou null.
- date_emission au format YYYY-MM-DD (à défaut, YYYY-MM-01).
- adresse complète sur 1 ligne : "12 rue de la Paix, 75002 Paris".
- proprietaire : nom du propriétaire/donneur d'ordre tel qu'il apparait. null si non visible.
- ademe_number : uniquement si DPE — numéro à 13 caractères (ex "2168E1234567A"). null sinon.
- energy_class : uniquement si DPE — lettre A à G. null sinon.
- result_positive : pour amiante et plomb uniquement, true si matériaux/peintures détectés, false si absence confirmée, null sinon.
- confidence : 0.9+ pour scans nets, 0.6-0.8 pour scans propres, < 0.5 pour cas douteux.
- summary : 1 phrase humaine "DPE 2023, classe E, 12 rue de la Paix Paris 2e".

Indices typiques par type :
- DPE : "Diagnostic de Performance Énergétique", étiquette A-G, numéro ADEME, GES.
- Amiante : "Repérage Amiante", "DAPP", "DTA", liste matériaux/produits.
- Plomb : "Constat de Risque d'Exposition au Plomb", "CREP".
- Gaz : "État de l'installation intérieure de gaz", "DIAG GAZ".
- Électricité : "État de l'installation intérieure d'électricité", "DIAG ELEC".
- Termites : "État relatif à la présence de termites".
- Carrez : "Mesurage Loi Carrez", "Loi Boutin", surface privative.
- ERP : "État des Risques et Pollutions", "ERRIAL", "ERP", risques naturels/technologiques/miniers.`

const RESPONSE_SCHEMA = `{
  "diagnostic_type": "dpe" | "amiante" | "plomb" | "gaz" | "electricite" | "termites" | "carrez" | "erp" | null,
  "date_emission": "YYYY-MM-DD" | null,
  "adresse": "..." | null,
  "proprietaire": "..." | null,
  "ademe_number": "..." | null,
  "energy_class": "A" | "B" | "C" | "D" | "E" | "F" | "G" | null,
  "result_positive": true | false | null,
  "confidence": 0.0,
  "summary": "..."
}`

const ALLOWED_TYPES: ReadonlySet<DiagnosticType> = new Set([
  'dpe',
  'amiante',
  'plomb',
  'gaz',
  'electricite',
  'termites',
  'carrez',
  'erp',
])

const ALLOWED_ENERGY = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G'])

function sanitize(raw: unknown): ScanAnalysisResult {
  const obj = (raw ?? {}) as Record<string, unknown>

  const typeRaw = typeof obj.diagnostic_type === 'string' ? obj.diagnostic_type : null
  const diagnostic_type =
    typeRaw && ALLOWED_TYPES.has(typeRaw as DiagnosticType) ? (typeRaw as DiagnosticType) : null

  const energyRaw = typeof obj.energy_class === 'string' ? obj.energy_class : null
  const energy_class =
    energyRaw && ALLOWED_ENERGY.has(energyRaw)
      ? (energyRaw as ScanAnalysisResult['energy_class'])
      : null

  return {
    diagnostic_type,
    date_emission: typeof obj.date_emission === 'string' ? obj.date_emission : null,
    adresse: typeof obj.adresse === 'string' ? obj.adresse : null,
    proprietaire: typeof obj.proprietaire === 'string' ? obj.proprietaire : null,
    ademe_number: typeof obj.ademe_number === 'string' ? obj.ademe_number : null,
    energy_class,
    result_positive: typeof obj.result_positive === 'boolean' ? obj.result_positive : null,
    confidence: typeof obj.confidence === 'number' ? Math.max(0, Math.min(1, obj.confidence)) : 0,
    summary: typeof obj.summary === 'string' ? obj.summary : '',
  }
}

/**
 * Lance l'analyse Claude Vision sur un scan de diagnostic.
 *
 * @param fileBytes contenu binaire (PDF natif ou image)
 * @param mimeType ex 'application/pdf', 'image/jpeg', 'image/png'
 */
export async function analyzeScan(
  fileBytes: Buffer,
  mimeType: string,
): Promise<ScanAnalysisOutcome> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY non configurée')
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const t0 = Date.now()
  const base64 = fileBytes.toString('base64')

  const isPdf = mimeType === 'application/pdf'
  const isImage = mimeType.startsWith('image/')
  if (!isPdf && !isImage) {
    throw new Error(`Type ${mimeType} non supporté (PDF ou image seulement)`)
  }

  // L'union de types Anthropic content blocks est large — cast prudent par
  // bloc, validé runtime par l'API SDK.
  const docBlock = isPdf
    ? {
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
      }
    : {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
          data: base64,
        },
      }

  const response = await client.messages.create({
    model: SONNET_MODEL,
    max_tokens: 1024,
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
            text: `Analyse ce scan de diagnostic immobilier.\n\nRetourne UNIQUEMENT le JSON conforme à ce schéma :\n${RESPONSE_SCHEMA}`,
          },
        ],
      },
    ],
  })

  const latencyMs = Date.now() - t0
  const block = response.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Réponse Claude non-textuelle')
  }

  const cleaned = block.text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    throw new Error(`JSON Claude invalide : ${err instanceof Error ? err.message : 'parse error'}`)
  }

  const sanitized = sanitize(parsed)

  // Sonnet 4.6 pricing : $3/M input, $15/M output
  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const cachedInput = response.usage.cache_read_input_tokens ?? 0
  const billableInput = inputTokens - cachedInput
  const costUsd = billableInput * 0.000003 + cachedInput * 0.0000003 + outputTokens * 0.000015
  const costEur = Math.round(costUsd * 0.93 * 100000) / 100000

  return { data: sanitized, costEur, latencyMs }
}
