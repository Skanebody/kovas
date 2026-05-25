/**
 * KOVAS — Edge Function : refresh-guides-content (Lot B65).
 *
 * Pipeline IA d'auto-update des 9 guides longs `/guide/[type]` :
 *   1. Sélection des N prochains guide_slug à rafraîchir
 *      (RPC `internal.guides_pick_next_for_refresh`, rotation par date).
 *   2. Fetch sources externes officielles (ADEME, INSEE, DHUP, Géorisques,
 *      Légifrance) via WebSearch API ou Anthropic web_search tool.
 *      Mocké si `sources_text` fourni en input (tests / dry-run).
 *   3. Extraction chiffres clés via Claude Haiku (cheap, cascade B47).
 *   4. Régénération du draft Markdown via Claude Sonnet
 *      (system prompt avec prompt caching ephemeral, B47/AI_ECONOMICS T1).
 *   5. INSERT dans `internal.guide_refresh_queue` (status='draft_ready').
 *   6. Notification admin via Resend → validation manuelle sur
 *      `/admin/guides-refresh`.
 *
 * Cron suggéré : `0 4 * * 1` (lundi 04h UTC, hebdo, 3 guides à la fois →
 * couvre les 9 guides en 3 semaines en moyenne avec rotation).
 *
 * Throttling : max 3 guides par invocation (configurable via body.limit).
 * Budget IA : ~0,015 € / guide (Haiku extraction + Sonnet cached generation).
 *
 * Auth : Bearer SERVICE_ROLE_KEY OU header `x-cron-secret`.
 *
 * Body POST optionnel :
 *   {
 *     limit?: number,             // 1..3, defaults to 3
 *     guide_slug?: string,        // override rotation, force un slug
 *     sources_text?: string,      // mock sources (tests / dry-run)
 *     dry_run?: boolean,          // n'insère pas, retourne juste le draft
 *   }
 *
 * Pricing snapshot 2026-05 :
 *   - Haiku 4.5 : 1 $/Mtok input, 5 $/Mtok output
 *   - Sonnet 4.6 : 3 $/Mtok input, 15 $/Mtok output (cache_read : 0,30 $/Mtok)
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ----------------------------------------------------------------------------
// Configuration & secrets
// ----------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const ANTHROPIC_HAIKU_MODEL = Deno.env.get('ANTHROPIC_HAIKU_MODEL') ?? 'claude-haiku-4-5'
const ANTHROPIC_SONNET_MODEL = Deno.env.get('ANTHROPIC_SONNET_MODEL') ?? 'claude-sonnet-4-6'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'KOVAS <contact@kovas.fr>'
const ADMIN_NOTIFY_EMAIL = Deno.env.get('GUIDES_ADMIN_NOTIFY_EMAIL') ?? 'contact@kovas.fr'
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const USD_TO_EUR = Number.parseFloat(Deno.env.get('USD_TO_EUR_RATE') ?? '0.92')

// Pricing snapshot 2026-05 (USD per Mtok)
const HAIKU_INPUT_USD = 1
const HAIKU_OUTPUT_USD = 5
const SONNET_INPUT_USD = 3
const SONNET_OUTPUT_USD = 15
const SONNET_CACHE_READ_USD = 0.3 // cache hit pricing
const SONNET_CACHE_WRITE_USD = 3.75 // cache write 25% premium

// Throttling
const DEFAULT_LIMIT = 3
const MAX_LIMIT = 3

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type GuideSlug =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'carrez'
  | 'erp'
  | 'audit-energetique'

interface ExternalSource {
  readonly title: string
  readonly url: string
  readonly organization: string
  readonly published_at: string | null
  readonly excerpt: string
}

interface KeyFigure {
  readonly figure: string
  readonly context: string
  readonly source_url: string
  readonly source_org: string
}

interface DraftContent {
  readonly title: string
  readonly content_md: string
  readonly schema_org_jsonld: Record<string, unknown>
  readonly meta_title: string
  readonly meta_description: string
  readonly word_count: number
  readonly sources_count: number
}

interface ClaudeResponse {
  content: Array<{ type: string; text?: string }>
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  stop_reason: string
}

interface RefreshResult {
  guide_slug: GuideSlug
  ok: boolean
  draft_id?: string
  error?: string
  word_count?: number
  sources_count?: number
  cost_eur?: number
}

// ----------------------------------------------------------------------------
// Sources externes officielles autorisées (méthode E-E-A-T stricte)
// ----------------------------------------------------------------------------

const ALLOWED_SOURCE_DOMAINS: ReadonlyArray<{ domain: string; org: string }> = [
  { domain: 'ademe.fr', org: 'ADEME' },
  { domain: 'observatoire-dpe.ademe.fr', org: 'ADEME' },
  { domain: 'insee.fr', org: 'INSEE' },
  { domain: 'ecologie.gouv.fr', org: 'Ministère de la Transition écologique' },
  { domain: 'dhup.fr', org: 'DHUP' },
  { domain: 'logement.gouv.fr', org: 'DHUP' },
  { domain: 'georisques.gouv.fr', org: 'Géorisques (BRGM/MTE)' },
  { domain: 'legifrance.gouv.fr', org: 'Légifrance' },
  { domain: 'service-public.fr', org: 'Service-Public.fr' },
  { domain: 'anil.org', org: 'ANIL' },
  { domain: 'cofrac.fr', org: 'COFRAC' },
  { domain: 'maprimerenov.gouv.fr', org: 'France Rénov' },
  { domain: 'francerenov.gouv.fr', org: 'France Rénov' },
  { domain: 'consuel.com', org: 'Consuel' },
]

function isSourceAllowed(url: string): { ok: boolean; org: string } {
  try {
    const host = new URL(url).hostname.toLowerCase()
    for (const a of ALLOWED_SOURCE_DOMAINS) {
      if (host === a.domain || host.endsWith(`.${a.domain}`)) {
        return { ok: true, org: a.org }
      }
    }
    return { ok: false, org: '' }
  } catch {
    return { ok: false, org: '' }
  }
}

// ----------------------------------------------------------------------------
// Topics par guide_slug (alimentent les recherches web)
// ----------------------------------------------------------------------------

const GUIDE_TOPICS: Readonly<
  Record<GuideSlug, { title: string; topic: string; keywords: string[] }>
> = Object.freeze({
  dpe: {
    title: 'Diagnostic de Performance Énergétique (DPE)',
    topic: 'DPE 2026 évolutions réglementaires méthode 3CL classes énergétiques',
    keywords: [
      'DPE 2026',
      'méthode 3CL-2021',
      'passoires thermiques',
      'audit énergétique obligatoire',
      'classe G interdite',
    ],
  },
  amiante: {
    title: 'Diagnostic Amiante',
    topic: 'Diagnostic amiante 2026 obligations DTA DAPP repérage',
    keywords: ['DTA copropriété', 'DAPP', 'repérage amiante', 'liste A B C', 'amiante avant 1997'],
  },
  plomb: {
    title: "Constat de Risque d'Exposition au Plomb (CREP)",
    topic: 'CREP plomb 2026 obligations bailleurs vente location',
    keywords: ['CREP plomb', 'seuil 1 mg/cm²', 'travaux plomb obligation', 'logements 1949'],
  },
  gaz: {
    title: 'Diagnostic Gaz',
    topic: 'Diagnostic gaz 2026 installations intérieures DPGE validité',
    keywords: ['diagnostic gaz 15 ans', 'DPGE', 'Qualigaz', 'tubage', 'aération'],
  },
  electricite: {
    title: 'Diagnostic Électrique',
    topic: 'Diagnostic électrique 2026 installations intérieures Consuel',
    keywords: [
      'diagnostic électrique',
      'AGCP',
      'DDR 30 mA',
      'liaisons équipotentielles',
      'Consuel',
    ],
  },
  termites: {
    title: 'Diagnostic Termites',
    topic: 'Diagnostic termites 2026 arrêtés préfectoraux zones obligation',
    keywords: ['arrêté préfectoral termites', 'zones termites', 'mérule', 'insectes xylophages'],
  },
  carrez: {
    title: 'Loi Carrez',
    topic: 'Loi Carrez 2026 calcul surface privative copropriété',
    keywords: ['surface Carrez', 'loi Boutin', 'hauteur 1,80m', 'parties communes exclues'],
  },
  erp: {
    title: 'État des Risques et Pollutions (ERP)',
    topic: 'ERP état risques pollutions 2026 zones naturelles technologiques',
    keywords: ['ERP', 'Géorisques', 'PPRN', 'PPRT', 'radon', 'sismique', 'mouvements terrain'],
  },
  'audit-energetique': {
    title: 'Audit Énergétique',
    topic: 'Audit énergétique 2026 monopropriétés F G scénarios travaux',
    keywords: [
      'audit énergétique obligatoire',
      'classes F G E',
      'scénarios travaux',
      'MaPrimeRénov',
    ],
  },
})

// ----------------------------------------------------------------------------
// 1. Fetch sources externes (mock-friendly)
// ----------------------------------------------------------------------------

/**
 * Fetch des sources externes officielles. Si `sourcesText` est fourni
 * (mode mock/dry-run), on parse simplement et on skip l'appel réseau.
 *
 * Sinon : on délègue à Claude Haiku via le tool web_search (uniquement
 * domaines autorisés via `allowed_domains`). Filtré strictement via
 * `isSourceAllowed()` pour bloquer toute source non-officielle.
 */
