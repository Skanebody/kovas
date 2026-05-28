/**
 * KOVAS — Route API POST /api/mission/[dossierId]/chat/stream (SSE streaming).
 *
 * Endpoint Mission Tchat IA — assistant terrain Claude Haiku 4.5
 * conversationnel RÉEL (pas script bête) qui guide le diagnostiqueur,
 * répond à ses questions métier et capture les données structurées.
 *
 * Body :
 *   {
 *     sessionId: string,                   // mission_sessions.id (RLS via org)
 *     message: string,                     // message utilisateur courant
 *     conversationHistory?: Message[]      // optionnel (server source-of-truth via DB)
 *   }
 *
 * Comportement :
 *  1. Authentifie via getCurrentUser
 *  2. Charge contexte mission : dossier + client + bien + captures déjà faites
 *  3. Charge historique conversation (mission_chat_messages)
 *  4. Construit le system prompt expert métier (cf buildMissionSystemPrompt)
 *  5. INSERT le message utilisateur
 *  6. Stream Claude Haiku
 *  7. Parse les blocs [CAPTURE: type=... ...] en fin de réponse
 *  8. À la fin, INSERT le message assistant + INSERT les captures dans
 *     mission_session_captures + MAJ captured_data jsonb cumulé
 *
 * Format SSE :
 *   data: { type: 'delta', text: string }
 *   data: { type: 'done', messageId, captures, usage }
 *   data: { type: 'error', error: string }
 *
 * Authority : CLAUDE.md §3 features 1 + DISCOVERY tchat IA.
 */

import Anthropic from '@anthropic-ai/sdk'

import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'
export const maxDuration = 60

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL_MISSION ?? 'claude-haiku-4-5'
const MAX_HISTORY_MESSAGES = 16
const MAX_MESSAGE_LEN = 4000
const MAX_OUTPUT_TOKENS = 800

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ChatRequestBody {
  sessionId?: unknown
  message?: unknown
  /**
   * Si fourni : nom de la pièce actuellement sélectionnée par l'utilisateur
   * dans la sidebar pièces (lot MISSION-A). Contextualise le system prompt
   * pour que Claude rattache les données saisies à cette pièce par défaut.
   */
  activeRoomName?: unknown
}

interface MissionContext {
  dossierId: string
  diagnosticType: string
  reference: string
  clientName: string
  propertyType: string
  surfaceM2: number | null
  yearBuilt: number | null
  fullAddress: string
  city: string
  postalCode: string
  roomsCount: number
  roomsList: Array<{ name: string; surface_m2: number | null }>
  photosCount: number
  capturesByType: Record<string, number>
  localContext: string
}

