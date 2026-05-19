/**
 * Fallback Claude Haiku pour les exports Liciel dont les en-têtes ne sont
 * pas reconnus par le parser CSV maison.
 *
 * Stratégie :
 *  - Parser CSV maison gère 90% des cas (0€)
 *  - Cas ambigus → Claude Haiku 4.5 avec tool use (input < 4k tokens)
 *  - Coût : ~$0.001/import
 *
 * Cf. CLAUDE.md §7bis — stratégie d'autonomisation IA progressive.
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  ImportError,
  type LicielParsedClient,
  type LicielParsedCopropriete,
  type LicielParsedDiagnostic,
  type LicielParsedExport,
  type LicielParsedLot,
  type LicielParsedProperty,
} from './types'

const HAIKU_MODEL = process.env.ANTHROPIC_MODEL_VOICE ?? 'claude-haiku-4-5'
const MAX_INPUT_LINES = 50
const MAX_RETRIES = 3

const SYSTEM_PROMPT = `Tu extrais les entités d'un export de logiciel de diagnostic immobilier français (Liciel ou équivalent).

Règles ABSOLUES :
- Tu n'inventes JAMAIS de données manquantes. Si un champ n'est pas dans le texte, omets-le.
- Si un mapping est ambigu, baisse le confidence < 0.8.
- Téléphone : garde le format brut trouvé (la normalisation E.164 se fait après).
- Surface en m² (number).
- Année 4 chiffres.
- Tu réponds UNIQUEMENT via l'outil "extract_liciel_data".`

const EXTRACT_TOOL = {
  name: 'extract_liciel_data',
  description:
    "Retourne les entités structurées extraites d'un export Liciel : clients, biens, copropriétés, lots, diagnostics.",
  input_schema: {
    type: 'object',
    properties: {
      clients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            liciel_id: { type: 'string' },
            type: { type: 'string' },
            nom: { type: 'string' },
            prenom: { type: 'string' },
            raison_sociale: { type: 'string' },
            siret: { type: 'string' },
            email: { type: 'string' },
            telephone: { type: 'string' },
            telephone_mobile: { type: 'string' },
            adresse_ligne1: { type: 'string' },
            adresse_ligne2: { type: 'string' },
            code_postal: { type: 'string' },
            ville: { type: 'string' },
            notes: { type: 'string' },
          },
        },
      },
      properties: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            liciel_id: { type: 'string' },
            type_bien: { type: 'string' },
            adresse_ligne1: { type: 'string' },
            adresse_ligne2: { type: 'string' },
            code_postal: { type: 'string' },
            ville: { type: 'string' },
            surface_loi_carrez: { type: 'number' },
            surface_habitable: { type: 'number' },
            surface_utile: { type: 'number' },
            nombre_pieces: { type: 'number' },
            nombre_niveaux: { type: 'number' },
            annee_construction: { type: 'number' },
            liciel_client_proprietaire_id: { type: 'string' },
            liciel_copropriete_id: { type: 'string' },
            liciel_lot_id: { type: 'string' },
          },
        },
      },
      coproprietes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            liciel_id: { type: 'string' },
            nom_copro: { type: 'string' },
            numero_immatriculation: { type: 'string' },
            adresse_ligne1: { type: 'string' },
            code_postal: { type: 'string' },
            ville: { type: 'string' },
            nombre_lots: { type: 'number' },
            annee_construction: { type: 'number' },
            liciel_syndic_id: { type: 'string' },
          },
        },
      },
      lots: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            liciel_id: { type: 'string' },
            numero_lot: { type: 'string' },
            etage: { type: 'string' },
            numero_porte: { type: 'string' },
            description: { type: 'string' },
            liciel_copropriete_id: { type: 'string' },
            liciel_property_id: { type: 'string' },
          },
        },
      },
      diagnostics: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            liciel_id: { type: 'string' },
            type_diagnostic: { type: 'string' },
            date_diagnostic: { type: 'string' },
            liciel_property_id: { type: 'string' },
          },
        },
      },
    },
    required: ['clients', 'properties', 'coproprietes', 'lots', 'diagnostics'],
  },
} as const

interface ExtractToolInput {
  clients: LicielParsedClient[]
  properties: LicielParsedProperty[]
  coproprietes: LicielParsedCopropriete[]
  lots: LicielParsedLot[]
  diagnostics: LicielParsedDiagnostic[]
}

/**
 * Extrait les entités via Claude Haiku quand le parser CSV maison n'a pas
 * réussi à identifier le type d'entité (entêtes inconnues ou ambiguës).
 *
 * @throws ImportError('CLAUDE_EXTRACTION_FAILED') après MAX_RETRIES
 */
export async function extractStructuredData(rawContent: string): Promise<LicielParsedExport> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ImportError('CLAUDE_EXTRACTION_FAILED', 'ANTHROPIC_API_KEY non configurée.')
  }

  // Limite l'input à 50 lignes pour rester sous 4k tokens approx
  const lines = rawContent.split('\n')
  const truncated = lines.slice(0, MAX_INPUT_LINES).join('\n')
  if (lines.length > MAX_INPUT_LINES) {
    // Si le fichier est trop gros, on n'envoie pas tout à Claude — le caller
    // doit retomber sur le parser CSV (ou throw).
    throw new ImportError(
      'CLAUDE_EXTRACTION_FAILED',
      `Fichier trop volumineux pour Claude (${lines.length} lignes > ${MAX_INPUT_LINES}). Utiliser le parser CSV.`,
    )
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let lastError: Error | null = null
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 4096,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        // biome-ignore lint/suspicious/noExplicitAny: typage strict du SDK Anthropic
        tools: [EXTRACT_TOOL as any],
        tool_choice: { type: 'tool', name: 'extract_liciel_data' },
        messages: [
          {
            role: 'user',
            content: `Voici un extrait d'export Liciel à structurer :\n\n${truncated}`,
          },
        ],
      })

      const toolBlock = response.content.find((b) => b.type === 'tool_use')
      if (!toolBlock || toolBlock.type !== 'tool_use') {
        throw new Error('Claude did not return a tool_use block')
      }

      const data = toolBlock.input as ExtractToolInput
      return {
        clients: data.clients ?? [],
        properties: data.properties ?? [],
        coproprietes: data.coproprietes ?? [],
        lots: data.lots ?? [],
        diagnostics: data.diagnostics ?? [],
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // Backoff exponentiel : 500ms, 1s, 2s
      if (attempt < MAX_RETRIES - 1) {
        await sleep(500 * 2 ** attempt)
      }
    }
  }

  throw new ImportError(
    'CLAUDE_EXTRACTION_FAILED',
    lastError?.message ?? 'Extraction Claude échouée.',
    {
      cause: lastError?.message,
    },
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
