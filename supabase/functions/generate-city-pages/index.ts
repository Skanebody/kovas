// @ts-nocheck — Deno runtime (Supabase Edge Functions)
/* eslint-disable */
/**
 * KOVAS — Edge Function generate-city-pages (Mission C1)
 * ------------------------------------------------------
 * Génère les pages SEO locales (500 villes priority FR).
 * - Tier 1 (rang 1-100) : Claude Haiku — long-form 1100 mots + 5 FAQ
 * - Tier 2 (rang 101-300) : Claude Haiku — 600 mots + 3 FAQ
 * - Tier 3 (rang 301-500) : Template statique INSEE (pas d'IA)
 *
 * Auth : Bearer CRON_SECRET
 * Cron : `0 4 * * 1` (lundi 4h CET) ou trigger admin manuel
 * Batch : 10 villes/run (évite timeout 60s Edge Function)
 *
 * Body JSON optionnel :
 *   { "start_rank": 1, "batch_size": 10, "force_regenerate": false }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import priorityCities from '../../seed/priority-cities.json' assert { type: 'json' }

type PriorityCity = {
  rank: number
  name: string
  dept: string
  dept_name: string
  region: string
  region_name: string
  population: number
  slug: string
}

type DvfStats = {
  transactions_count: number | null
  avg_price_per_m2: number | null
}

type FaqItem = { question: string; answer: string }

type GeneratedContent = {
  intro: string
  long_form: string
  faq: FaqItem[]
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const CLAUDE_HAIKU_MODEL = 'claude-haiku-4-5'

// ============================================
// Auth
// ============================================
function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${CRON_SECRET}` && CRON_SECRET.length > 0
}

// ============================================
// DVF (data.gouv.fr) — best-effort, mock fallback
// ============================================
async function fetchDVFStats(dept: string, _cityName: string): Promise<DvfStats> {
  // API DVF data.gouv.fr — best effort, fallback null si KO.
  // V2 : appeler le vrai endpoint DVF. V1 : mock cohérent par département.
  try {
    // Mock simple basé sur le département (zones tendues ≠ rural)
    const tense = new Set([
      '75', '92', '93', '94', '78', '95', '91', '77', // IDF
      '06', '83', '13', // PACA littoral
      '69', // Lyon
      '33', // Bordeaux
      '44', // Nantes
      '34', // Montpellier
      '31', // Toulouse
    ])
    if (tense.has(dept)) {
      return { transactions_count: 1200, avg_price_per_m2: 4500 }
    }
    return { transactions_count: 350, avg_price_per_m2: 2200 }
  } catch {
    return { transactions_count: null, avg_price_per_m2: null }
  }
}

// ============================================
// Comptage diagnosticians par ville (table A1)
// ============================================
async function countDiagnosticiansForCity(citySlug: string): Promise<number> {
  try {
    // @ts-ignore — table diagnosticians créée par mission A1 (cohabitation cast as any)
    const { count } = await (supabase as any)
      .from('diagnosticians')
      .select('id', { count: 'exact', head: true })
      .eq('slug_city', citySlug)
      .eq('is_published', true)
    return count ?? 0
  } catch {
    return 0
  }
}

// ============================================
// Prompt builder
// ============================================
function buildPrompt(
  city: PriorityCity,
  count: number,
  dvf: DvfStats,
  tier: 1 | 2,
): string {
  const target = tier === 1
    ? { long_words: '900-1100', faq_count: 5, faq_words: '80-120' }
    : { long_words: '500-700', faq_count: 3, faq_words: '60-100' }

  return `Tu es rédacteur SEO immobilier. Génère contenu pour "Diagnostiqueurs immobiliers à ${city.name}".

CONTEXTE :
- Ville : ${city.name} (${city.dept} ${city.dept_name})
- Région : ${city.region_name}
- Population : ${city.population.toLocaleString('fr-FR')}
- Transactions immobilières/an : ${dvf.transactions_count ?? 'N/D'}
- Prix moyen m² : ${dvf.avg_price_per_m2 ? dvf.avg_price_per_m2 + '€' : 'N/D'}
- Diagnostiqueurs locaux référencés : ${count}

LIVRABLES (réponds STRICTEMENT en JSON, sans markdown autour) :
{
  "intro": "(200-250 mots, ton journaliste pro, présentation marché local diagnostic à ${city.name})",
  "long_form": "(${target.long_words} mots : pourquoi faire un diag à ${city.name} + 8 diagnostics obligatoires + spécificités locales bâti + prix locaux)",
  "faq": [
    {"question":"...","answer":"(${target.faq_words} mots)"}
    ${tier === 1 ? '/* 5 questions */' : '/* 3 questions */'}
  ]
}