interface PersistedMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ParsedCapture {
  capture_type:
    | 'room'
    | 'room_delete'
    | 'room_rename'
    | 'equipment'
    | 'observation'
    | 'photo_taken'
    | 'measurement'
    | 'item_delete'
  data: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function sse(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

function normalizeMessage(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, MAX_MESSAGE_LEN)
}

/**
 * Petit dictionnaire de contextes locaux par dept/grande ville.
 * Donne 1 ou 2 spécificités utiles à mentionner par l'IA.
 */
function inferLocalContext(city: string, postalCode: string): string {
  const dept = postalCode.slice(0, 2)
  const cityLower = city.toLowerCase()

  if (cityLower.includes('paris') || dept === '75') {
    return "Parc parisien majoritairement Haussmannien (1850-1914), murs porteurs épais, planchers bois, parties communes souvent fragiles. Présence amiante courante dans les colles de carrelage et dalles vinyle d'avant 1997."
  }
  if (cityLower.includes('marseille') || dept === '13') {
    return 'Climat méditerranéen humide en hiver, climatisation très répandue. Habitat collectif années 60-70 fréquent (présence amiante flocages probable).'
  }
  if (cityLower.includes('lyon') || dept === '69') {
    return 'Mix immeubles bourgeois fin XIXe + grands ensembles années 60-80. Chauffage urbain fréquent dans les zones requalifiées.'
  }
  if (cityLower.includes('lille') || dept === '59') {
    return 'Habitat ouvrier en briques (maisons "1930"), isolation thermique souvent faible (étiquettes E-G fréquentes), chauffage gaz dominant.'
  }
  if (cityLower.includes('bordeaux') || dept === '33') {
    return 'Échoppes bordelaises (maisons mitoyennes pierre 1850-1920) + immeubles classiques. Termites endémiques — vigilance accrue sur diagnostic termites obligatoire.'
  }
  if (cityLower.includes('toulouse') || dept === '31') {
    return 'Briques foraines locales, présence radon dans certaines zones, climatisation très répandue.'
  }
  if (dept === '76' || dept === '14' || dept === '50') {
    return 'Normandie : climat humide, vigilance moisissures murs nord et ventilation. Habitat tradition pierre/bois XIXe nombreux.'
  }
  return ''
}

/**
 * System prompt EXPERT MÉTIER — transforme Claude en VRAI assistant
 * diagnostiqueur (pas script bête).
 *
 * @param ctx Contexte mission chargé depuis la DB
 * @param activeRoomName Si fourni (sidebar pièces sélectionnée), Claude
 *   considère que par défaut toute donnée saisie s'applique à cette pièce.
 */
function buildMissionSystemPrompt(ctx: MissionContext, activeRoomName: string | null): string {
  const surfaceStr = ctx.surfaceM2 ? `${ctx.surfaceM2} m²` : 'surface à confirmer'
  const yearStr = ctx.yearBuilt ? `construit en ${ctx.yearBuilt}` : 'année de construction inconnue'
  const roomsStr =
    ctx.roomsList.length > 0
      ? ctx.roomsList
          .slice(0, 12)
          .map((r) => `${r.name}${r.surface_m2 ? ` (${r.surface_m2}m²)` : ''}`)
          .join(', ')
      : 'aucune'
  const capturesStr =
    Object.keys(ctx.capturesByType).length > 0
      ? Object.entries(ctx.capturesByType)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')
      : 'aucune capture'

  return [
    `Vous êtes l'assistant terrain d'un diagnostiqueur immobilier français qui réalise une mission **${ctx.diagnosticType}** sur le bien situé ${ctx.fullAddress}.`,
    '',
    '## Votre rôle',
    '1. **GUIDER** le diagnostiqueur pas à pas dans sa mission : ordre conseillé des pièces, points de contrôle, photos clés à prendre.',
    '2. **RÉPONDRE** à toutes ses questions terrain : méthodologie ADEME 3CL-2021, particularités locales, choix techniques, conseils pratiques, réglementation FR.',
    "3. **CAPTURER** les données structurées qu'il vous donne au fil de l'eau (pièces, surfaces, équipements, observations) en fin de réponse via le format CAPTURE (cf. section dédiée).",
    '',
    '## Contexte mission actuelle',
    `- Type diagnostic : **${ctx.diagnosticType}**`,
    `- Bien : ${ctx.propertyType} de ${surfaceStr}, ${yearStr}`,
    `- Adresse : ${ctx.fullAddress}`,
    `- Client : ${ctx.clientName}`,
    `- Référence dossier : ${ctx.reference}`,
    ctx.localContext ? `- Spécificités locales : ${ctx.localContext}` : '',
    `- Pièces déjà saisies (${ctx.roomsCount}) : ${roomsStr}`,
    `- Photos prises : ${ctx.photosCount}`,
    `- Captures cumulées : ${capturesStr}`,
    activeRoomName
      ? `- **Pièce active sélectionnée par l'utilisateur : "${activeRoomName}"** — toute donnée saisie s'applique par défaut à cette pièce, sauf indication contraire explicite ("dans le salon", "côté chambre", etc.).`
      : '',
    '',
    '## Style de réponse',
    '- Vouvoiement SOBRE PROFESSIONNEL (avatar diagnostiqueur 43 ans, ex-cadre).',
    '- Réponses CONCISES (max 3 phrases sauf si on vous demande explicitement plus de détail).',
    "- PAS d'emoji, JAMAIS.",
    '- Vocabulaire métier français : "pièce", "surface au sol", "menuiserie", "isolation", "ventilation", "déperdition", "ponts thermiques", "étiquette énergie".',
    '- Format markdown : **gras** pour les points clés, listes à puces pour énumérations, *italique* pour précisions méthodo.',
    '',
    '## Comportement attendu',
    '- Quand il pose une **question générale** ("par quoi commencer ?", "comment mesurer X", "que dit la réglementation sur Y") : RÉPONDEZ d\'abord clairement et utilement, PUIS proposez une suggestion d\'action concrète. Ne lancez JAMAIS dans un questionnaire scripté sans avoir d\'abord répondu.',
    '- Quand il vous **donne des données** ("Salon 22m² au RDC avec parquet et radiateur") : confirmez la saisie en 1 phrase + ajoutez la capture en fin de message + proposez la suite logique.',
    '- Quand il dit **"j\'ai pris une photo"** ou **"photo prise"** : confirmez + suggérez 1-2 angles complémentaires utiles + capturez `[CAPTURE: type=photo_taken room="X"]`.',
    '- Quand vous détectez une **incohérence** : signalez-la sobrement ("La surface 22.5m² semble grande pour une cuisine — pouvez-vous vérifier ?").',
    "- Quand la mission semble **complète** : récapitulez les pièces saisies + suggérez de vérifier les zones non couvertes (extérieur, dépendances) + proposez le passage à l'export.",
    '',
    '## Format CAPTURE (à la fin de votre réponse uniquement)',
    'Si vous avez identifié une donnée structurée à enregistrer, ajoutez en TOUTE FIN de message une ligne du format exact :',
    '`[CAPTURE: type=<type> key=value key="value avec espaces" key=number]`',
    '',
    'Types autorisés et clés conseillées :',
    '- `room` : `name="Salon" surface=22.5 floor=1 features=parquet,radiateur` (features séparées par virgules sans espace)',
    '- `room_delete` : `name="Salle à manger"` (supprime une pièce ajoutée par erreur)',
    '- `room_rename` : `from="Salon" to="Séjour"` (corrige le nom d\'une pièce existante)',
    '- `equipment` : `kind="chaudiere_gaz" room="Cuisine" age_years=8 brand="Saunier Duval" power_kw=24`',
    '- `observation` : `category="humidite" room="Salle de bain" severity="medium" note="trace plafond"`',
    '- `photo_taken` : `room="Salon" angle="vue_generale"`',
    '- `measurement` : `type="surface_carrez" room="Salon" value=22.5 unit="m2"`',
    '- `item_delete` : `room="Salon" kind="equipment" label="chaudiere gaz"` (supprime un élément — équipement/observation/mesure — saisi par erreur). `kind` parmi equipment/observation/mesure. `label` = mot-clé du résumé de l\'élément à retirer.',
    '',
    'IMPORTANT — `room_delete`, `room_rename` et `item_delete` ne doivent être émis QUE si le diagnostiqueur demande EXPLICITEMENT de supprimer ou renommer (ex : "supprime la salle à manger", "renomme le salon en séjour", "enlève la chaudière du salon, je me suis trompé"). Ne les émettez JAMAIS spontanément.',
    '',
    'Vous pouvez émettre 0, 1 ou 2 captures par réponse (jamais 3+). NE COMMENTEZ PAS la ligne CAPTURE — elle est invisible côté UI.',
    '',
    '## Règles strictes',
    "- N'inventez JAMAIS des chiffres absents du contexte ou de la conversation. Si une donnée manque, demandez-la.",
    '- Pour la réglementation, citez les références (arrêté DPE 3CL-2021, CCH L.271-4, RT2012, RE2020) sans inventer.',
    '- JAMAIS de phrases creuses style "Comment puis-je vous aider ?". Soyez utile concrètement.',
    '- En cas de question hors périmètre métier (politique, jokes, autre), recentrez sobrement sur la mission.',
    '',
    '## MISSION-E — Détection bruit vocal & incohérences',
    'Le message utilisateur peut contenir des fragments marqués `[inaudible — réécoutez]` ou des mots en *italique* (entre astérisques) : ces marqueurs signalent une transcription Whisper de faible confiance.',
    '- **`[inaudible]`** : la transcription a été rejetée. Ne capturez AUCUNE donnée numérique à proximité de ce marqueur ; demandez plutôt à l\'utilisateur de **réénoncer le segment** ("J\'ai entendu un passage incompréhensible pour la surface du salon, pouvez-vous me la redonner ?").',
    '- **`*texte incertain*`** : la transcription est douteuse. Si la valeur est cohérente (ex : `*22m²*` pour un salon), capturez-la mais signalez en clair la dépendance ("Salon noté à 22 m² — confirmez si besoin"). Si la valeur est manifestement incohérente (surface > 1000 m², classe DPE inexistante, année future), **NE CAPTUREZ PAS** et demandez clarification ("J\'ai entendu \'22 schtroumpf carrés\' pour la surface du salon. Ce n\'est pas clair. Pouvez-vous confirmer la surface en m² ?").',
    '- Bornes raisonnables : surface logement 1-1000 m² · année construction 1800-année actuelle · classe DPE A-G · hauteur sous plafond 1,5-6 m. Hors bornes = NE CAPTUREZ PAS, demandez clarification.',
  ]
    .filter(Boolean)
    .join('\n')
}

async function loadMissionContext(
  dossierId: string,
  sessionId: string,
): Promise<MissionContext | null> {
  const { supabase, orgId } = await getCurrentUser()

  type DossierRow = {
    id: string
    reference: string | null
    metadata: Record<string, unknown> | null
    properties: {
      address: string | null
      postal_code: string | null
      city: string | null
      surface_total: number | null
      year_built: number | null
      property_type: string | null
    } | null
    clients: { display_name: string | null } | null
  }

  const { data: dossierRaw } = await supabase
    .from('dossiers')
    .select(
      'id, reference, metadata, properties(address, postal_code, city, surface_total, year_built, property_type), clients(display_name)',
    )
    .eq('id', dossierId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!dossierRaw) return null
  const dossier = dossierRaw as unknown as DossierRow

  const property = Array.isArray(dossier.properties) ? dossier.properties[0] : dossier.properties
  const client = Array.isArray(dossier.clients) ? dossier.clients[0] : dossier.clients

  const city = property?.city ?? ''
  const postalCode = property?.postal_code ?? ''
  const fullAddress = property
    ? [property.address, [postalCode, city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    : 'adresse à confirmer'

  type RoomRow = { name: string | null; surface_m2: number | null }
  const { data: roomsRaw } = await supabase
    .from('dossier_rooms')
    .select('name, surface_m2')
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)
    .order('position', { ascending: true })

  const rooms: RoomRow[] = Array.isArray(roomsRaw) ? (roomsRaw as RoomRow[]) : []

  const { count: photosCount } = await supabase
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)

  type CaptureRow = { capture_type: string | null }
  const capturesRes = await supabase
    .from('mission_session_captures' as never)
    .select('capture_type')
    .eq('session_id', sessionId)

  const captures: CaptureRow[] = Array.isArray(capturesRes.data)
    ? (capturesRes.data as unknown as CaptureRow[])
    : []
  const capturesByType: Record<string, number> = {}
  for (const c of captures) {
    const t = c.capture_type ?? 'unknown'
    capturesByType[t] = (capturesByType[t] ?? 0) + 1
  }

  // Diagnostic type stocké dans metadata.diagnostic_type ou .type
  // (selon les versions de dossiers — fallback générique).
  const metadata = (dossier.metadata ?? {}) as Record<string, unknown>
  const diagnosticType =
    (typeof metadata.diagnostic_type === 'string' && metadata.diagnostic_type) ||
    (typeof metadata.type === 'string' && metadata.type) ||
    (Array.isArray(metadata.diagnostic_kinds) &&
      metadata.diagnostic_kinds.length > 0 &&
      typeof metadata.diagnostic_kinds[0] === 'string' &&
      String(metadata.diagnostic_kinds[0])) ||
    'DPE'

  return {
    dossierId,
    diagnosticType,
    reference: dossier.reference ?? 'DOS-???',
    clientName: client?.display_name ?? 'Client',
    propertyType: property?.property_type ?? 'logement',
    surfaceM2: property?.surface_total ?? null,
    yearBuilt: property?.year_built ?? null,
    fullAddress,
    city,
    postalCode,
    roomsCount: rooms.length,
    roomsList: rooms.map((r) => ({
      name: r.name ?? 'Pièce',
      surface_m2: r.surface_m2 ?? null,
    })),
    photosCount: photosCount ?? 0,
    capturesByType,
    localContext: inferLocalContext(city, postalCode),
  }
}

async function loadConversationHistory(sessionId: string): Promise<PersistedMessage[]> {
  const { supabase } = await getCurrentUser()

  type MsgRow = { role: string; content: string }
  // FIX (audit P1-6) : on veut les MAX_HISTORY_MESSAGES messages les plus
  // RÉCENTS (pas les plus anciens). Avant : `ascending: true` + limit prenait
  // les 16 PREMIERS → sur une mission longue (100+ msgs) Claude recevait
  // toujours le tout début et "oubliait" tout le contexte récent. On lit donc
  // en DESC (derniers d'abord) puis on ré-inverse pour l'ordre chronologique.
  const res = await supabase
    .from('mission_chat_messages' as never)
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_MESSAGES)

