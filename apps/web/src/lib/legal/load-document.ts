/**
 * Chargeur server-side des documents juridiques KOVAS depuis `docs/legal/`.
 *
 * Conçu pour les server components Next.js des routes `/cgu`, `/cgv`, etc.
 * Lecture filesystem au build (statique : pas de revalidation runtime).
 *
 * Pipeline :
 *   1. Résolution du chemin absolu depuis `process.cwd()` jusqu'à la racine du
 *      monorepo (remonte au plus 4 niveaux, puis lit `docs/legal/{slug}.md`).
 *   2. Lecture brute, extraction du frontmatter implicite (titre H1 + version
 *      depuis la ligne "**Édition au ... Version 1.X**").
 *   3. Extraction du sommaire (toutes les ## et ###) pour la table of contents.
 *   4. Vérification de cohérence soft contre `PRICING_PLANS` : si l'un des
 *      cinq prix officiels (19/29/39/99/149 €) ne figure pas dans le markdown
 *      de la CGV, log un warning au build (n'échoue pas le build).
 *
 * Pas d'API runtime — uniquement importé depuis les server components.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { PRICING_PLANS } from '@/lib/pricing-plans'

// ============================================
// Types
// ============================================

export type LegalDocumentSlug =
  | '00-README-juridique'
  | '01-mentions-legales'
  | '02-cgu'
  | '03-cgv'
  | '04-politique-confidentialite'
  | '05-politique-cookies'
  | '06-conditions-annuaire'
  | '07-conditions-particuliers'
  | '08-charte-diagnostiqueur'
  | '09-information-prealable-rgpd'

export interface LegalTocEntry {
  /** Niveau hiérarchique 2 ou 3 (correspondance ## ou ###). */
  readonly level: 2 | 3
  /** Texte du heading après strip markdown. */
  readonly text: string
  /** Ancre slugifiée pour href="#..." */
  readonly anchor: string
}

export interface LegalDocument {
  readonly slug: LegalDocumentSlug
  /** Titre H1 du document. */
  readonly title: string
  /** Libellé court de version (ex. "v1.1 — 2 juin 2026"). */
  readonly versionLabel: string
  /** Markdown brut du document. */
  readonly content: string
  /** Table des matières (## et ###). */
  readonly toc: readonly LegalTocEntry[]
}

// ============================================
// Résolution de chemin
// ============================================

/**
 * Résout le chemin absolu vers `docs/legal/` en remontant l'arbo depuis cwd.
 * Compatible monorepo (apps/web depuis `apps/web` et racine).
 */
async function resolveLegalDir(): Promise<string> {
  const candidates: string[] = []
  let current = process.cwd()
  for (let i = 0; i < 6; i += 1) {
    candidates.push(path.join(current, 'docs', 'legal'))
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate)
      if (stat.isDirectory()) return candidate
    } catch {
      // continue
    }
  }
  throw new Error(`[legal] Impossible de localiser le dossier docs/legal/ depuis ${process.cwd()}`)
}

// ============================================
// Parsing utilities
// ============================================

const VERSION_LINE_RE = /\*\*Édition au\s+([^—*]+?)\s*—\s*Version\s+(v?\d+\.\d+)\*\*/i

function extractTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+?)\s*$/m)
  return match?.[1]?.trim() ?? 'Document juridique'
}

function extractVersionLabel(markdown: string): string {
  const match = markdown.match(VERSION_LINE_RE)
  if (!match) return 'Version inconnue'
  const [, dateRaw, versionRaw] = match
  const version = versionRaw.startsWith('v') ? versionRaw : `v${versionRaw}`
  return `${version} — ${dateRaw.trim()}`
}

