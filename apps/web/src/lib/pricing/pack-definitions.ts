/**
 * KOVAS — 8 packs prédéfinis (Partition B).
 *
 * Combinaisons typiques de diagnostics + remise par défaut.
 * Le user copie le pack dans `user_pricing_packs` puis ajuste prix / nom.
 *
 * Note : on utilise `PricingDiagnosticType` (incluant BOUTIN) car certains
 * packs location utilisent Boutin (loi 6 juillet 1989) plutôt que Carrez (loi Carrez).
 */

import type { PricingDiagnosticType } from './pricing-templates'

export type PackApplicableFor = 'vente' | 'location' | 'mise_en_copro'

export interface PredefinedPack {
  id: string
  name: string
  description: string
  diagnostics: PricingDiagnosticType[]
  /** Remise par défaut (%) appliquée vs somme itemized. Indicatif, ajustable user. */
  defaultDiscountPercent: number
  applicableFor: PackApplicableFor[]
  propertyConditions?: {
    /** Année minimale de construction (ex: 1949 → bien construit AVANT 1949). */
    minAge?: number
    /** Description libre des conditions (FR). */
    requiredFor?: string
  }
}

export const PREDEFINED_PACKS: PredefinedPack[] = [
  // ============================================
  // LOCATION
  // ============================================
  {
    id: 'pack-location-standard',
    name: 'Location standard',
    description: 'Diagnostics minimaux pour une mise en location classique.',
    diagnostics: ['DPE', 'ERP'],
    defaultDiscountPercent: 5,
    applicableFor: ['location'],
  },
  {
    id: 'pack-location-ancien',
    name: 'Location bien ancien (< 1949)',
    description: 'Ajoute Plomb (CREP) + Boutin pour les biens construits avant 1949.',
    diagnostics: ['DPE', 'ERP', 'PLOMB', 'BOUTIN'],
    defaultDiscountPercent: 8,
    applicableFor: ['location'],
    propertyConditions: {
      minAge: 1949,
      requiredFor: 'Biens construits avant le 1er janvier 1949 (loi de 1948).',
    },
  },
  {
    id: 'pack-location-equipements',
    name: 'Location avec équipements (gaz + élec)',
    description: 'Pour biens avec installations gaz/élec > 15 ans.',
    diagnostics: ['DPE', 'ERP', 'GAZ', 'ELEC', 'BOUTIN'],
    defaultDiscountPercent: 10,
    applicableFor: ['location'],
  },

  // ============================================
  // VENTE — APPARTEMENT
  // ============================================
  {
    id: 'pack-vente-appartement-recent',
    name: 'Vente appartement récent',
    description: 'Appartement post-1997, sans amiante ni équipements > 15 ans.',
    diagnostics: ['DPE', 'ERP', 'CARREZ'],
    defaultDiscountPercent: 5,
    applicableFor: ['vente'],
  },
  {
    id: 'pack-vente-appartement-ancien',
    name: 'Vente appartement ancien (< 1997)',
    description: 'Appartement avec amiante + gaz + élec — construit avant 1997.',
    diagnostics: ['DPE', 'AMIANTE', 'CARREZ', 'ERP', 'GAZ', 'ELEC'],
    defaultDiscountPercent: 12,
    applicableFor: ['vente'],
    propertyConditions: {
      minAge: 1997,
      requiredFor: 'Permis de construire délivré avant le 1er juillet 1997 (interdiction amiante).',
    },
  },
  {
    id: 'pack-vente-appartement-tres-ancien',
    name: 'Vente appartement très ancien (< 1949)',
    description: 'Appartement avec plomb + amiante + équipements anciens.',
    diagnostics: ['DPE', 'AMIANTE', 'PLOMB', 'CARREZ', 'ERP', 'GAZ', 'ELEC'],
    defaultDiscountPercent: 15,
    applicableFor: ['vente'],
    propertyConditions: {
      minAge: 1949,
      requiredFor: 'Bien construit avant 1949.',
    },
  },

  // ============================================
  // VENTE — MAISON
  // ============================================
  {
    id: 'pack-vente-maison-recente',
    name: 'Vente maison récente',
    description: 'Maison post-1997 en zone termites.',
    diagnostics: ['DPE', 'ERP', 'TERMITES'],
    defaultDiscountPercent: 5,
    applicableFor: ['vente'],
  },
  {
    id: 'pack-vente-maison-ancienne',
    name: 'Vente maison ancienne (< 1949)',
    description: 'Maison ancienne complète : amiante + plomb + termites + gaz + élec.',
    diagnostics: ['DPE', 'AMIANTE', 'PLOMB', 'TERMITES', 'GAZ', 'ELEC', 'ERP'],
    defaultDiscountPercent: 15,
    applicableFor: ['vente'],
    propertyConditions: {
      minAge: 1949,
      requiredFor: 'Maison construite avant 1949.',
    },
  },
]

export function getPredefinedPack(id: string): PredefinedPack | null {
  return PREDEFINED_PACKS.find((p) => p.id === id) ?? null
}
