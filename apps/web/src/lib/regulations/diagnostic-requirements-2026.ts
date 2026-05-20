/**
 * KOVAS — Calculateur des diagnostics obligatoires (mai 2026).
 *
 * Authority : Code de la construction et de l'habitation, Loi Carrez/Boutin,
 * arrêtés préfectoraux termites.
 *
 * Référence : brief module Utilities §1.1.
 *
 * Règles synthétiques :
 * - DPE + ERP : toujours (sauf neuf non encore livré, hors périmètre V1)
 * - AMIANTE : permis de construire < 01/07/1997
 * - PLOMB CREP : construction < 1949
 * - GAZ/ELEC : installation > 15 ans
 * - TERMITES : selon arrêté préfectoral (liste de départements ciblés)
 * - CARREZ : copropriété + vente
 * - BOUTIN : location
 * - Audit énergétique : warning si vente + classe E/F/G
 */

import type { DiagnosticType } from '@/lib/mission/types'

// ============================================
// 1. Liste des départements concernés par termites
// ============================================

/**
 * Départements FR sous arrêté préfectoral termites (extrait V1, non exhaustif).
 * Source : arrêtés préfectoraux consolidés 2025 — à enrichir post-bêta.
 */
export const TERMITES_DEPARTMENTS: readonly string[] = [
  '11', // Aude
  '13', // Bouches-du-Rhône
  '17', // Charente-Maritime
  '24', // Dordogne
  '30', // Gard
  '33', // Gironde
  '34', // Hérault
  '40', // Landes
  '47', // Lot-et-Garonne
  '64', // Pyrénées-Atlantiques
  '66', // Pyrénées-Orientales
  '76', // Seine-Maritime
  '83', // Var
  '84', // Vaucluse
]

export function isTermitesDepartment(postalCode: string): boolean {
  const dept = postalCode.trim().slice(0, 2)
  return TERMITES_DEPARTMENTS.includes(dept)
}

// ============================================
// 2. Types publics
// ============================================

export type PropertyType = 'house' | 'apartment' | 'commercial' | 'other'

export type OwnershipType = 'single' | 'copropriete'

export type TransactionType = 'sale' | 'rental'

export type EnergyClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null

export interface RequirementsInput {
  /** Année de construction (permis de construire). */
  constructionYear: number
  propertyType: PropertyType
  ownership: OwnershipType
  transactionType: TransactionType
  postalCode: string
  /** Y a-t-il une installation gaz ? */
  hasGas: boolean
  /** L'installation électrique a plus de 15 ans ? */
  hasElectricity15Plus: boolean
  /** Classe DPE existante (si connue) — déclenche éventuel audit énergétique. */
  knownEnergyClass?: EnergyClass
}

export type RequirementCategory = 'required' | 'conditional' | 'not_required'

export interface RequirementItem {
  diagnosticType: DiagnosticType | 'AUDIT_ENERGETIQUE' | 'BOUTIN'
  /** Label FR pour l'UI. */
  label: string
  category: RequirementCategory
  /** Justification réglementaire (FR, courte). */
  rationale: string
  /** Référence réglementaire affichée. */
  referenceRule: string
  /** Mission_type recommandé pour pré-cocher la création du dossier. */
  suggestedMissionType?: string
}

export interface RequirementsResult {
  required: RequirementItem[]
  conditional: RequirementItem[]
  notRequired: RequirementItem[]
  /** Warnings additionnels (audit énergétique, etc.). */
  warnings: string[]
}

// ============================================
// 3. Calcul
// ============================================

function buildItem(
  diagnosticType: RequirementItem['diagnosticType'],
  label: string,
  category: RequirementCategory,
  rationale: string,
  referenceRule: string,
  suggestedMissionType?: string,
): RequirementItem {
  return { diagnosticType, label, category, rationale, referenceRule, suggestedMissionType }
}

