/**
 * KOVAS — Prompt builder méthode Amandine Bart pour Claude Haiku.
 *
 * Encode les 7 piliers Amandine Bart en instructions structurées :
 *  1. Intent-match obsessionnel
 *  2. E-E-A-T renforcé (sources Légifrance / ADEME / INSEE)
 *  3. Structure pyramidale (H1 / H2 / H3 + sommaire si > 2000 mots)
 *  4. Densité naturelle (1-2% mot-clé, synonymes + variantes)
 *  5. Internal linking (3-5 liens internes minimum)
 *  6. Featured snippets optimisés (réponses 40-60 mots)
 *  7. Update freshness (date de mise à jour visible)
 *
 * Avatar référent : diagnostiqueur 43 ans, ex-cadre reconverti, SOBRE PROFESSIONNEL.
 * Ton : vouvoiement, zéro emoji marketing, registre éditorial premium.
 */

import type { SearchIntent, VeilleCategory } from './seo-keywords'

export interface AmandineBartPromptInput {
  readonly targetKeyword: string
  readonly topic: string
  readonly category: VeilleCategory
  readonly intent: SearchIntent
  readonly recommendedWordCount: number
  readonly currentDateIso: string
}

const INTERNAL_LINK_TARGETS = [
  { slug: '/diagnostic/dpe', label: 'guide DPE' },
  { slug: '/diagnostic/amiante', label: 'diagnostic amiante' },
  { slug: '/diagnostic/audit-energetique', label: 'audit énergétique' },
  { slug: '/diagnostic/plomb', label: 'CREP plomb' },
  { slug: '/diagnostic/gaz', label: 'diagnostic gaz' },
  { slug: '/diagnostic/electricite', label: 'diagnostic électrique' },
  { slug: '/diagnostic/termites', label: 'diagnostic termites' },
  { slug: '/diagnostic/carrez', label: 'loi Carrez' },
  { slug: '/diagnostic/erp', label: 'État des risques (ERP)' },
  { slug: '/observatoire', label: 'Observatoire du diagnostic' },
  { slug: '/diagnostiqueurs', label: 'annuaire diagnostiqueurs' },
] as const

function formatInternalLinks(): string {
  return INTERNAL_LINK_TARGETS.map((l) => `  - [${l.label}](${l.slug})`).join('\n')
}

function categoryGuidance(category: VeilleCategory): string {
  switch (category) {
    case 'reglementaire':
      return `Citez OBLIGATOIREMENT au moins 2 sources officielles (Légifrance.gouv.fr ou ADEME.fr) avec lien et date du texte. Indiquez le calendrier d'application précis (dates d'entrée en vigueur).`
    case 'pratique':
      return 'Donnez des conseils opérationnels chiffrés (prix moyens en €, délais en jours, durées de validité). Listez les pièges courants. Incluez une section « Démarches étape par étape ».'
    case 'technique':
      return 'Détaillez la méthodologie (calculs, protocoles, instruments). Citez les normes applicables (NF, EN, ISO). Donnez des exemples chiffrés.'
    case 'marche':
      return 'Appuyez-vous sur des données chiffrées récentes (Observatoire ADEME, INSEE). Donnez des comparaisons régionales si pertinent. Incluez 2-3 statistiques marquantes.'
    case 'jurisprudence':
      return `Citez les décisions de justice (Cour de cassation, Conseil d'État, Cour d'appel) avec leur référence (numéro de pourvoi, date). Expliquez la portée pratique pour le diagnostiqueur.`
    default:
      return ''
  }
}

function intentGuidance(intent: SearchIntent): string {
  switch (intent) {
    case 'informational':
      return `L'utilisateur cherche à comprendre. Ne vendez rien dans l'introduction. Apportez la réponse directe et chiffrée en premier paragraphe (40-60 mots, format featured snippet).`
    case 'commercial':
      return `L'utilisateur évalue des options. Donnez des fourchettes de prix précises, des critères de choix, des comparatifs. Le CTA final vers KOVAS doit être discret et utile.`
    case 'transactional':
      return `L'utilisateur veut agir. Structurez en étapes concrètes. Le CTA principal en fin d'article peut renvoyer vers /diagnostic/[type] ou /diagnostiqueurs/.`
    case 'navigational':
      return `L'utilisateur cherche une page précise. Soyez direct et fournissez la réponse immédiate.`
    default:
      return ''
  }
}

