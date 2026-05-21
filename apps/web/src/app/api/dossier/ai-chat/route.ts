/**
 * KOVAS — Route API POST /api/dossier/ai-chat (streaming SSE)
 *
 * Chat assistant Claude contextualisé sur un dossier précis.
 * Modèle par défaut : claude-haiku-4-5 (rapide + bon marché pour chat).
 * Override possible via ANTHROPIC_MODEL.
 *
 * Body :
 *   {
 *     dossierId: string,
 *     messages: Array<{role: 'user'|'assistant', content: string}>
 *   }
 *
 * Streaming : SSE (Server-Sent Events) format `data: {...}\n\n` :
 *   - { type: 'delta', text: string }    → fragment de texte
 *   - { type: 'done', usage?: {...} }    → fin du stream
 *   - { type: 'error', error: string }   → erreur in-stream
 *
 * Auth : getCurrentUser (redirect /login si non connecté)
 * Ownership : dossier.organization_id === orgId
 *
 * Sécurité : on n'expose pas l'email/téléphone client dans le system prompt
 * (uniquement le display_name) — minimisation des données RGPD.
 */

import Anthropic from '@anthropic-ai/sdk'

import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'
export const maxDuration = 60

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequestBody {
  dossierId?: unknown
  messages?: unknown
}

interface DossierContext {
  reference: string
  scheduled_at: string | null
  status: string
  notes: string | null
  property: {
    address: string | null
    city: string | null
    property_type: string | null
    year_built: number | null
    surface_total: number | null
    heating_type: string | null
  } | null
  client_name: string | null
  missions: Array<{
    type: string
    status: string
  }>
}

interface PropertyRow {
  address: string | null
  city: string | null
  property_type: string | null
  year_built: number | null
  surface_total: number | null
  heating_type: string | null
}

interface ClientRow {
  display_name: string | null
}

interface MissionRow {
  type: string
  status: string
}

interface DossierRow {
  id: string
  organization_id: string
  reference: string
  scheduled_at: string | null
  status: string
  notes: string | null
  property: PropertyRow | PropertyRow[] | null
  client: ClientRow | ClientRow[] | null
  missions: MissionRow[] | null
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function sseEncode(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

function buildSystemPrompt(ctx: DossierContext): string {
  const prop = ctx.property
  const propLine = prop
    ? [
        prop.property_type ?? 'bien',
        prop.surface_total ? `${prop.surface_total} m²` : null,
        prop.city ? `à ${prop.city}` : null,
        prop.year_built ? `construit en ${prop.year_built}` : null,
        prop.heating_type ? `chauffage ${prop.heating_type}` : null,
      ]
        .filter(Boolean)
        .join(', ')
    : 'non renseigné'

  const missionsList =
    ctx.missions.length > 0
      ? ctx.missions.map((m) => `${m.type} (${m.status})`).join(', ')
      : 'aucun diagnostic enregistré'

  const scheduledLine = ctx.scheduled_at
    ? new Date(ctx.scheduled_at).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'non planifiée'

  return [
    "Tu es l'assistant KOVAS 360, spécialisé en diagnostic immobilier français (DPE, amiante, plomb CREP, gaz, électricité, termites, Carrez/Boutin, ERP).",
    '',
    `Contexte du dossier ${ctx.reference} :`,
    `- Bien : ${propLine}`,
    `- Client : ${ctx.client_name ?? 'non renseigné'}`,
    `- Mission planifiée : ${scheduledLine}`,
    `- Diagnostics : ${missionsList}`,
    `- Statut du dossier : ${ctx.status}`,
    ctx.notes ? `- Notes : ${ctx.notes.slice(0, 500)}` : '',
    '',
    'Règles strictes :',
    "- Ton sobre, professionnel, technique. Vouvoiement obligatoire. Pas d'emoji.",
    '- Réponses concises (5 phrases max sauf si on vous demande explicitement un développement).',
    '- Pour les questions réglementaires, citez les articles pertinents (Code de la construction et de l\'habitation, RT2012, RE2020, arrêtés DPE 3CL-2021, etc.) sans inventer.',
    '- Si la question sort du périmètre diagnostic immobilier, redirigez poliment.',
    "- Ne jamais inventer de valeurs absentes du contexte. Si une donnée manque, dites-le clairement.",
  ]
    .filter(Boolean)
    .join('\n')
}

async function loadDossierContext(
  dossierId: string,
  orgId: string,
): Promise<DossierContext | null> {
  const { supabase } = await getCurrentUser()

  const { data, error } = await supabase
    .from('dossiers')
    .select(
      `id,
       organization_id,
       reference,
       scheduled_at,
       status,
       notes,
       property:properties (
         address,
         city,
         property_type,
         year_built,
         surface_total,
         heating_type
       ),
       client:clients (
         display_name
       ),
       missions (
         type,
         status
       )`,
    )
    .eq('id', dossierId)
    .maybeSingle<DossierRow>()

  if (error || !data) return null
  if (data.organization_id !== orgId) return null

  const property = pickOne<PropertyRow>(data.property)
  const client = pickOne<ClientRow>(data.client)
  const missions = Array.isArray(data.missions) ? data.missions : []

  return {
    reference: data.reference,
    scheduled_at: data.scheduled_at,
    status: data.status,
    notes: data.notes,
    property,
    client_name: client?.display_name ?? null,
    missions: missions.map((m) => ({
      type: m.type,
      status: m.status,
    })),
  }
}

function normalizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return []
  const out: ChatMessage[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const role = (item as { role?: unknown }).role
    const content = (item as { content?: unknown }).content
    if ((role === 'user' || role === 'assistant') && typeof content === 'string') {
      const trimmed = content.trim()
      if (trimmed.length > 0) {
        out.push({ role, content: trimmed.slice(0, 4000) })
      }
    }
  }
  return out
}

export async function POST(request: Request): Promise<Response> {
  // 1. Auth
  const { orgId } = await getCurrentUser()

  // 2. Parse body
  let payload: ChatRequestBody
  try {
    payload = (await request.json()) as ChatRequestBody
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const dossierId = typeof payload.dossierId === 'string' ? payload.dossierId : ''
  const messages = normalizeMessages(payload.messages)

  if (!dossierId) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_dossier_id' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }
  if (messages.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_messages' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  // 3. Contexte dossier
  const ctx = await loadDossierContext(dossierId, orgId)
  if (!ctx) {
    return new Response(JSON.stringify({ ok: false, error: 'dossier_not_found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  }

  // 4. Clé Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: 'anthropic_not_configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })
  }

  const systemPrompt = buildSystemPrompt(ctx)
  const client = new Anthropic({ apiKey })

  // 5. Streaming SSE
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: DEFAULT_MODEL,
          max_tokens: 1024,
          system: [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages,
        })

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(
              sseEncode({ type: 'delta', text: event.delta.text }),
            )
          }
        }

        const finalMessage = await anthropicStream.finalMessage()
        controller.enqueue(
          sseEncode({
            type: 'done',
            usage: {
              input_tokens: finalMessage.usage.input_tokens,
              output_tokens: finalMessage.usage.output_tokens,
            },
          }),
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'streaming_error'
        controller.enqueue(sseEncode({ type: 'error', error: message }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