async function fetchExternalSources(
  guide: { slug: GuideSlug; title: string; topic: string; keywords: string[] },
  sourcesText: string | null,
): Promise<{
  sources: ExternalSource[]
  raw_text: string
  tokens: { input: number; output: number; cost_eur: number }
}> {
  if (sourcesText) {
    // Mode mock : on parse les lignes "Title | URL | Org | Date" depuis sourcesText
    const sources: ExternalSource[] = []
    for (const line of sourcesText.split('\n')) {
      const parts = line.split('|').map((p) => p.trim())
      if (parts.length < 3) continue
      const [title, url, org, date] = parts
      const check = isSourceAllowed(url)
      if (!check.ok) continue
      sources.push({
        title,
        url,
        organization: org || check.org,
        published_at: date || null,
        excerpt: title,
      })
    }
    return { sources, raw_text: sourcesText, tokens: { input: 0, output: 0, cost_eur: 0 } }
  }

  // Mode prod : web_search via Claude Haiku (cheap + filtré aux domaines officiels)
  const allowedDomains = ALLOWED_SOURCE_DOMAINS.map((a) => a.domain)
  const userPrompt = `Recherchez 5 à 10 sources OFFICIELLES françaises (ADEME, INSEE, DHUP, Géorisques, Légifrance, Service-Public) publiées dans les 12 derniers mois sur le sujet suivant :

SUJET : ${guide.topic}
MOTS-CLÉS : ${guide.keywords.join(', ')}

Pour chaque source, renvoyez UNIQUEMENT du JSON valide au format :
[
  {
    "title": "Titre exact de la page",
    "url": "https://...",
    "organization": "ADEME | INSEE | DHUP | Légifrance | ...",
    "published_at": "YYYY-MM-DD ou null",
    "excerpt": "1-2 phrases factuelles avec chiffres si possibles"
  }
]

RÈGLE STRICTE : JAMAIS de blog, wiki, presse généraliste. UNIQUEMENT les domaines : ${allowedDomains.join(', ')}.
Si vous trouvez moins de 5 sources, c'est OK — retournez ce que vous avez.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_HAIKU_MODEL,
        max_tokens: 2000,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 6,
            allowed_domains: allowedDomains,
          },
        ],
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      console.error('[refresh-guides] web_search failed:', response.status, await response.text())
      return { sources: [], raw_text: '', tokens: { input: 0, output: 0, cost_eur: 0 } }
    }

    const data = (await response.json()) as ClaudeResponse
    const text = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n')

    // Parse le JSON renvoyé (Claude peut entourer de ```json … ```)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    let parsed: any[] = []
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch (err) {
        console.error('[refresh-guides] sources JSON parse failed:', err)
      }
    }

    const sources: ExternalSource[] = []
    for (const item of parsed) {
      if (!item?.url || !item?.title) continue
      const check = isSourceAllowed(String(item.url))
      if (!check.ok) continue
      sources.push({
        title: String(item.title).slice(0, 300),
        url: String(item.url),
        organization: String(item.organization ?? check.org),
        published_at: typeof item.published_at === 'string' ? item.published_at : null,
        excerpt: String(item.excerpt ?? '').slice(0, 500),
      })
    }

    const inputTokens = data.usage.input_tokens
    const outputTokens = data.usage.output_tokens
    const costUsd =
      (inputTokens / 1_000_000) * HAIKU_INPUT_USD + (outputTokens / 1_000_000) * HAIKU_OUTPUT_USD
    const costEur = Math.round(costUsd * USD_TO_EUR * 10000) / 10000

    return {
      sources,
      raw_text: text,
      tokens: { input: inputTokens, output: outputTokens, cost_eur: costEur },
    }
  } catch (err) {
    console.error('[refresh-guides] fetchExternalSources error:', err)
    return { sources: [], raw_text: '', tokens: { input: 0, output: 0, cost_eur: 0 } }
  }
}

// ----------------------------------------------------------------------------
// 2. Extraction chiffres clés via Haiku (cheap)
// ----------------------------------------------------------------------------

async function extractKeyFigures(
  rawSourcesText: string,
  sources: ExternalSource[],
): Promise<{ figures: KeyFigure[]; tokens: { input: number; output: number; cost_eur: number } }> {
  if (sources.length === 0 || !ANTHROPIC_API_KEY) {
    return { figures: [], tokens: { input: 0, output: 0, cost_eur: 0 } }
  }

  const sourcesList = sources
    .map((s, i) => `[${i + 1}] ${s.organization} — ${s.title} (${s.url})\n${s.excerpt}`)
    .join('\n\n')

  const userPrompt = `Extrayez UNIQUEMENT les chiffres clés vérifiables des sources officielles ci-dessous. Format de sortie : JSON pur.

SOURCES :
${sourcesList}

RAW TEXT (contexte additionnel) :
${rawSourcesText.slice(0, 4000)}

Renvoyez un tableau JSON :
[
  {
    "figure": "Le chiffre exact avec unité (ex: '7,2 millions de DPE', '32 %', '4 800 €')",
    "context": "1 phrase courte expliquant ce que mesure ce chiffre",
    "source_url": "URL exacte d'une source ci-dessus",
    "source_org": "Organisme émetteur"
  }
]

RÈGLES :
- Maximum 10 chiffres
- Uniquement des chiffres présents littéralement dans les sources
- JAMAIS d'estimation ou de chiffre inventé
- Renvoyez [] si aucun chiffre extractible
- Le source_url DOIT correspondre à une source listée ci-dessus`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_HAIKU_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      console.error('[refresh-guides] extract figures failed:', await response.text())
      return { figures: [], tokens: { input: 0, output: 0, cost_eur: 0 } }
    }

    const data = (await response.json()) as ClaudeResponse
    const text = data.content.find((c) => c.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    let figures: KeyFigure[] = []
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as any[]
        // Garde uniquement les chiffres dont le source_url est dans la liste officielle
        const allowedUrls = new Set(sources.map((s) => s.url))
        figures = parsed
          .filter((f) => f?.figure && f?.source_url && allowedUrls.has(String(f.source_url)))
          .slice(0, 10)
          .map((f) => ({
            figure: String(f.figure).slice(0, 200),
            context: String(f.context ?? '').slice(0, 400),
            source_url: String(f.source_url),
            source_org: String(f.source_org ?? ''),
          }))
      } catch (err) {
        console.error('[refresh-guides] figures JSON parse failed:', err)
      }
    }

    const inputTokens = data.usage.input_tokens
    const outputTokens = data.usage.output_tokens
    const costUsd =
      (inputTokens / 1_000_000) * HAIKU_INPUT_USD + (outputTokens / 1_000_000) * HAIKU_OUTPUT_USD
    const costEur = Math.round(costUsd * USD_TO_EUR * 10000) / 10000

    return { figures, tokens: { input: inputTokens, output: outputTokens, cost_eur: costEur } }
  } catch (err) {
    console.error('[refresh-guides] extractKeyFigures error:', err)
    return { figures: [], tokens: { input: 0, output: 0, cost_eur: 0 } }
  }
}

// ----------------------------------------------------------------------------
// 3. Génération du draft Markdown via Sonnet (cached system prompt)
// ----------------------------------------------------------------------------

// System prompt long (>1024 tokens) → éligible au prompt caching ephemeral.
// Pris dans le CLAUDE.md / docs design KOVAS + méthode E-E-A-T Amandine Bart.
const SYSTEM_PROMPT_GENERATION = `Vous êtes l'éditeur senior de KOVAS, plateforme française pour diagnostiqueurs immobiliers indépendants. Vous rédigez en français, registre éditorial SOBRE PROFESSIONNEL, VOUVOIEMENT obligatoire. Aucun emoji. Aucune formule racoleuse. Aucun ton millennial / gaming / lifestyle.

PUBLIC CIBLE : diagnostiqueurs immobiliers certifiés COFRAC (43 ans en moyenne, ex-cadres reconvertis), propriétaires bailleurs informés, notaires, agents immobiliers.

OBJECTIF : produire un guide long-form (5000+ mots) référençant les évolutions réglementaires et chiffres clés les plus récents, structuré selon la méthode E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness).