  const rows = Array.isArray(res.data) ? (res.data as unknown as MsgRow[]) : []
  return rows
    .filter(
      (r): r is { role: 'user' | 'assistant'; content: string } =>
        (r.role === 'user' || r.role === 'assistant') && typeof r.content === 'string',
    )
    .map((r) => ({ role: r.role, content: r.content }))
    .reverse() // remet l'ordre chronologique ASC pour le prompt Claude
}

/**
 * Parse les blocs [CAPTURE: ...] dans le texte assistant + retourne
 * le texte nettoyé (sans les blocs) + la liste des captures structurées.
 */
function extractCaptures(text: string): { clean: string; captures: ParsedCapture[] } {
  const captures: ParsedCapture[] = []
  // [CAPTURE: type=room name="Salon" surface=22.5 floor=1 features=parquet,radiateur]
  const re = /\[CAPTURE:\s*([^\]]+)\]/gi
  let clean = text

  let m: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex loop
  while ((m = re.exec(text)) !== null) {
    const body = m[1].trim()
    const parsed = parseCaptureBody(body)
    if (parsed) captures.push(parsed)
  }

  clean = clean.replace(re, '').trim()
  return { clean, captures }
}

function parseCaptureBody(body: string): ParsedCapture | null {
  // Match key=value or key="value avec espaces"
  const pairRe = /(\w+)\s*=\s*(?:"([^"]*)"|([^\s"]+))/g
  const data: Record<string, unknown> = {}
  let typeStr = ''

  let m: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex loop
  while ((m = pairRe.exec(body)) !== null) {
    const key = m[1]
    const value = m[2] ?? m[3] ?? ''
    if (key === 'type') {
      typeStr = value
      continue
    }
    // Coerce numbers if applicable
    const num = Number(value)
    if (!Number.isNaN(num) && value !== '' && /^[\d.,-]+$/.test(value)) {
      data[key] = Number(value.replace(',', '.'))
    } else if (value.includes(',')) {
      data[key] = value.split(',').map((v) => v.trim())
    } else {
      data[key] = value
    }
  }

  const allowed: ParsedCapture['capture_type'][] = [
    'room',
    'room_delete',
    'room_rename',
    'equipment',
    'observation',
    'photo_taken',
    'measurement',
    'item_delete',
  ]
  if (!allowed.includes(typeStr as ParsedCapture['capture_type'])) return null
  return { capture_type: typeStr as ParsedCapture['capture_type'], data }
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dossierId: string }> },
): Promise<Response> {
  const { dossierId } = await params

  // Auth — redirect si non connecté.
  await getCurrentUser()

  let payload: ChatRequestBody
  try {
    payload = (await request.json()) as ChatRequestBody
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const userMessage = normalizeMessage(payload.message)
  if (userMessage.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_message' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : ''
  if (sessionId.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_session_id' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  // Pièce active optionnelle (lot MISSION-A — sidebar pièces).
  const activeRoomName =
    typeof payload.activeRoomName === 'string' && payload.activeRoomName.trim().length > 0
      ? payload.activeRoomName.trim().slice(0, 120)
      : null

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: 'anthropic_not_configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })
  }

  const ctx = await loadMissionContext(dossierId, sessionId)
  if (!ctx) {
    return new Response(JSON.stringify({ ok: false, error: 'dossier_not_found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  }

  const history = await loadConversationHistory(sessionId)
  const { supabase } = await getCurrentUser()

  // INSERT message utilisateur
  // biome-ignore lint/suspicious/noExplicitAny: mission_chat_messages not yet in generated types
  await (supabase as any).from('mission_chat_messages').insert({
    session_id: sessionId,
    role: 'user',
    content: userMessage,
  })

  const systemPrompt = buildMissionSystemPrompt(ctx, activeRoomName)
  const anthropic = new Anthropic({ apiKey })

  const messagesForApi = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user' as const, content: userMessage },
  ]

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = ''
      let inputTokens = 0
      let outputTokens = 0
      try {
        const anthropicStream = anthropic.messages.stream({
          model: DEFAULT_MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: messagesForApi,
        })

        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const delta = event.delta.text
            assistantText += delta
            // On stream tout sauf qu'on évitera d'envoyer les fragments [CAPTURE:
            // au client final — c'est filtré côté client à l'affichage.
            controller.enqueue(sse({ type: 'delta', text: delta }))
          }
        }

        const finalMessage = await anthropicStream.finalMessage()
        inputTokens = finalMessage.usage.input_tokens
        outputTokens = finalMessage.usage.output_tokens

        // Parse captures + clean
        const { clean, captures } = extractCaptures(assistantText)

        // INSERT message assistant
        // biome-ignore lint/suspicious/noExplicitAny: mission_chat_messages not yet in generated types
        const insertRes = await (supabase as any)
          .from('mission_chat_messages')
          .insert({
            session_id: sessionId,
            role: 'assistant',
            content: clean,
            content_markdown: clean,
            metadata: { captures_count: captures.length },
            tokens_in: inputTokens,
            tokens_out: outputTokens,
            model: DEFAULT_MODEL,
          })
          .select('id')
          .single()

        const messageId = (insertRes.data as { id?: string } | null)?.id ?? null

        if (captures.length > 0) {
          // biome-ignore lint/suspicious/noExplicitAny: mission_session_captures not yet in generated types
          await (supabase as any).from('mission_session_captures').insert(
            captures.map((c) => ({
              session_id: sessionId,
              capture_type: c.capture_type,
              data: c.data,
              source_message_id: messageId,
            })),
          )
        }

        controller.enqueue(
          sse({
            type: 'done',
            messageId,
            captures: captures.map((c) => ({ type: c.capture_type, data: c.data })),
            usage: { input_tokens: inputTokens, output_tokens: outputTokens },
          }),
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'streaming_error'
        controller.enqueue(sse({ type: 'error', error: message }))
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