CONTRAINTES STRICTES :
- AUCUN superlatif marketing ("premium", "excellent", "top", "leader", "meilleur", "incomparable").
- Citations de lois quand pertinent (arrêté du 31 mars 2021 DPE, Loi Carrez 1996, etc.).
- Mentions chiffres locaux (population, prix, transactions).
- Ton SOBRE PROFESSIONNEL (avatar diagnostiqueur 43 ans, ex-cadre).
- Vouvoiement.
- Pas d'emojis.
- Réponds UNIQUEMENT le JSON, sans \`\`\`json ni commentaires.`
}

// ============================================
// Claude Haiku call
// ============================================
async function callClaudeHaiku(prompt: string): Promise<GeneratedContent> {
  if (!ANTHROPIC_API_KEY) {
    // Fallback offline (dev sans clé Claude)
    return generateStaticFallback()
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_HAIKU_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!resp.ok) {
    throw new Error(`Claude API error ${resp.status}: ${await resp.text()}`)
  }

  const payload = await resp.json()
  const text = payload?.content?.[0]?.text ?? '{}'

  // Strip eventual ```json wrapper si Haiku récidive
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as GeneratedContent
    return {
      intro: parsed.intro ?? '',
      long_form: parsed.long_form ?? '',
      faq: Array.isArray(parsed.faq) ? parsed.faq : [],
    }
  } catch (e) {
    console.error('Parse error Claude output:', e, text)
    return generateStaticFallback()
  }
}

// ============================================
// Tier 3 : template statique (pas d'IA)
// ============================================
function generateStaticTemplate(city: PriorityCity, count: number): GeneratedContent {
  return {
    intro: `${city.name}, commune de ${city.population.toLocaleString('fr-FR')} habitants située dans le département ${city.dept_name} (${city.region_name}), dispose d'un marché du diagnostic immobilier actif. KOVAS référence actuellement ${count} diagnostiqueur${count > 1 ? 's' : ''} certifié${count > 1 ? 's' : ''} pour les transactions et locations sur cette zone. La réalisation des diagnostics obligatoires (DPE, amiante, plomb, gaz, électricité, termites, Carrez, ERP) est encadrée par la réglementation française et constitue une étape incontournable de toute mise en vente ou location.`,
    long_form: `À ${city.name}, comme partout en France, la vente ou la location d'un bien immobilier nécessite la réalisation préalable d'un Dossier de Diagnostic Technique (DDT). Ce dossier regroupe les diagnostics obligatoires applicables au bien selon son âge, sa localisation et son type.\n\nLes diagnostics les plus fréquemment réalisés à ${city.name} sont :\n- DPE (Diagnostic de Performance Énergétique) : obligatoire vente et location, validité 10 ans (arrêté du 31 mars 2021).\n- Amiante : pour les biens construits avant le 1er juillet 1997, validité illimitée si absence détectée.\n- Plomb (CREP) : logements antérieurs à 1949, validité 1 an vente / 6 ans location.\n- Gaz : installations gaz de plus de 15 ans, validité 3 ans.\n- Électricité : installations électriques de plus de 15 ans, validité 3 ans.\n- Loi Carrez : copropriétés en vente.\n- ERP (État des Risques et Pollutions) : selon zonage, validité 6 mois.\n\nLes prix observés dans ${city.dept_name} restent dans les fourchettes nationales : un pack complet DPE+amiante+plomb pour un appartement T3 oscille généralement entre 350 et 500 € TTC selon le diagnostiqueur et la surface.\n\nLes diagnostiqueurs certifiés exerçant à ${city.name} sont titulaires d'une certification COFRAC obligatoire (arrêté du 24 décembre 2021) et d'une assurance responsabilité civile professionnelle. Vérifiez toujours la validité de la certification du professionnel sur le portail public dédié.`,
    faq: [
      {
        question: `Combien coûte un DPE à ${city.name} ?`,
        answer: `Le tarif d'un DPE à ${city.name} se situe entre 100 et 250 € TTC selon la surface du bien et le diagnostiqueur. Pour une maison individuelle, comptez plutôt 150-250 € ; pour un appartement, 100-180 €. Le diagnostic est obligatoire pour toute vente ou location et reste valable 10 ans (sauf travaux significatifs).`,
      },
      {
        question: `Quels diagnostics sont obligatoires à ${city.name} ?`,
        answer: `Le DPE est obligatoire pour toute transaction. Selon l'âge et la localisation du bien, s'ajoutent amiante (avant 1997), plomb (avant 1949), gaz/électricité (installations > 15 ans), termites (zones à risque arrêté préfectoral), Carrez (copro vente), ERP (état des risques). Un diagnostiqueur ${city.name} certifié peut vous dresser la liste exacte applicable à votre bien.`,
      },
      {
        question: `Comment choisir un diagnostiqueur certifié à ${city.name} ?`,
        answer: `Vérifiez impérativement : (1) la certification COFRAC en cours de validité sur l'annuaire officiel, (2) l'attestation d'assurance RC pro, (3) plusieurs devis (au moins 3) pour comparer, (4) les délais de livraison du rapport. Un diagnostiqueur sérieux à ${city.name} vous remettra son certificat avant la mission et fournira un rapport conforme au format ADEME pour le DPE.`,
      },
    ],
  }
}

