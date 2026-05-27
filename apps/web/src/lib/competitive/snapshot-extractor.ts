/**
 * KOVAS — Système 14 : Competitive intelligence — snapshot extractor.
 *
 * Pure function qui parse un HTML brut concurrent et en extrait des signaux
 * structurés (title, meta, h1/h2, prix détectés, CTA, mots-clés produit,
 * preuve sociale chiffrée). Pas de fetch — le caller passe le HTML déjà
 * récupéré (Edge Function scraping daily).
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §17.
 *
 * Stratégie :
 *   - Regex légères, pas de parser DOM (zéro dépendance, fonctionne en
 *     Edge runtime + Node + browser).
 *   - Stripping HTML approximatif suffisant pour les heuristiques
 *     concurrentielles (pas de besoin de précision sémantique parfaite).
 *   - Tous les comptages plafonnés (h2 ≤ 20, cta ≤ 10) pour limiter la
 *     taille du snapshot stocké en DB.
 *
 * Déterministe, testable, zéro IO.
 */

export interface PageSnapshot {
  /** URL d'où le HTML vient */
  url: string
  /** Timestamp ISO de fetch (fourni par le caller) */
  fetched_at: string
  /** Contenu de <title> */
  title: string | null
  /** Contenu de <meta name="description" content="..."> */
  meta_description: string | null
  /** Premier <h1> */
  h1: string | null
  /** Tous les <h2> (max 20) */
  h2_list: string[]
  /** Prix HT/mo détectés en EUR (entiers, dédupliqués, triés) */
  prices_eur_detected: number[]
  /** Texte des CTA principaux (boutons + liens classés btn) — max 10 */
  cta_texts: string[]
  /** Mots-clés produit diagnostic immo trouvés (lowercase, dédupliqués) */
  feature_keywords: string[]
  /** Mention chiffrée max trouvée (ex: "5000 diagnostiqueurs") */
  social_proof_count: number
  /** Longueur approximative du texte (HTML stripped) */
  raw_text_length: number
  /** Hash de contenu (fourni par le caller, ex: SHA-256 du body) */
  content_hash: string
}

const FEATURE_KEYWORDS_CATALOG = [
  'DPE',
  'amiante',
  'plomb',
  'gaz',
  'électricité',
  'termites',
  'Carrez',
  'Boutin',
  'ADEME',
  'Légifrance',
  'Cofrac',
  'audit énergétique',
  'MaPrimeRénov',
  'mobile',
  'cloud',
  'IA',
  'vision',
  'vocal',
  'signature',
  'eIDAS',
  'Factur-X',
] as const

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!m || !m[1]) return null
  const txt = stripTags(m[1])
  return txt.length > 0 ? txt : null
}

function extractMetaDescription(html: string): string | null {
  // Supporte name="description" ou name='description'
  const m = html.match(
    /<meta\s+[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i,
  )
  if (m?.[1]) return decodeEntities(m[1])
  // Ordre inverse content avant name
  const m2 = html.match(
    /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*>/i,
  )
  if (m2?.[1]) return decodeEntities(m2[1])
  return null
}

function extractH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (!m || !m[1]) return null
  const txt = stripTags(m[1])
  return txt.length > 0 ? txt : null
}

function extractH2List(html: string): string[] {
  const out: string[] = []
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi
  let match: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
  while ((match = re.exec(html)) !== null) {
    if (!match[1]) continue
    const txt = stripTags(match[1])
    if (txt.length > 0 && txt.length <= 200) {
      out.push(txt)
    }
    if (out.length >= 20) break
  }
  return out
}

function extractPricesEur(html: string): number[] {
  const text = stripTags(html)
  const found = new Set<number>()
  // Patterns FR :
  //   "29 €", "29€", "29,90 €", "29.90€", "29 €/mois", "29 €/mo"
  //   Plage utile : 1 à 9999 EUR (filtre les codes postaux ou IDs)
  const re = /(\d{1,4})(?:[.,]\d{1,2})?\s*€/g
  let m: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
  while ((m = re.exec(text)) !== null) {
    const intPart = m[1]
    if (!intPart) continue
    const value = Number.parseInt(intPart, 10)
    if (Number.isFinite(value) && value >= 1 && value <= 9999) {
      found.add(value)
    }
  }
  return Array.from(found).sort((a, b) => a - b)
}