export function calculateRequiredDiagnostics(input: RequirementsInput): RequirementsResult {
  const results: RequirementItem[] = []
  const warnings: string[] = []

  // --- DPE : toujours (hors neuf non livré).
  results.push(
    buildItem(
      'DPE',
      'Diagnostic de Performance Énergétique',
      'required',
      input.transactionType === 'sale'
        ? 'Obligatoire à la vente depuis 1996, version 3CL-2021 opposable.'
        : 'Obligatoire à la location (annexe au bail).',
      'Code construction et habitation L.126-26 + L.271-4',
      input.transactionType === 'sale' ? 'dpe_vente' : 'dpe_location',
    ),
  )

  // --- ERP : toujours.
  results.push(
    buildItem(
      'ERP',
      'État des Risques et Pollutions',
      'required',
      'Obligatoire toute transaction immobilière (vente ou location) — Géorisques.',
      "Code de l'environnement L.125-5",
      'erp',
    ),
  )

  // --- AMIANTE : permis de construire < 01/07/1997.
  if (input.constructionYear < 1997) {
    results.push(
      buildItem(
        'AMIANTE',
        'Repérage amiante',
        'required',
        `Permis de construire de ${input.constructionYear} — antérieur au 01/07/1997.`,
        'Code de la santé publique R.1334-15',
        input.transactionType === 'sale' ? 'amiante_vente' : 'amiante_vente',
      ),
    )
  } else {
    results.push(
      buildItem(
        'AMIANTE',
        'Repérage amiante',
        'not_required',
        `Construction post-1997 (${input.constructionYear}) — pas d'amiante réglementaire.`,
        'Code de la santé publique R.1334-15',
      ),
    )
  }

  // --- PLOMB CREP : construction < 1949.
  if (input.constructionYear < 1949) {
    results.push(
      buildItem(
        'PLOMB',
        "CREP (Constat de Risque d'Exposition au Plomb)",
        'required',
        `Bâtiment de ${input.constructionYear} — antérieur au 01/01/1949.`,
        'Code de la santé publique L.1334-5 à L.1334-9',
        'plomb_crep',
      ),
    )
  } else {
    results.push(
      buildItem(
        'PLOMB',
        'CREP (plomb)',
        'not_required',
        `Construction post-1949 (${input.constructionYear}) — pas de CREP obligatoire.`,
        'Code de la santé publique L.1334-5',
      ),
    )
  }

  // --- GAZ : si installation gaz présente ET > 15 ans.
  if (input.hasGas) {
    results.push(
      buildItem(
        'GAZ',
        'Diagnostic Gaz (DIGI)',
        'required',
        'Installation gaz présente — obligation au-delà de 15 ans.',
        'Décret n° 2006-1147 du 14/09/2006',
        'gaz',
      ),
    )
  } else {
    results.push(
      buildItem(
        'GAZ',
        'Diagnostic Gaz (DIGI)',
        'not_required',
        "Pas d'installation gaz déclarée.",
        'Décret n° 2006-1147',
      ),
    )
  }

  // --- ELEC : si installation > 15 ans.
  if (input.hasElectricity15Plus) {
    results.push(
      buildItem(
        'ELEC',
        'Diagnostic Électricité (DIE)',
        'required',
        'Installation électrique > 15 ans — obligation diagnostic.',
        'Décret n° 2008-384 du 22/04/2008',
        'electricite',
      ),
    )
  } else {
    results.push(
      buildItem(
        'ELEC',
        'Diagnostic Électricité (DIE)',
        'conditional',
        'Installation < 15 ans déclarée — vérifier sur place avant de confirmer.',
        'Décret n° 2008-384',
      ),
    )
  }

  // --- TERMITES : selon postal_code (arrêté préfectoral).
  if (isTermitesDepartment(input.postalCode)) {
    results.push(
      buildItem(
        'TERMITES',
        'État termites',
        'required',
        `Département ${input.postalCode.slice(0, 2)} — arrêté préfectoral termites en vigueur.`,
        'Code construction L.133-6',
        'termites',
      ),
    )
  } else {
    results.push(
      buildItem(
        'TERMITES',
        'État termites',
        'conditional',
        `Département ${input.postalCode.slice(0, 2)} hors zone obligatoire — vérifier l'arrêté préfectoral à jour.`,
        'Code construction L.133-6',
      ),
    )
  }

  // --- CARREZ : copropriété + vente.
  if (input.ownership === 'copropriete' && input.transactionType === 'sale') {
    results.push(
      buildItem(
        'CARREZ',
        'Loi Carrez (surface privative)',
        'required',
        'Copropriété + vente — mesurage Carrez obligatoire.',
        'Loi n° 96-1107 du 18/12/1996',
        'carrez_boutin',
      ),
    )
  } else if (input.transactionType === 'sale') {
    results.push(
      buildItem(
        'CARREZ',
        'Loi Carrez',
        'not_required',
        'Bien non copropriété — loi Carrez non applicable.',
        'Loi n° 96-1107',
      ),
    )
  }

  // --- BOUTIN : location.
  if (input.transactionType === 'rental') {
    results.push(
      buildItem(
        'BOUTIN',
        'Loi Boutin (surface habitable)',
        'required',
        'Location — surface habitable Boutin obligatoire pour le bail.',
        'Loi n° 2009-323 du 25/03/2009',
        'carrez_boutin',
      ),
    )
  }

  // --- Warning audit énergétique (vente + DPE E/F/G).
  if (input.transactionType === 'sale' && input.knownEnergyClass) {
    const c = input.knownEnergyClass
    if (c === 'E' || c === 'F' || c === 'G') {
      warnings.push(
        `Classe DPE ${c} en vente : audit énergétique réglementaire obligatoire (Loi Climat & Résilience, art. L.126-28-1). Hors périmètre V1 KOVAS — à confier à un auditeur certifié.`,
      )
    }
  }

  return {
    required: results.filter((r) => r.category === 'required'),
    conditional: results.filter((r) => r.category === 'conditional'),
    notRequired: results.filter((r) => r.category === 'not_required'),
    warnings,
  }
}
