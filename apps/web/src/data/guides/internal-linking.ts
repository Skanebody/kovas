/**
 * Schéma canonique de maillage interne entre guides `/guide/[type]`.
 *
 * Le mapping est curé manuellement pour maximiser la pertinence sémantique
 * (méthode Amandine Bart) : chaque guide pointe vers 3 à 5 voisins choisis
 * pour leur proximité métier (diagnostic souvent commandé ensemble) ou
 * réglementaire (déclenchement croisé d'obligations).
 *
 * Pourquoi cette structure séparée de `Guide.relatedTypes` ?
 *  - `Guide.relatedTypes` reste le minimum garanti dans la donnée du guide
 *    (3-4 entrées historiques) ;
 *  - `INTERNAL_LINKING_MAP` est la source de vérité du *maillage SEO* :
 *    elle peut élargir, réordonner et inclure des liens transverses
 *    sans modifier les guides eux-mêmes ;
 *  - `getRelatedGuides()` fusionne les deux en respectant l'ordre du map.
 */

import { GUIDE_REGISTRY, getRelatedGuides as getRelatedFromGuide } from '@/lib/guides/registry'
import type { Guide, GuideType } from '@/lib/guides/types'

/**
 * Liens recommandés guide → guides connexes (ordre = priorité éditoriale).
 *
 * Logique métier du maillage :
 *  - DPE ↔ Audit énergétique (déclenchement F/G/E) + Électricité + Gaz
 *    + ERP (info acquéreur) ;
 *  - Amiante ↔ Plomb (logements pré-1949 cumulés) + Termites + DPE
 *    + Électricité ;
 *  - Audit énergétique pivot des passoires : DPE + recommandations gaz/élec ;
 *  - Carrez utilitaire transverse, lié à DPE et ERP côté vente.
 */
export const INTERNAL_LINKING_MAP: Readonly<Record<GuideType, ReadonlyArray<GuideType>>> =
  Object.freeze({
    dpe: ['audit-energetique', 'electricite', 'gaz', 'erp', 'amiante'],
    amiante: ['plomb', 'termites', 'dpe', 'electricite', 'erp'],
    plomb: ['amiante', 'termites', 'electricite', 'dpe', 'erp'],
    gaz: ['electricite', 'dpe', 'audit-energetique', 'erp', 'amiante'],
    electricite: ['gaz', 'dpe', 'audit-energetique', 'amiante', 'erp'],
    termites: ['amiante', 'plomb', 'erp', 'electricite', 'dpe'],
    carrez: ['dpe', 'erp', 'amiante', 'electricite', 'audit-energetique'],
    erp: ['dpe', 'termites', 'amiante', 'plomb', 'carrez'],
    'audit-energetique': ['dpe', 'gaz', 'electricite', 'erp', 'amiante'],
  })

/**
 * Limite par défaut affichée dans `<RelatedGuides />` et dans la sidebar
 * du guide. Le menu déroulant `/guide` peut surcharger via le `limit`.
 */
export const DEFAULT_RELATED_GUIDES_LIMIT = 4 as const

/**
 * Retourne la liste ordonnée des guides connexes pour un slug donné.
 *
 * - Si le slug est inconnu, retourne `[]` (jamais d'exception).
 * - Filtre les guides introuvables côté registry (sécurité).
 * - `limit` (optionnel, défaut 4) cap la liste retournée.
 * - L'ordre suit `INTERNAL_LINKING_MAP[slug]`.
 *
 * Pure-fn : pas d'effet de bord, idempotente, testable.
 */
export function getRelatedGuides(
  slug: GuideType | string,
  limit: number = DEFAULT_RELATED_GUIDES_LIMIT,
): ReadonlyArray<Guide> {
  if (!isKnownGuideType(slug)) return []
  const related = INTERNAL_LINKING_MAP[slug]
  const guides: Guide[] = []
  for (const type of related) {
    const guide = GUIDE_REGISTRY[type]
    if (guide) guides.push(guide)
    if (guides.length >= limit) break
  }
  return guides
}

/**
 * Variante : fusionne le maillage curé `INTERNAL_LINKING_MAP` avec les
 * `relatedTypes` historiques du guide (utile en transition pour ne pas
 * casser les guides qui n'auraient pas encore d'entrée dans le map).
 *
 * Les entrées du map ont priorité sur celles du guide ; les doublons sont
 * filtrés. Le slug d'origine est toujours exclu.
 */
export function getMergedRelatedGuides(
  guide: Guide,
  limit: number = DEFAULT_RELATED_GUIDES_LIMIT,
): ReadonlyArray<Guide> {
  const fromMap = getRelatedGuides(guide.type, limit)
  if (fromMap.length >= limit) return fromMap

  const seen = new Set<GuideType>(fromMap.map((g) => g.type))
  seen.add(guide.type)
  const fallback = getRelatedFromGuide(guide).filter((g) => !seen.has(g.type))

  return [...fromMap, ...fallback].slice(0, limit)
}

function isKnownGuideType(value: string): value is GuideType {
  return value in INTERNAL_LINKING_MAP
}