EXIGENCES STRUCTURELLES :
1. H1 unique contenant le mot-clé principal exact
2. 5 à 8 sections H2 minimum, structure pyramidale
3. Sous-sections H3 si besoin (1 à 3 par H2)
4. Sommaire automatique en haut (liens d'ancrage vers H2)
5. Premier paragraphe = réponse directe 40-60 mots (featured snippet)
6. Densité mot-clé naturelle (1-2 %), 4-6 synonymes/variantes
7. AU MOINS 3 liens internes vers d'autres guides KOVAS
8. AU MOINS 5 citations de sources officielles avec liens [N] en bas de page
9. Section "## Questions fréquentes" (5-7 Q/R, réponses 40-60 mots)
10. Date de mise à jour visible en fin (format : "Mis à jour le DD MMMM YYYY")
11. Disclaimer final : "Cet article a vocation informative. Pour toute situation particulière, consultez un diagnostiqueur certifié COFRAC."

EXIGENCES E-E-A-T :
- Experience : exemples concrets terrain, cas pratiques chiffrés
- Expertise : vocabulaire technique précis (méthode 3CL-2021, COFRAC, AGCP, DDR 30 mA, etc.)
- Authoritativeness : citations exhaustives des sources officielles (ADEME, INSEE, DHUP, Légifrance, Géorisques)
- Trustworthiness : dates exactes, références arrêtés/décrets/lois avec numéros JORF

LIENS INTERNES KOVAS DISPONIBLES (utilisez ceux pertinents) :
- /guide/dpe — DPE complet
- /guide/amiante — Diagnostic amiante
- /guide/plomb — CREP plomb
- /guide/gaz — Diagnostic gaz
- /guide/electricite — Diagnostic électrique
- /guide/termites — Diagnostic termites
- /guide/carrez — Loi Carrez
- /guide/erp — État des risques (ERP)
- /guide/audit-energetique — Audit énergétique
- /observatoire — Observatoire du diagnostic immobilier
- /diagnostiqueurs — Annuaire des diagnostiqueurs

FORMAT DE SORTIE : JSON pur, sans aucun texte autour, structure exacte :
{
  "title": "H1 du guide",
  "meta_title": "Titre SEO 50-60 chars",
  "meta_description": "Meta description 150-160 chars",
  "content_md": "Le Markdown complet (5000+ mots)",
  "schema_org_jsonld": { "@context": "https://schema.org", "@type": "Article", ... }
}

INTERDICTIONS ABSOLUES :
- JAMAIS de chiffres inventés
- JAMAIS de citations de blogs / Wikipédia / presse généraliste
- JAMAIS de ton commercial agressif
- JAMAIS d'emoji
- JAMAIS de tutoiement
- JAMAIS de superlatifs ("le meilleur", "incroyable", "exceptionnel")`

async function generateDraft(
  guide: { slug: GuideSlug; title: string; topic: string },
  currentVersionMd: string | null,
  sources: ExternalSource[],
  figures: KeyFigure[],
): Promise<{
  draft: DraftContent | null
  tokens: {
    input: number
    output: number
    cache_read: number
    cache_write: number
    cost_eur: number
  }
}> {
  if (!ANTHROPIC_API_KEY) {
    return {
      draft: null,
      tokens: { input: 0, output: 0, cache_read: 0, cache_write: 0, cost_eur: 0 },
    }
  }

  const sourcesList = sources
    .map(
      (s, i) => `[${i + 1}] ${s.organization} — ${s.title}\nURL : ${s.url}\nExtrait : ${s.excerpt}`,
    )
    .join('\n\n')

  const figuresList = figures
    .map((f) => `• ${f.figure} — ${f.context} (${f.source_org}, ${f.source_url})`)
    .join('\n')

  const userPrompt = `Rédigez ou rafraîchissez le guide KOVAS suivant en intégrant les sources et chiffres ci-dessous.

GUIDE : ${guide.title}
SLUG : /guide/${guide.slug}
SUJET : ${guide.topic}
DATE DE PUBLICATION : ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}