/** Slugify pour ancres HTML (alphanum + tirets, accents enlevés). */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function extractToc(markdown: string): readonly LegalTocEntry[] {
  const lines = markdown.split('\n')
  const entries: LegalTocEntry[] = []
  let inCodeBlock = false
  const seenAnchors = new Map<string, number>()
  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue
    const h2 = line.match(/^##\s+(.+?)\s*$/)
    const h3 = line.match(/^###\s+(.+?)\s*$/)
    let level: 2 | 3 | null = null
    let text: string | null = null
    if (h2) {
      level = 2
      text = h2[1]
    } else if (h3) {
      level = 3
      text = h3[1]
    }
    if (!level || !text) continue
    let anchor = slugify(text)
    const existing = seenAnchors.get(anchor)
    if (existing !== undefined) {
      seenAnchors.set(anchor, existing + 1)
      anchor = `${anchor}-${existing + 1}`
    } else {
      seenAnchors.set(anchor, 0)
    }
    entries.push({ level, text, anchor })
  }
  return entries
}

// ============================================
// Cohérence prix code ↔ CGV
// ============================================

/**
 * Vérifie que les 4 prix officiels V5 Logiciel (29/79/199/499 €) figurent dans
 * le markdown de la CGV. Tout écart est loggé au build sans faire échouer le build.
 * Mis à jour Lot B53 — CGV v1.4 alignée sur la grille V5 (refonte 2026-05-25).
 */
function warnIfPricingDivergence(slug: LegalDocumentSlug, content: string): void {
  if (slug !== '03-cgv') return
  const expectedPrices: ReadonlyArray<{ tier: string; eur: number }> = [
    { tier: 'Solo', eur: 29 },
    { tier: 'Pro', eur: 79 },
    { tier: 'Cabinet', eur: 199 },
    { tier: 'Cabinet+', eur: 499 },
  ]
  const missing: string[] = []
  for (const { tier, eur } of expectedPrices) {
    if (!content.includes(`${eur},00`) && !content.includes(`${eur} €`)) {
      missing.push(`${tier} (${eur} € HT)`)
    }
  }
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[legal/cgv] Tarifs V5 absents du document CGV — vérifier docs/legal/03-cgv.md article 4.3 :\n  - ${missing.join('\n  - ')}`,
    )
  }
  // Avertissement complémentaire : code PRICING_PLANS officiels (LOGICIEL_PLANS V5) hors de la grille CGV.
  // Filtré sur les plans non-legacy (les *_legacy grandfather peuvent diverger par construction).
  const officialPriceCents = expectedPrices.map((e) => e.eur * 100)
  const codeOutOfGrid = PRICING_PLANS.filter(
    (p) =>
      p.monthlyPrice > 0 &&
      !p.code.endsWith('_legacy') &&
      !officialPriceCents.includes(p.monthlyPrice),
  ).map((p) => `${p.code} (${p.monthlyPrice / 100} €)`)
  if (codeOutOfGrid.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[legal/cgv] Divergence détectée : PRICING_PLANS (apps/web/src/lib/pricing-plans.ts) contient des prix hors grille officielle V5 CGV : ${codeOutOfGrid.join(', ')}. À synchroniser ultérieurement.`,
    )
  }
}

// ============================================
// API publique
// ============================================

/**
 * Charge un document juridique par slug. Lance une erreur explicite si le fichier
 * est absent (build doit alors échouer — protège contre le déploiement d'une
 * route sans markdown).
 */
export async function loadLegalDocument(slug: LegalDocumentSlug): Promise<LegalDocument> {
  const dir = await resolveLegalDir()
  const filePath = path.join(dir, `${slug}.md`)
  let content: string
  try {
    content = await fs.readFile(filePath, 'utf-8')
  } catch (err) {
    throw new Error(
      `[legal] Document introuvable : ${filePath} (slug=${slug}). Détail : ${(err as Error).message}`,
    )
  }
  warnIfPricingDivergence(slug, content)
  return {
    slug,
    title: extractTitle(content),
    versionLabel: extractVersionLabel(content),
    content,
    toc: extractToc(content),
  }
}
