/**
 * KOVAS — Edge Function : generate-premium-client-report (Upsell #1 Tugan v3.0).
 *
 * Endpoint POST /functions/v1/generate-premium-client-report
 *
 * Trigger automatique : appelée depuis le webhook applicatif `mission.completed`
 * lorsque le user a l'addon `premium_reports` actif (status 'active' ou 'trialing'
 * dans la table `user_addon_subscriptions`).
 *
 * Auth :
 *   - Bearer CRON_SECRET (appel cron/webhook serveur)
 *   - OU JWT user authenticated (appel manuel depuis l'app via supabase.functions.invoke)
 *
 * Workflow :
 *   1. Parse body { mission_id, force? }
 *   2. Vérifie l'addon `premium_reports` actif sur le user propriétaire de la mission
 *   3. Charge la mission complète : property, client, photos, mesures, rooms, reco
 *   4. Construit le system prompt via buildPremiumReportSystemPrompt() (dupliqué inline,
 *      cf. limitation Deno qui ne peut pas importer le module Next.js apps/web)
 *   5. Appelle l'API Anthropic (claude-sonnet-4-5) avec ~3500 input + 1800 output tokens
 *   6. Parse le JSON retourné (intro / par_piece[] / recommandations[] / conclusion)
 *   7. INSERT dans `premium_reports_generated` (pdf_url = placeholder V1, ai_cost_eur)
 *   8. Retourne { content: PremiumReportContent, report_id, pdf_url, ai_cost_eur }
 *
 * V1 NOTE : la génération PDF physique se fait côté Next.js — ce endpoint
 * retourne uniquement le contenu JSON. Le caller (front ou worker) appelle
 * ensuite `renderToStaticMarkup(<PremiumClientReport content=... />)` puis
 * un pipeline HTML→PDF (Playwright headless recommandé). Le `pdf_url` retourné
 * ici est donc un placeholder qui sera mis à jour par un PATCH ultérieur sur
 * la row `premium_reports_generated`.
 *
 * Variables d'env requises :
 *   - SUPABASE_URL                 (plateforme)
 *   - SUPABASE_SERVICE_ROLE_KEY    (plateforme)
 *   - CRON_SECRET                  (Bearer token cron, à provisionner)
 *   - ANTHROPIC_API_KEY            (clé API du fournisseur cloud)
 *
 * Variables d'env optionnelles :
 *   - PREMIUM_REPORT_MODEL         (défaut: "claude-sonnet-4-5")
 *   - APP_URL                      (défaut: "https://kovas.fr")
 *
 * AUCUNE mention de provider IA tiers dans les variables visibles (cost_eur,
 * aiCostEur, aiContent — pas claudeContent / whisperCost / anthropicResponse).
 * Le model name reste configurable via env pour swap futur (Haiku, Llama, etc.).
 *
 * Authority : CLAUDE.md §3 (focus 8 diagnostics) + brief Upsell #1 Premium Reports
 * 2026-05-26 + pattern Edge Function `process-trial-emails-tugan` (cf. cf4f25e).
 */

// @ts-nocheck — Deno-only Edge Function ; non compilée par tsc Node.

import { createClient } from 'jsr:@supabase/supabase-js@2'

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Constantes                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

const DEFAULT_MODEL = 'claude-sonnet-4-5'
const MAX_INPUT_TOKENS = 3500
const MAX_OUTPUT_TOKENS = 1800

/** Coûts en €/M tokens (model claude-sonnet-4-5, refs 2026-05). */
const COST_PER_M_TOKENS_INPUT_EUR = 2.7
const COST_PER_M_TOKENS_OUTPUT_EUR = 13.5

/** Slug de l'addon premium_reports (cf. user_addon_subscriptions.addon_slug). */
const ADDON_SLUG = 'premium_reports'

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

interface RequestBody {
  mission_id?: string
  force?: boolean
}

interface MissionRow {
  id: string
  user_id: string
  reference: string | null
  type: string | null
  property_id: string | null
  client_id: string | null
  dpe_letter: string | null
  ges_letter: string | null
  metadata: Record<string, unknown> | null
  completed_at: string | null
}

