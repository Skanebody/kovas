/**
 * Types canoniques pour les guides longs SEO `/guide/[type]`.
 *
 * Chaque guide est un long-form 5000+ mots structuré en sections H2/H3,
 * avec FAQ accordéon en bas et 3-4 cross-links vers les guides connexes.
 * Le rendu inclut JSON-LD `Article` + `HowTo` (par section éligible) +
 * `FAQPage` + `BreadcrumbList`.
 *
 * Source unique de vérité : `apps/web/src/lib/guides/registry.ts`.
 */

/** 9 diagnostics couverts par les guides longs Phase 1. */
export type GuideType =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'carrez'
  | 'erp'
  | 'audit-energetique'

/** Catégorie pour le filtre de l'index `/guide`. */
export type GuideCategory = 'vente' | 'location' | 'travaux' | 'audit'

/** Étape numérotée d'une procédure (sortie en Schema.org HowTo). */
export interface HowToStep {
  readonly position: number
  readonly name: string
  readonly text: string
}

/** Encadré contextuel inséré dans une section. */
export interface SectionCallout {
  readonly type: 'info' | 'warning' | 'tip'
  readonly text: string
}

/**
 * Bloc de section narrative.
 *
 * - `level: 2` → titre H2 (apparaît dans la TOC sticky)
 * - `level: 3` → titre H3 (n'apparaît pas dans la TOC)
 *
 * Les `paragraphs` sont rendus en `<p>` successifs.
 * Les `bullets` sont rendus en `<ul>` après les paragraphes.
 * Un `callout` optionnel s'insère sous la liste.
 * Les `howToSteps`, si présents, génèrent une `<ol>` numérotée + JSON-LD HowTo.
 */
export interface GuideSection {
  readonly id: string
  readonly title: string
  readonly level: 2 | 3
  readonly paragraphs: ReadonlyArray<string>
  readonly bullets?: ReadonlyArray<string>
  readonly callout?: SectionCallout
  readonly howToSteps?: ReadonlyArray<HowToStep>
}

/** Question-réponse de la FAQ d'un guide. */
export interface FAQItem {
  readonly question: string
  readonly answer: string
}

/**
 * Source externe officielle citée dans un guide (méthode E-E-A-T).
 *
 * Chaque chiffre ou affirmation réglementaire devrait pointer vers une
 * source vérifiable (ADEME, INSEE, DHUP, Géorisques, Légifrance, JO).
 * Les notes `[1]`, `[2]`... insérées dans le corps du texte renvoient à
 * l'`id` correspondant en bas de page via la section "Sources".
 *
 * Règle d'admission stricte :
 *  - Organismes publics français uniquement (ministères, agences d'État,
 *    établissements publics, observatoires officiels) ;
 *  - Pas de blog, pas de Wikipédia, pas de média généraliste.
 */
export interface GuideSource {
  /** Numéro d'ordre (1, 2, 3…) cité dans le corps du texte. */
  readonly id: number
  /** Titre du document/article source. */
  readonly title: string
  /** Organisme émetteur (ADEME, INSEE, DHUP, Légifrance, etc.). */
  readonly organization: string
  /** URL canonique vers la source publiée. */
  readonly url: string
  /** Date de consultation au format ISO 8601 (YYYY-MM-DD). */
  readonly accessedAt: string
}

/** Guide long complet (entité versionnée). */
export interface Guide {
  readonly type: GuideType
  readonly slug: string
  readonly title: string
  /** Titre court pour breadcrumb / cards (ex. "DPE", "Amiante"). */
  readonly shortTitle: string
  /** Catégorie principale pour filtres index. */
  readonly category: GuideCategory
  /** Sous-titre éditorial affiché sous le H1 du hero. */
  readonly tagline: string
  /** Meta description 150-160 chars. */
  readonly metaDescription: string
  /** Phrase teaser 1 ligne sur la card index. */
  readonly teaser: string
  /** Image OG optionnelle (1200×630). */
  readonly heroImage?: string
  /** ISO 8601. */
  readonly publishedAt: string
  /** ISO 8601 (≥ publishedAt). */
  readonly updatedAt: string
  /** Temps de lecture en minutes (calculé à ~200 mots/min). */
  readonly readingTimeMinutes: number
  /** Nombre de mots cumulés sur toutes les sections + FAQ. */
  readonly wordCount: number
  readonly sections: ReadonlyArray<GuideSection>
  readonly faq: ReadonlyArray<FAQItem>
  /** 3-4 autres types connexes pour cross-link sidebar + bas de page. */
  readonly relatedTypes: ReadonlyArray<GuideType>
  /**
   * Sources externes officielles citées dans le corps du guide
   * (méthode E-E-A-T). Optionnel pour rester rétrocompatible avec les
   * guides historiques ; à terme tous les guides doivent en fournir.
   */
  readonly sources?: ReadonlyArray<GuideSource>
}

/**
 * Calcule le nombre de mots d'un guide à partir de ses sections + FAQ.
 * Utilisé pour le métrique `wordCount` (build-time) et pour validation.
 */
export function computeGuideWordCount(
  sections: ReadonlyArray<GuideSection>,
  faq: ReadonlyArray<FAQItem>,
): number {
  let total = 0
  for (const section of sections) {
    for (const paragraph of section.paragraphs) {
      total += countWords(paragraph)
    }
    for (const bullet of section.bullets ?? []) {
      total += countWords(bullet)
    }
    if (section.callout) total += countWords(section.callout.text)
    for (const step of section.howToSteps ?? []) {
      total += countWords(step.name) + countWords(step.text)
    }
  }
  for (const item of faq) {
    total += countWords(item.question) + countWords(item.answer)
  }
  return total
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Temps de lecture estimé en minutes (200 mots/min, arrondi sup, min 1).
 */
export function computeReadingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200))
}