${
  currentVersionMd
    ? `VERSION ACTUELLE (à rafraîchir, conservez ce qui reste valide, remplacez les chiffres et règles dépassés) :
---DEBUT_VERSION_ACTUELLE---
${currentVersionMd.slice(0, 8000)}
---FIN_VERSION_ACTUELLE---`
    : 'PREMIER DRAFT — aucune version antérieure.'
}

SOURCES OFFICIELLES À CITER (${sources.length}) :
${sourcesList || '(aucune source disponible — appuyez-vous sur la version actuelle)'}

CHIFFRES CLÉS À INTÉGRER (${figures.length}) :
${figuresList || '(aucun chiffre extrait)'}

CONTRAINTES :
- Citez chaque chiffre clé avec une référence [N] renvoyant à la liste de sources en bas
- Section finale "## Sources" listant toutes les sources avec numéros [N]
- Préservez les liens internes /guide/* pertinents
- Schema.org Article complet avec datePublished, dateModified, author, publisher

Renvoyez UNIQUEMENT le JSON demandé, sans texte autour.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_SONNET_MODEL,
        max_tokens: 8000,
        // System prompt en ARRAY avec cache_control ephemeral (B47/AI_ECONOMICS T1)
        // → premier appel : cache write (3,75 $/Mtok), appels suivants : cache read (0,30 $/Mtok)
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT_GENERATION,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[refresh-guides] generation failed:', err)
      return {
        draft: null,
        tokens: { input: 0, output: 0, cache_read: 0, cache_write: 0, cost_eur: 0 },
      }
    }

    const data = (await response.json()) as ClaudeResponse
    const text = data.content.find((c) => c.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[refresh-guides] generation no JSON found')
      return {
        draft: null,
        tokens: { input: 0, output: 0, cache_read: 0, cache_write: 0, cost_eur: 0 },
      }
    }

    let parsed: any = null
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (err) {
      console.error('[refresh-guides] generation JSON parse failed:', err)
      return {
        draft: null,
        tokens: { input: 0, output: 0, cache_read: 0, cache_write: 0, cost_eur: 0 },
      }
    }

    if (!parsed?.content_md || !parsed?.title) {
      console.error('[refresh-guides] generation incomplete payload')
      return {
        draft: null,
        tokens: { input: 0, output: 0, cache_read: 0, cache_write: 0, cost_eur: 0 },
      }
    }

    const wordCount = countWords(String(parsed.content_md))

    const draft: DraftContent = {
      title: String(parsed.title).slice(0, 200),
      content_md: String(parsed.content_md),
      schema_org_jsonld:
        parsed.schema_org_jsonld && typeof parsed.schema_org_jsonld === 'object'
          ? parsed.schema_org_jsonld
          : {
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: String(parsed.title),
              datePublished: new Date().toISOString(),
            },
      meta_title: String(parsed.meta_title ?? parsed.title).slice(0, 60),
      meta_description: String(parsed.meta_description ?? '').slice(0, 160),
      word_count: wordCount,
      sources_count: sources.length,
    }

    const inputTokens = data.usage.input_tokens
    const outputTokens = data.usage.output_tokens
    const cacheRead = data.usage.cache_read_input_tokens ?? 0
    const cacheWrite = data.usage.cache_creation_input_tokens ?? 0

    const costUsd =
      (inputTokens / 1_000_000) * SONNET_INPUT_USD +
      (outputTokens / 1_000_000) * SONNET_OUTPUT_USD +
      (cacheRead / 1_000_000) * SONNET_CACHE_READ_USD +
      (cacheWrite / 1_000_000) * SONNET_CACHE_WRITE_USD
    const costEur = Math.round(costUsd * USD_TO_EUR * 10000) / 10000

    return {
      draft,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        cache_read: cacheRead,
        cache_write: cacheWrite,
        cost_eur: costEur,
      },
    }
  } catch (err) {
    console.error('[refresh-guides] generateDraft error:', err)
    return {
      draft: null,
      tokens: { input: 0, output: 0, cache_read: 0, cache_write: 0, cost_eur: 0 },
    }
  }
}

function countWords(md: string): number {
  return md
    .replace(/[#*_`>\[\]()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1).length
}

// ----------------------------------------------------------------------------
// 4. Notification Resend admin
// ----------------------------------------------------------------------------

async function notifyAdmin(
  guideSlug: GuideSlug,
  draftId: string,
  draft: DraftContent,
  sourcesCount: number,
  figuresCount: number,
  costEur: number,
): Promise<{ ok: boolean }> {
  if (!RESEND_API_KEY) {
    console.warn('[refresh-guides] RESEND_API_KEY missing, skip notification')
    return { ok: false }
  }

  const subject = `Guide ${guideSlug} — draft IA prêt à valider`
  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #0F1E3D; padding: 24px;">
  <h1 style="font-size: 20px; margin-bottom: 8px;">Guide « ${draft.title} » — draft prêt à valider</h1>
  <p style="color: #4A5878; font-size: 14px; margin-bottom: 24px;">
    Le pipeline IA <code>refresh-guides-content</code> vient de produire un nouveau draft pour le guide <strong>/guide/${guideSlug}</strong>.
  </p>

  <table style="border-collapse: collapse; width: 100%; margin-bottom: 24px;">
    <tr><td style="padding: 8px 0; color: #4A5878;">Mots</td><td style="padding: 8px 0; text-align: right;"><strong>${draft.word_count.toLocaleString('fr-FR')}</strong></td></tr>
    <tr><td style="padding: 8px 0; color: #4A5878;">Sources officielles</td><td style="padding: 8px 0; text-align: right;"><strong>${sourcesCount}</strong></td></tr>
    <tr><td style="padding: 8px 0; color: #4A5878;">Chiffres clés extraits</td><td style="padding: 8px 0; text-align: right;"><strong>${figuresCount}</strong></td></tr>
    <tr><td style="padding: 8px 0; color: #4A5878;">Coût IA estimé</td><td style="padding: 8px 0; text-align: right;"><strong>${costEur.toFixed(4)} €</strong></td></tr>
  </table>

  <p style="margin-bottom: 24px;">
    <a href="https://kovas.fr/admin/guides-refresh?draft=${draftId}"
       style="display: inline-block; padding: 12px 24px; background: #0F1E3D; color: #F8F5EE; text-decoration: none; border-radius: 999px; font-weight: 600;">
      Valider le draft sur /admin/guides-refresh
    </a>
  </p>

  <p style="color: #7E8AA4; font-size: 12px; margin-top: 32px;">
    Cet email a été envoyé automatiquement par l'Edge Function <code>refresh-guides-content</code>.<br>
    Lot B65 — Refonte acqui-target 2026-05.
  </p>
</body>
</html>`

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [ADMIN_NOTIFY_EMAIL],
        subject,
        html,
      }),
    })
    if (!r.ok) {
      console.error('[refresh-guides] resend failed:', await r.text())
      return { ok: false }
    }
    return { ok: true }
  } catch (err) {
    console.error('[refresh-guides] notifyAdmin error:', err)
    return { ok: false }
  }
}

// ----------------------------------------------------------------------------
// 5. Pipeline complet pour un guide
// ----------------------------------------------------------------------------

async function refreshSingleGuide(
  supabase: ReturnType<typeof createClient>,
  guideSlug: GuideSlug,
  sourcesText: string | null,
  dryRun: boolean,
): Promise<RefreshResult> {
  const guideMeta = GUIDE_TOPICS[guideSlug]
  if (!guideMeta) {
    return { guide_slug: guideSlug, ok: false, error: 'Unknown guide_slug' }
  }

  // INSERT row initial (status='processing')
  let queueRowId: string | null = null
  if (!dryRun) {
    const { data: inserted, error: insertErr } = await (supabase as any)
      .schema('internal')
      .from('guide_refresh_queue')
      .insert({
        guide_slug: guideSlug,
        status: 'processing',
        scheduled_for: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle()

    if (insertErr || !inserted) {
      return { guide_slug: guideSlug, ok: false, error: insertErr?.message ?? 'insert failed' }
    }
    queueRowId = inserted.id as string
  }

  try {
    // 1. Sources externes
    const {
      sources,
      raw_text,
      tokens: srcTokens,
    } = await fetchExternalSources({ slug: guideSlug, ...guideMeta }, sourcesText)

    // 2. Chiffres clés
    const { figures, tokens: figTokens } = await extractKeyFigures(raw_text, sources)

    // 3. Version courante (si existe)
    let currentMd: string | null = null
    if (!dryRun) {
      const { data: currentVersion } = await (supabase as any).rpc('guides_current_version', {
        p_slug: guideSlug,
      })
      if (Array.isArray(currentVersion) && currentVersion.length > 0) {
        currentMd = String(currentVersion[0]?.content_md ?? '')
      }
    }

    // 4. Génération draft (Sonnet cached)
    const { draft, tokens: genTokens } = await generateDraft(
      { slug: guideSlug, ...guideMeta },
      currentMd,
      sources,
      figures,
    )

    const totalCostEur =
      Math.round((srcTokens.cost_eur + figTokens.cost_eur + genTokens.cost_eur) * 10000) / 10000

    if (!draft) {
      // Mark queue row as failed
      if (queueRowId) {
        await (supabase as any)
          .schema('internal')
          .from('guide_refresh_queue')
          .update({
            status: 'failed',
            processed_at: new Date().toISOString(),
            sources_fetched: sources,
            key_figures: figures,
            ai_input_tokens: srcTokens.input + figTokens.input + genTokens.input,
            ai_output_tokens: srcTokens.output + figTokens.output + genTokens.output,
            ai_cache_read_tokens: genTokens.cache_read,
            ai_cost_eur: totalCostEur,
            error_log: 'Génération draft échouée (voir logs Edge Function)',
          })
          .eq('id', queueRowId)
      }
      return {
        guide_slug: guideSlug,
        ok: false,
        error: 'generation_failed',
        cost_eur: totalCostEur,
      }
    }

    // 5. UPDATE queue row → draft_ready
    if (queueRowId) {
      const { error: updateErr } = await (supabase as any)
        .schema('internal')
        .from('guide_refresh_queue')
        .update({
          status: 'draft_ready',
          processed_at: new Date().toISOString(),
          draft_content: draft,
          sources_fetched: sources,
          key_figures: figures,
          ai_model_extraction: ANTHROPIC_HAIKU_MODEL,
          ai_model_generation: ANTHROPIC_SONNET_MODEL,
          ai_input_tokens: srcTokens.input + figTokens.input + genTokens.input,
          ai_output_tokens: srcTokens.output + figTokens.output + genTokens.output,
          ai_cache_read_tokens: genTokens.cache_read,
          ai_cost_eur: totalCostEur,
        })
        .eq('id', queueRowId)

      if (updateErr) {
        return {
          guide_slug: guideSlug,
          ok: false,
          error: `update queue failed: ${updateErr.message}`,
          cost_eur: totalCostEur,
        }
      }

      // 6. Notification admin
      await notifyAdmin(guideSlug, queueRowId, draft, sources.length, figures.length, totalCostEur)
    }

    return {
      guide_slug: guideSlug,
      ok: true,
      draft_id: queueRowId ?? undefined,
      word_count: draft.word_count,
      sources_count: sources.length,
      cost_eur: totalCostEur,
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (queueRowId) {
      await (supabase as any)
        .schema('internal')
        .from('guide_refresh_queue')
        .update({
          status: 'failed',
          processed_at: new Date().toISOString(),
          error_log: errMsg.slice(0, 2000),
        })
        .eq('id', queueRowId)
    }
    return { guide_slug: guideSlug, ok: false, error: errMsg }
  }
}

// ----------------------------------------------------------------------------
// 6. Handler HTTP
// ----------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // --- Auth : service_role OR x-cron-secret ---
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = req.headers.get('x-cron-secret') ?? ''
  if (
    authHeader !== `Bearer ${SERVICE_ROLE_KEY}` &&
    (cronSecret === '' || cronSecret !== CRON_SECRET)
  ) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'missing env vars (SUPABASE_URL / SERVICE_ROLE_KEY / ANTHROPIC_API_KEY)',
      }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }

  // --- Parse body ---
  let limit = DEFAULT_LIMIT
  let forcedSlug: GuideSlug | null = null
  let sourcesText: string | null = null
  let dryRun = false
  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body?.limit === 'number' && body.limit > 0 && body.limit <= MAX_LIMIT) {
      limit = body.limit
    }
    if (typeof body?.guide_slug === 'string' && body.guide_slug in GUIDE_TOPICS) {
      forcedSlug = body.guide_slug as GuideSlug
    }
    if (typeof body?.sources_text === 'string' && body.sources_text.length > 0) {
      sourcesText = body.sources_text
    }
    if (body?.dry_run === true) {
      dryRun = true
    }
  } catch {
    // ignore: cron sans body
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // --- Sélection des guides à rafraîchir ---
  let slugsToRefresh: GuideSlug[] = []
  if (forcedSlug) {
    slugsToRefresh = [forcedSlug]
  } else {
    const { data: nextGuides, error: pickErr } = await (supabase as any).rpc(
      'guides_pick_next_for_refresh',
      { limit_count: limit },
    )
    if (pickErr) {
      return new Response(
        JSON.stringify({ ok: false, error: `pick rotation failed: ${pickErr.message}` }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      )
    }
    slugsToRefresh = ((nextGuides ?? []) as Array<{ guide_slug: string }>)
      .map((r) => r.guide_slug as GuideSlug)
      .filter((s) => s in GUIDE_TOPICS)
  }

  if (slugsToRefresh.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, message: 'no guide due for refresh', refreshed: 0 }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }

  // --- Pipeline séquentiel (rate-limit Anthropic + traçabilité claire) ---
  const results: RefreshResult[] = []
  let totalCost = 0
  for (const slug of slugsToRefresh) {
    const r = await refreshSingleGuide(supabase, slug, sourcesText, dryRun)
    if (r.cost_eur) totalCost += r.cost_eur
    results.push(r)
  }

  return new Response(
    JSON.stringify({
      ok: true,
      dry_run: dryRun,
      refreshed: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      total_cost_eur: Math.round(totalCost * 10000) / 10000,
      results,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
})