interface PropertyRow {
  id: string
  address_line1: string | null
  postal_code: string | null
  city: string | null
  surface_m2: number | null
  construction_year: number | null
}

interface ClientRow {
  id: string
  full_name: string | null
  email: string | null
}

interface ProfileRow {
  id: string
  full_name: string | null
  cert_number: string | null
}

interface PremiumReportRoomSection {
  nom_piece: string
  paragraphe: string
  alertes: string[]
}

interface PremiumReportRecommendation {
  priorite: 1 | 2 | 3
  titre: string
  description: string
  cout_estime_eur: number | null
  economies_annuelles_eur: number | null
  payback_annees: number | null
  aides_publiques: string | null
}

interface PremiumReportContent {
  intro: string
  par_piece: PremiumReportRoomSection[]
  recommandations: PremiumReportRecommendation[]
  conclusion: string
}

interface GenerationOutcome {
  ok: true
  content: PremiumReportContent
  inputTokens: number
  outputTokens: number
  aiCostEur: number
}

interface GenerationFailure {
  ok: false
  error: string
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Utility — réponses HTTP                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helper exporté : assertAddonActive                                          */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Vérifie qu'un user a l'addon `premium_reports` en statut 'active' ou 'trialing'.
 * Retourne `true` si l'addon est valide, `false` sinon (à propager en 403 par
 * le caller — pas d'exception).
 */
export async function assertAddonActive(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_addon_subscriptions')
    .select('id, status, current_period_end')
    .eq('user_id', userId)
    .eq('addon_slug', ADDON_SLUG)
    .in('status', ['active', 'trialing'])
    .gt('current_period_end', new Date().toISOString())
    .maybeSingle()

  if (error) {
    console.error('[generate-premium-client-report] assertAddonActive DB error', error)
    return false
  }
  return Boolean(data)
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helper exporté : computeAiCostEur                                           */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Calcule le coût en euros d'un appel au rédacteur cloud, basé sur les tokens
 * input et output retournés par l'API. Utilise les tarifs claude-sonnet-4-5
 * 2026-05 (2,70 €/M input + 13,50 €/M output).
 */
export function computeAiCostEur(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * COST_PER_M_TOKENS_INPUT_EUR
  const outputCost = (outputTokens / 1_000_000) * COST_PER_M_TOKENS_OUTPUT_EUR
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000 // 6 décimales
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helper inline : buildPremiumReportSystemPrompt                              */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Version Deno-friendly du builder de system prompt. DUPLIQUE
 * `apps/web/src/lib/ai/system-prompts/premium-report.ts` car Deno ne peut pas
 * importer le module Next.js (paths + tsconfig différents). La source de vérité
 * reste le fichier Next.js — toute modification doit être synchronisée ici.
 */
function buildPremiumReportSystemPrompt(context: {
  missionType?: string
  missionReference?: string
  ownerName?: string
  propertyAddress?: string
  surfaceM2?: number
  constructionYear?: number
  dpeLetter?: string
  gesLetter?: string
  conformityScore?: number
  roomsCount?: number
  photosCount?: number
  diagnostiqueurName?: string
  diagnostiqueurCertNumber?: string
}): string {
  const lines: string[] = []
  const missionLabel = context.missionType ? MISSION_TYPE_LABEL[context.missionType] : undefined

  if (missionLabel) lines.push(`- Type de diagnostic : ${missionLabel}`)
  if (context.missionReference) lines.push(`- Référence mission : ${context.missionReference}`)
  if (context.ownerName) lines.push(`- Propriétaire : ${context.ownerName}`)
  if (context.propertyAddress) lines.push(`- Adresse du bien : ${context.propertyAddress}`)
  if (typeof context.surfaceM2 === 'number') {
    lines.push(`- Surface utile : ${context.surfaceM2} m²`)
  }
  if (typeof context.constructionYear === 'number') {
    lines.push(`- Année de construction : ${context.constructionYear}`)
  }
  if (context.dpeLetter) lines.push(`- Étiquette DPE : ${context.dpeLetter}`)
  if (context.gesLetter) lines.push(`- Étiquette GES : ${context.gesLetter}`)
  if (typeof context.conformityScore === 'number') {
    lines.push(`- Score de conformité KOVAS : ${context.conformityScore} / 100`)
  }
  if (typeof context.roomsCount === 'number') {
    lines.push(`- Nombre de pièces saisies : ${context.roomsCount}`)
  }
  if (typeof context.photosCount === 'number') {
    lines.push(`- Nombre de photos disponibles : ${context.photosCount}`)
  }
  if (context.diagnostiqueurName) lines.push(`- Diagnostiqueur : ${context.diagnostiqueurName}`)
  if (context.diagnostiqueurCertNumber) {
    lines.push(`- Certification diagnostiqueur : ${context.diagnostiqueurCertNumber}`)
  }

  const contextBlock =
    lines.length > 0
      ? `Données contextuelles de la mission :\n${lines.join('\n')}`
      : 'Aucune donnée contextuelle fournie — produire un squelette générique ' +
        'avec mentions "à confirmer avec le diagnostiqueur" sur tous les chiffres.'

  const mprBlock =
    context.dpeLetter === 'F' || context.dpeLetter === 'G'
      ? `IMPORTANT : le bien est classé DPE ${context.dpeLetter} (passoire énergétique). ` +
        "Vous devez MENTIONNER explicitement MaPrimeRénov' dans les recommandations de priorité 1, " +
        'en indiquant que des aides publiques peuvent couvrir 35 à 90 % du coût des travaux selon ' +
        'les revenus du foyer. Inviter le propriétaire à faire réaliser un audit énergétique pour ' +
        "calculer le parcours travaux optimal et débloquer le forfait Rénovation d'ampleur."
      : "Si vous mentionnez des aides publiques (MaPrimeRénov', éco-PTZ, CEE), restez factuel et " +
        "invitez le propriétaire à se rapprocher d'un opérateur agréé pour vérifier son éligibilité."

  return `Vous êtes un assistant rédacteur expert en diagnostics immobiliers français.
Vous rédigez un rapport PDF haut de gamme destiné au PROPRIÉTAIRE (client final du
diagnostiqueur). VOUVOIEMENT obligatoire. Ton sobre, pédagogique, sans emojis.

CONTRAINTES :
- Recommandations CHIFFRÉES (euros, payback) — n'inventez JAMAIS un chiffre absent.
- Pas de jargon technique brut sans reformulation.
- Aucune mention de marque logicielle ni de fournisseur IA.
- Retour JSON STRICT (sans markdown autour) :

{
  "intro": "string ~250 mots",
  "par_piece": [{ "nom_piece": "string", "paragraphe": "string ~120 mots", "alertes": ["string"] }],
  "recommandations": [{ "priorite": 1|2|3, "titre": "string", "description": "string ~80 mots", "cout_estime_eur": number|null, "economies_annuelles_eur": number|null, "payback_annees": number|null, "aides_publiques": "string|null" }],
  "conclusion": "string ~150 mots"
}

${mprBlock}

${contextBlock}

Produisez maintenant le JSON de sortie.`
}

const MISSION_TYPE_LABEL: Record<string, string> = {
  dpe_vente: 'Diagnostic de Performance Énergétique (vente)',
  dpe_location: 'Diagnostic de Performance Énergétique (location)',
  amiante_vente: 'État Amiante (vente)',
  amiante_avant_travaux: 'Repérage Amiante avant travaux',
  plomb_crep: "Constat de Risque d'Exposition au Plomb (CREP)",
  gaz: 'État des installations de gaz',
  electricite: 'État des installations électriques',
  termites: 'État Termites',
  carrez_boutin: 'Mesurage Loi Carrez / Boutin',
  erp: 'État des Risques et Pollutions (ERP)',
  copropriete: 'Diagnostic Copropriété',
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Chargement mission + property + client + diagnostiqueur                    */
/* ─────────────────────────────────────────────────────────────────────────── */

async function loadMissionContext(
  supabase: ReturnType<typeof createClient>,
  missionId: string,
): Promise<{
  mission: MissionRow
  property: PropertyRow | null
  client: ClientRow | null
  diagnostiqueur: ProfileRow | null
  roomsCount: number
  photosCount: number
  conformityScore: number | null
} | null> {
  const { data: mission, error } = await supabase
    .from('missions')
    .select(
      'id, user_id, reference, type, property_id, client_id, dpe_letter, ges_letter, metadata, completed_at',
    )
    .eq('id', missionId)
    .maybeSingle()

  if (error || !mission) {
    console.error('[generate-premium-client-report] mission not found', missionId, error)
    return null
  }

  const m = mission as MissionRow

  const [propertyRes, clientRes, profileRes, roomsCountRes, photosCountRes] = await Promise.all([
    m.property_id
      ? supabase
          .from('properties')
          .select('id, address_line1, postal_code, city, surface_m2, construction_year')
          .eq('id', m.property_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    m.client_id
      ? supabase.from('clients').select('id, full_name, email').eq('id', m.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('profiles')
      .select('id, full_name, cert_number')
      .eq('id', m.user_id)
      .maybeSingle(),
    supabase
      .from('mission_rooms')
      .select('id', { count: 'exact', head: true })
      .eq('mission_id', missionId),
    supabase
      .from('mission_photos')
      .select('id', { count: 'exact', head: true })
      .eq('mission_id', missionId),
  ])

  const conformityScore =
    typeof m.metadata?.conformity_score === 'number'
      ? (m.metadata.conformity_score as number)
      : null

  return {
    mission: m,
    property: (propertyRes.data ?? null) as PropertyRow | null,
    client: (clientRes.data ?? null) as ClientRow | null,
    diagnostiqueur: (profileRes.data ?? null) as ProfileRow | null,
    roomsCount: (roomsCountRes as { count?: number | null }).count ?? 0,
    photosCount: (photosCountRes as { count?: number | null }).count ?? 0,
    conformityScore,
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Appel au rédacteur cloud (Anthropic API)                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

async function generateNarrativeContent(args: {
  apiKey: string
  model: string
  systemPrompt: string
}): Promise<GenerationOutcome | GenerationFailure> {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': args.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: args.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: args.systemPrompt,
        messages: [
          {
            role: 'user',
            content:
              'Produisez maintenant le JSON de sortie complet pour ce rapport, en respectant le schéma indiqué.',
          },
        ],
      }),
    })

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      return { ok: false, error: `cloud_${resp.status}: ${detail.slice(0, 300)}` }
    }

    const payload = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>
      usage?: { input_tokens?: number; output_tokens?: number }
    }

    const textBlock = (payload.content ?? []).find((b) => b.type === 'text')?.text ?? ''
    if (!textBlock) {
      return { ok: false, error: 'cloud_empty_response' }
    }

    // Le rédacteur peut entourer le JSON de markdown malgré l'instruction —
    // on extrait défensivement.
    const jsonMatch = textBlock.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { ok: false, error: `cloud_no_json: ${textBlock.slice(0, 200)}` }
    }

    let parsed: PremiumReportContent
    try {
      parsed = JSON.parse(jsonMatch[0]) as PremiumReportContent
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : 'parse_error'
      return { ok: false, error: `cloud_invalid_json: ${msg.slice(0, 200)}` }
    }

    if (
      !parsed.intro ||
      !Array.isArray(parsed.par_piece) ||
      !Array.isArray(parsed.recommandations)
    ) {
      return { ok: false, error: 'cloud_invalid_schema' }
    }

    const inputTokens = payload.usage?.input_tokens ?? 0
    const outputTokens = payload.usage?.output_tokens ?? 0
    const aiCostEur = computeAiCostEur(inputTokens, outputTokens)

    return {
      ok: true,
      content: parsed,
      inputTokens,
      outputTokens,
      aiCostEur,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 300) : 'cloud_network_error',
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Entry point — Deno.serve                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  const model = Deno.env.get('PREMIUM_REPORT_MODEL') ?? DEFAULT_MODEL

  if (!supabaseUrl || !serviceRole || !anthropicApiKey) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }

  // Auth : Bearer CRON_SECRET OU JWT user (Supabase plate-forme injecte le JWT
  // dans Authorization si appel via supabase.functions.invoke côté front).
  const auth = req.headers.get('Authorization') ?? ''
  const isCronCall = cronSecret && auth === `Bearer ${cronSecret}`
  const isUserJwt = auth.startsWith('Bearer ') && auth !== `Bearer ${cronSecret}`

  if (!isCronCall && !isUserJwt) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  // Parse body
  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'invalid_json_body' }, 400)
  }

  if (!body.mission_id || typeof body.mission_id !== 'string') {
    return jsonResponse({ error: 'missing_mission_id' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Charge la mission + propriété + client + diagnostiqueur
  const ctx = await loadMissionContext(supabase, body.mission_id)
  if (!ctx) {
    return jsonResponse({ error: 'mission_not_found' }, 404)
  }

  // 2. Vérifie l'addon `premium_reports` actif sur le user
  const hasAddon = await assertAddonActive(supabase, ctx.mission.user_id)
  if (!hasAddon && !body.force) {
    return jsonResponse({ error: 'premium_reports_addon_not_active' }, 403)
  }

  // 3. Construit le system prompt
  const propertyAddress = ctx.property
    ? [ctx.property.address_line1, ctx.property.postal_code, ctx.property.city]
        .filter((s): s is string => Boolean(s))
        .join(', ')
    : undefined

  const systemPrompt = buildPremiumReportSystemPrompt({
    missionType: ctx.mission.type ?? undefined,
    missionReference: ctx.mission.reference ?? undefined,
    ownerName: ctx.client?.full_name ?? undefined,
    propertyAddress,
    surfaceM2: ctx.property?.surface_m2 ?? undefined,
    constructionYear: ctx.property?.construction_year ?? undefined,
    dpeLetter: ctx.mission.dpe_letter ?? undefined,
    gesLetter: ctx.mission.ges_letter ?? undefined,
    conformityScore: ctx.conformityScore ?? undefined,
    roomsCount: ctx.roomsCount,
    photosCount: ctx.photosCount,
    diagnostiqueurName: ctx.diagnostiqueur?.full_name ?? undefined,
    diagnostiqueurCertNumber: ctx.diagnostiqueur?.cert_number ?? undefined,
  })

  // 4. Appelle le rédacteur cloud
  const generation = await generateNarrativeContent({
    apiKey: anthropicApiKey,
    model,
    systemPrompt,
  })

  if (!generation.ok) {
    return jsonResponse(
      {
        error: 'generation_failed',
        detail: generation.error,
      },
      502,
    )
  }

  // 5. INSERT row dans premium_reports_generated (pdf_url = placeholder V1)
  const placeholderPdfUrl = `pending://mission/${ctx.mission.id}`
  const { data: inserted, error: insertErr } = await supabase
    .from('premium_reports_generated')
    .insert({
      mission_id: ctx.mission.id,
      user_id: ctx.mission.user_id,
      pdf_url: placeholderPdfUrl,
      ai_cost_eur: generation.aiCostEur,
    })
    .select('id, generated_at')
    .single()

  if (insertErr) {
    console.error('[generate-premium-client-report] insert error', insertErr)
    return jsonResponse(
      {
        error: 'insert_failed',
        detail: insertErr.message.slice(0, 300),
        // Le contenu est quand même retourné pour ne pas perdre les tokens facturés.
        content: generation.content,
        aiCostEur: generation.aiCostEur,
      },
      500,
    )
  }

  return jsonResponse({
    ok: true,
    reportId: (inserted as { id: string }).id,
    generatedAt: (inserted as { generated_at: string }).generated_at,
    pdfUrl: placeholderPdfUrl,
    content: generation.content,
    aiCostEur: generation.aiCostEur,
    tokens: {
      input: generation.inputTokens,
      output: generation.outputTokens,
    },
    model,
  })
})