export function buildAmandineBartSystemPrompt(): string {
  return `Vous êtes Amandine Bart, experte SEO francophone reconnue pour la méthode E-E-A-T appliquée aux secteurs techniques B2B et B2C, et conseillère éditoriale de la plateforme KOVAS (logiciel SaaS pour diagnostiqueurs immobiliers indépendants en France).

Vous rédigez en français, registre éditorial premium, SOBRE PROFESSIONNEL, VOUVOIEMENT obligatoire. Aucun emoji marketing. Aucune formule racoleuse.

Avatar du lecteur cible : diagnostiqueur immobilier 43 ans, ex-cadre reconverti, exigeant sur la rigueur réglementaire. Il déteste les contenus creux ou les approximations.

Votre méthode en 7 piliers :

1. INTENT-MATCH OBSESSIONNEL — le premier paragraphe (40-60 mots) doit donner la réponse directe attendue par la requête. Format featured snippet.

2. E-E-A-T RENFORCÉ — Experience (exemples concrets, retours terrain), Expertise (vocabulaire technique précis), Authoritativeness (citations Légifrance, ADEME, INSEE, COFRAC avec liens), Trustworthiness (dates de mise à jour, disclaimers).

3. STRUCTURE PYRAMIDALE — H1 contient le mot-clé exact, H2 = sous-intentions, H3 = détails. Si article > 2000 mots, ajoutez un sommaire en début (liste de liens d''ancrage Markdown).

4. DENSITÉ NATURELLE — mot-clé cible : 1 à 2 % d''occurrences (jamais plus). Utilisez 4-6 synonymes et variantes orthographiques pour enrichir naturellement.

5. INTERNAL LINKING — insérez 3 à 5 liens internes minimum (ancres descriptives, jamais « cliquer ici » ou « ici »). Cibles disponibles sur KOVAS :
${formatInternalLinks()}

6. FEATURED SNIPPETS — pour chaque question importante, rédigez une réponse directe de 40-60 mots, claire et autonome. Privilégiez les listes structurées pour les énumérations.

7. UPDATE FRESHNESS — terminez l''article par une mention de mise à jour : "Mise à jour : [date au format JJ mois AAAA]".

Format de sortie attendu :
- Markdown pur (pas de HTML)
- H1 unique en début (# Titre)
- Sections H2 (## Section)
- Sous-sections H3 quand nécessaire (### Sous-section)
- Liens Markdown : [ancre](url)
- Citations sources officielles : « selon [Légifrance](https://legifrance.gouv.fr/...) »
- Section finale "## Questions fréquentes" avec 4-6 questions/réponses (chaque réponse 40-60 mots)
- Disclaimer final : "*Cet article a vocation informative. Pour toute situation particulière, consultez un diagnostiqueur certifié COFRAC ou un conseiller juridique.*"
- Mise à jour : date du jour`
}

export function buildAmandineBartUserPrompt(input: AmandineBartPromptInput): string {
  const formattedDate = new Date(input.currentDateIso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return `Rédigez un article éditorial complet pour la veille KOVAS sur le sujet suivant :

TOPIC : ${input.topic}
MOT-CLÉ CIBLE PRINCIPAL : "${input.targetKeyword}"
CATÉGORIE : ${input.category}
INTENTION DE RECHERCHE : ${input.intent}
LONGUEUR CIBLE : ${input.recommendedWordCount} mots (±10 %)
DATE DE PUBLICATION : ${formattedDate}

CONSIGNE SPÉCIFIQUE CATÉGORIE :
${categoryGuidance(input.category)}

CONSIGNE SPÉCIFIQUE INTENTION :
${intentGuidance(input.intent)}

EXIGENCES NON NÉGOCIABLES :
- 1500 à 3000 mots
- H1 contient le mot-clé exact "${input.targetKeyword}"
- Sommaire avec liens d''ancrage si > 2000 mots
- Au moins 4 sections H2
- Au moins 2 citations de sources officielles avec liens (Légifrance, ADEME, INSEE, etc.)
- Au moins 3 liens internes vers les cibles KOVAS listées
- Section "## Questions fréquentes" avec 4 à 6 questions
- Première phrase = réponse directe 40-60 mots (featured snippet)
- Aucun emoji
- Vouvoiement
- Ton sobre professionnel

Produisez maintenant l''article en Markdown pur.`
}

/**
 * Slug builder pour l'URL de l'article (kebab-case, sans accents).
 */
export function buildSlug(title: string, fallback: string): string {
  const base = title || fallback
  return base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

/**
 * Extrait l'excerpt (~150 chars) depuis le contenu Markdown.
 */
export function extractExcerpt(markdown: string, maxLength = 160): string {
  const stripped = markdown
    .replace(/^#+\s+.+$/gm, '') // Remove headings
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Strip links
    .replace(/[*_`>]/g, '')
    .replace(/\n+/g, ' ')
    .trim()

  if (stripped.length <= maxLength) return stripped
  const truncated = stripped.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`
}

/**
 * Extrait le H1 (titre principal) depuis le Markdown.
 */
export function extractTitle(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match?.[1]?.trim() ?? fallback
}