function extractCtaTexts(html: string): string[] {
  const out: string[] = []
  // <button>...</button>
  const btnRe = /<button[^>]*>([\s\S]*?)<\/button>/gi
  let m: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
  while ((m = btnRe.exec(html)) !== null) {
    if (!m[1]) continue
    const txt = stripTags(m[1])
    if (txt.length >= 2 && txt.length <= 30) out.push(txt)
  }
  // <a class="...btn...">...</a> (classe contient "btn" ou "button" ou "cta")
  const aRe = /<a[^>]*class\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
  while ((m = aRe.exec(html)) !== null) {
    const cls = m[1] ?? ''
    const inner = m[2] ?? ''
    if (!/btn|button|cta/i.test(cls)) continue
    const txt = stripTags(inner)
    if (txt.length >= 2 && txt.length <= 30) out.push(txt)
  }
  // Dédup + plafond
  const dedup = Array.from(new Set(out.map((t) => t.trim())))
  return dedup.slice(0, 10)
}

function extractFeatureKeywords(html: string): string[] {
  const text = stripTags(html)
  const found: string[] = []
  for (const kw of FEATURE_KEYWORDS_CATALOG) {
    // Recherche insensible à la casse + frontières mot pour mots simples
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Pour les keywords mono-mot ASCII, ajout de \b ; sinon match simple
    const isMonoAscii = /^[A-Za-z]+$/.test(kw)
    const re = isMonoAscii ? new RegExp(`\\b${escaped}\\b`, 'i') : new RegExp(escaped, 'i')
    if (re.test(text)) {
      found.push(kw.toLowerCase())
    }
  }
  return Array.from(new Set(found))
}

function extractSocialProofCount(html: string): number {
  const text = stripTags(html)
  let maxCount = 0
  // Pattern : "5000 diagnostiqueurs", "1 200 clients", "10000+ utilisateurs"
  // Note : \d{1,3} en tête + groupes \d{3} séparés permet "1 200" comme un seul nombre.
  const re =
    /\b(\d{1,3}(?:[\s.,]\d{3})+|\d{2,6})\s*\+?\s*(diagnostiqueurs?|clients?|utilisateurs?|cabinets?|professionnels?)\b/gi
  let m: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
  while ((m = re.exec(text)) !== null) {
    const raw = m[1]
    if (!raw) continue
    const cleaned = raw.replace(/[\s.,]/g, '')
    const value = Number.parseInt(cleaned, 10)
    if (Number.isFinite(value) && value > maxCount) {
      maxCount = value
    }
  }
  return maxCount
}

/**
 * Extrait un PageSnapshot structuré depuis un HTML brut.
 *
 * @param html HTML complet de la page
 * @param url URL d'origine (gardée tel quel)
 * @param fetched_at ISO timestamp fourni par le caller
 * @param content_hash Hash du body (SHA-256 ou autre), fourni par le caller
 *
 * @example
 * ```ts
 * const snap = extractSnapshot(
 *   '<html><head><title>Logiciel diag</title></head>...',
 *   'https://www.liciel.com',
 *   '2026-05-27T08:00:00.000Z',
 *   'abc123',
 * )
 * // → { title: 'Logiciel diag', prices_eur_detected: [29, 79], ... }
 * ```
 */
export function extractSnapshot(
  html: string,
  url: string,
  fetched_at: string,
  content_hash: string,
): PageSnapshot {
  const stripped = stripTags(html)
  return {
    url,
    fetched_at,
    title: extractTitle(html),
    meta_description: extractMetaDescription(html),
    h1: extractH1(html),
    h2_list: extractH2List(html),
    prices_eur_detected: extractPricesEur(html),
    cta_texts: extractCtaTexts(html),
    feature_keywords: extractFeatureKeywords(html),
    social_proof_count: extractSocialProofCount(html),
    raw_text_length: stripped.length,
    content_hash,
  }
}
