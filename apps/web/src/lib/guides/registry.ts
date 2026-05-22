/**
 * Registry des 9 guides longs SEO.
 *
 * Source unique de vérité pour les pages `/guide/[type]` et `/guide`.
 * Tout ajout d'un nouveau guide se fait via l'import ici + ajout dans
 * `GUIDE_REGISTRY` + ajout du slug dans `sitemap-guides.xml`.
 */

import { AMIANTE_GUIDE } from './content/amiante'
import { AUDIT_ENERGETIQUE_GUIDE } from './content/audit-energetique'
import { CARREZ_GUIDE } from './content/carrez'
import { DPE_GUIDE } from './content/dpe'
import { ELECTRICITE_GUIDE } from './content/electricite'
import { ERP_GUIDE } from './content/erp'
import { GAZ_GUIDE } from './content/gaz'
import { PLOMB_GUIDE } from './content/plomb'
import { TERMITES_GUIDE } from './content/termites'
import type { Guide, GuideType } from './types'

/**
 * Registry indexé par type. Ordre d'insertion = ordre d'affichage par défaut
 * sur l'index `/guide` (modifiable via category filter ou tri custom).
 */
export const GUIDE_REGISTRY: Readonly<Record<GuideType, Guide>> = Object.freeze({
  dpe: DPE_GUIDE,
  amiante: AMIANTE_GUIDE,
  plomb: PLOMB_GUIDE,
  gaz: GAZ_GUIDE,
  electricite: ELECTRICITE_GUIDE,
  termites: TERMITES_GUIDE,
  carrez: CARREZ_GUIDE,
  erp: ERP_GUIDE,
  'audit-energetique': AUDIT_ENERGETIQUE_GUIDE,
})

/** Liste ordonnée des guides (tableau plat pour itération facile). */
export const GUIDES_LIST: ReadonlyArray<Guide> = Object.values(GUIDE_REGISTRY)

/** Liste des slugs supportés (utile pour `generateStaticParams`). */
export const GUIDE_SLUGS: ReadonlyArray<GuideType> = Object.keys(
  GUIDE_REGISTRY,
) as GuideType[]

/**
 * Récupère un guide par son slug. Retourne `null` si introuvable
 * (permet de déclencher `notFound()` dans la page dynamique).
 */
export function getGuideBySlug(slug: string): Guide | null {
  if (!isGuideType(slug)) return null
  return GUIDE_REGISTRY[slug]
}

/** Type guard : vérifie qu'une string est un GuideType valide. */
export function isGuideType(value: string): value is GuideType {
  return value in GUIDE_REGISTRY
}

/**
 * Récupère les guides connexes pour un guide donné (3-4 cross-links).
 * Filtre les guides introuvables (sécurité).
 */
export function getRelatedGuides(guide: Guide): ReadonlyArray<Guide> {
  return guide.relatedTypes
    .map((type) => GUIDE_REGISTRY[type])
    .filter((g): g is Guide => g !== undefined)
}