function generateStaticFallback(): GeneratedContent {
  return {
    intro: '',
    long_form: '',
    faq: [],
  }
}

// ============================================
// Génération principale (1 ville)
// ============================================
async function generateCityPage(city: PriorityCity): Promise<void> {
  const tier = (city.rank <= 100 ? 1 : city.rank <= 300 ? 2 : 3) as 1 | 2 | 3
  const count = await countDiagnosticiansForCity(city.slug)
  const dvf = await fetchDVFStats(city.dept, city.name)

  let content: GeneratedContent
  if (tier === 3) {
    content = generateStaticTemplate(city, count)
  } else {
    const prompt = buildPrompt(city, count, dvf, tier)
    content = await callClaudeHaiku(prompt)
  }

  const metaTitle =
    `Diagnostiqueur Immobilier ${city.name} — ${count} pro${count > 1 ? 's' : ''} certifié${count > 1 ? 's' : ''} | KOVAS`.slice(0, 70)

  const metaDescription =
    `Trouvez votre diagnostiqueur immobilier à ${city.name}. ${count} professionnels certifiés DPE, amiante, gaz, électricité. Devis gratuit en ligne.`.slice(
      0,
      160,
    )

  // @ts-ignore — table seo_geo_pages pas dans Database.types (cohabitation)
  const { error } = await (supabase as any).from('seo_geo_pages').upsert(
    {
      page_type: 'city',
      slug: city.slug,
      city_slug: city.slug,
      city_name: city.name,
      department_code: city.dept,
      department_name: city.dept_name,
      region_code: city.region,
      region_name: city.region_name,
      h1_title: `Diagnostiqueurs immobiliers à ${city.name}`,
      meta_title: metaTitle,
      meta_description: metaDescription,
      canonical_url: `https://kovas.fr/diagnostiqueurs/${city.dept.toLowerCase()}/${city.slug}`,
      intro_content: content.intro,
      long_form_content: content.long_form,
      faq_items: content.faq,
      diagnosticians_count: count,
      transactions_count_dvf: dvf.transactions_count,
      avg_price_per_m2: dvf.avg_price_per_m2,
      population: city.population,
      priority_rank: city.rank,
      generation_tier: tier,
      last_regenerated_at: new Date().toISOString(),
    },
    { onConflict: 'slug' },
  )

  if (error) {
    throw new Error(`Upsert error for ${city.slug}: ${error.message}`)
  }
}

// ============================================
// Handler HTTP
// ============================================
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  if (!isAuthorized(req)) {
    return new Response('Unauthorized', { status: 401 })
  }

  let startRank = 1
  let batchSize = 10
  let forceRegenerate = false

  if (req.method === 'POST') {
    try {
      const body = await req.json()
      startRank = Math.max(1, Number(body?.start_rank) || 1)
      batchSize = Math.min(50, Math.max(1, Number(body?.batch_size) || 10))
      forceRegenerate = Boolean(body?.force_regenerate)
    } catch {
      /* body optionnel */
    }
  }

  const cities = (priorityCities as PriorityCity[]).filter(
    (c) => c.rank >= startRank && c.rank < startRank + batchSize,
  )

  if (cities.length === 0) {
    return Response.json({
      ok: true,
      processed: 0,
      message: `Aucune ville dans la fenêtre rank ${startRank}-${startRank + batchSize - 1}`,
    })
  }

  const results: { slug: string; status: 'ok' | 'error'; error?: string }[] = []

  for (const city of cities) {
    // Skip si déjà généré récemment (< 7j) sauf force
    if (!forceRegenerate) {
      // @ts-ignore cohabitation
      const { data: existing } = await (supabase as any)
        .from('seo_geo_pages')
        .select('last_regenerated_at')
        .eq('slug', city.slug)
        .eq('page_type', 'city')
        .maybeSingle()

      if (existing?.last_regenerated_at) {
        const ageDays =
          (Date.now() - new Date(existing.last_regenerated_at).getTime()) /
          (1000 * 60 * 60 * 24)
        if (ageDays < 7) {
          results.push({ slug: city.slug, status: 'ok' })
          continue
        }
      }
    }

    try {
      await generateCityPage(city)
      results.push({ slug: city.slug, status: 'ok' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`Failed ${city.slug}:`, msg)
      results.push({ slug: city.slug, status: 'error', error: msg })
    }
  }

  return Response.json({
    ok: true,
    processed: results.length,
    start_rank: startRank,
    batch_size: batchSize,
    next_start_rank: startRank + batchSize,
    results,
  })
})
