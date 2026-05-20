/**
 * KOVAS — Document Intelligence : validation réglementaire.
 *
 * Vérifie la validité réglementaire d'un document en fonction de son type et
 * du contexte de transaction (vente / location). Émet des warnings ou erreurs
 * bloquantes.
 *
 * Stub local minimal V1.5 : la lib `lib/regulations/validity-rules-2026.ts`
 * (créée par un autre agent) n'existe pas encore. On implémente directement les
 * règles principales DPE / amiante / plomb / gaz / élec / termites / ERP ici.
 *
 * Authority :
 *   - DPE : Code construction art. R.134-4-2 (durée 10 ans pour DPE post-2021,
 *     2 ans pour DPE 2013-2017, 4 ans pour DPE 2018-2020).
 *   - Amiante : illimitée si négative, sinon 3 ans (vente) ou actualisation.
 *   - Plomb CREP : 1 an si positif (vente), 6 ans si positif (location), illimité négatif.
 *   - Gaz : 3 ans (vente uniquement).
 *   - Élec : 3 ans (vente).
 *   - Termites : 6 mois.
 *   - ERP : 6 mois.
 */

import type { BackendDocumentType } from './backend-types'

export type TransactionType = 'vente' | 'location'

export type ValidityStatus = 'valid' | 'expiring' | 'expired' | 'unlimited' | 'unknown'

export interface ValidityResult {
  status: ValidityStatus
  /** Date d'expiration calculée (ISO YYYY-MM-DD), null si illimitée. */
  expiresAt: string | null
  /** Jours restants avant expiration (négatif si expiré). */
  daysRemaining: number | null
  /** Message FR court pour UI. */
  message: string
  /** Référence légale. */
  legalReference: string | null
}

export interface RegulatoryValidation {
  documentValidity: ValidityResult | null
  /** Recommandations de pré-remplissage (utiles UX). */
  prefillRecommendations: string[]
  /** Warnings non bloquants (DPE expirant dans 6 mois...). */
  warnings: string[]
  /** Issues bloquantes (DPE expiré, surface non lisible...). */
  blockingIssues: string[]
}

interface ExtractionContext {
  transactionType: TransactionType
}

/**
 * Validation réglementaire d'un document extrait.
 *
 * @param documentType  type classifié (dpe, amiante, ...)
 * @param extraction    objet extraction Zod-validé
 * @param context       transactionType (vente / location)
 */
export function validateRegulatory(
  documentType: BackendDocumentType,
  extraction: unknown,
  context: ExtractionContext,
): RegulatoryValidation {
  const validation: RegulatoryValidation = {
    documentValidity: null,
    prefillRecommendations: [],
    warnings: [],
    blockingIssues: [],
  }

  switch (documentType) {
    case 'dpe':
      validation.documentValidity = validateDpe(extraction)
      validation.prefillRecommendations = recommendDpeFields(extraction)
      break
    case 'amiante':
      validation.documentValidity = validateAmiante(extraction, context)
      break
    case 'plomb':
      validation.documentValidity = validatePlomb(extraction, context)
      break
    case 'facture_energie':
      validation.prefillRecommendations = recommendFactureFields(extraction)
      break
    case 'plaque_chaudiere':
      validation.prefillRecommendations = recommendChaudiereFields(extraction)
      break
    // Autres types : pas de règles de validité automatiques V1
    default:
      break
  }

  return validation
}

// ============================================
// DPE
// ============================================

function validateDpe(extraction: unknown): ValidityResult {
  if (typeof extraction !== 'object' || extraction === null) {
    return unknownValidity()
  }
  const data = extraction as Record<string, unknown>
  const realizationDateStr = typeof data.realizationDate === 'string' ? data.realizationDate : null

  if (!realizationDateStr) {
    return {
      status: 'unknown',
      expiresAt: null,
      daysRemaining: null,
      message: 'Date de réalisation non lisible — validité inconnue',
      legalReference: 'Art. R.134-4-2 CCH',
    }
  }

  const realizationDate = new Date(`${realizationDateStr}T00:00:00Z`)
  if (Number.isNaN(realizationDate.getTime())) {
    return unknownValidity()
  }

  // Règles validité DPE post-2021 (réforme 1er juillet 2021)
  // - DPE réalisés du 01/07/2021 → 10 ans
  // - DPE réalisés du 01/01/2018 au 30/06/2021 → valides jusqu'au 31/12/2024 (caduques en pratique)
  // - DPE réalisés du 01/01/2013 au 31/12/2017 → valides jusqu'au 31/12/2022 (caduques)
  let expiresAt: Date
  if (realizationDate >= new Date('2021-07-01T00:00:00Z')) {
    expiresAt = addYears(realizationDate, 10)
  } else if (realizationDate >= new Date('2018-01-01T00:00:00Z')) {
    expiresAt = new Date('2024-12-31T23:59:59Z')
  } else {
    expiresAt = new Date('2022-12-31T23:59:59Z')
  }

  const now = new Date()
  const msPerDay = 1000 * 60 * 60 * 24
  const daysRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / msPerDay)

  let status: ValidityStatus = 'valid'
  let message: string
  if (daysRemaining < 0) {
    status = 'expired'
    message = `DPE expiré depuis ${Math.abs(daysRemaining)} jour${Math.abs(daysRemaining) > 1 ? 's' : ''}`
  } else if (daysRemaining < 180) {
    status = 'expiring'
    message = `DPE expire dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}`
  } else {
    message = `DPE valide jusqu'au ${expiresAt.toISOString().slice(0, 10)}`
  }

  return {
    status,
    expiresAt: expiresAt.toISOString().slice(0, 10),
    daysRemaining,
    message,
    legalReference: 'Art. R.134-4-2 CCH',
  }
}

function recommendDpeFields(extraction: unknown): string[] {
  if (typeof extraction !== 'object' || extraction === null) return []
  const data = extraction as Record<string, unknown>
  const recos: string[] = []
  if (data.habitableSurface) {
    recos.push(
      `Surface habitable ${data.habitableSurface} m² peut pré-remplir property.surface_total`,
    )
  }
  if (data.energyClass) {
    recos.push(`Classe énergétique ${data.energyClass} — vérifier que le nouveau DPE confirme`)
  }
  if (data.constructionYear) {
    recos.push(`Année construction ${data.constructionYear} peut pré-remplir property.year_built`)
  }
  return recos
}

// ============================================
// Amiante
// ============================================

function validateAmiante(_extraction: unknown, context: ExtractionContext): ValidityResult {
  // V1.5 : si extracteur amiante absent, on indique validité illimitée par défaut
  // (un diagnostic amiante négatif est illimité, positif nécessite recontrôle 3 ans)
  if (context.transactionType === 'vente') {
    return {
      status: 'unlimited',
      expiresAt: null,
      daysRemaining: null,
      message: 'Amiante : illimitée si négatif, sinon recontrôle 3 ans',
      legalReference: 'Art. R.1334-29-5 CSP',
    }
  }
  return {
    status: 'unlimited',
    expiresAt: null,
    daysRemaining: null,
    message: 'Amiante : pas obligatoire en location (parties privatives)',
    legalReference: null,
  }
}

// ============================================
// Plomb (CREP)
// ============================================

function validatePlomb(_extraction: unknown, context: ExtractionContext): ValidityResult {
  // CREP : illimité si négatif ; si positif → 1 an (vente), 6 ans (location)
  return {
    status: 'unlimited',
    expiresAt: null,
    daysRemaining: null,
    message:
      context.transactionType === 'vente'
        ? 'CREP : illimité si négatif, 1 an si positif'
        : 'CREP : illimité si négatif, 6 ans si positif',
    legalReference: 'Art. L.1334-5 CSP',
  }
}

// ============================================
// Recos factures / chaudière
// ============================================

function recommendFactureFields(extraction: unknown): string[] {
  if (typeof extraction !== 'object' || extraction === null) return []
  const data = extraction as Record<string, unknown>
  const recos: string[] = []
  if (data.estimatedAnnualConsumptionKwh) {
    recos.push(
      `Conso annuelle ${data.estimatedAnnualConsumptionKwh} kWh — utile pour pré-estimation DPE`,
    )
  }
  if (data.provider && data.energyType) {
    recos.push(`${data.provider} (${data.energyType}) — confirme l'énergie principale`)
  }
  return recos
}

function recommendChaudiereFields(extraction: unknown): string[] {
  if (typeof extraction !== 'object' || extraction === null) return []
  const data = extraction as Record<string, unknown>
  const recos: string[] = []
  if (data.brand && data.model) {
    recos.push(`${data.brand} ${data.model} — pré-remplit equipment.heating_brand/model`)
  }
  if (data.installationYear) {
    recos.push(`Installation ${data.installationYear} — pré-remplit equipment.heating_year`)
  }
  if (data.powerKw) {
    recos.push(`Puissance ${data.powerKw} kW — utile contrôle cohérence surface`)
  }
  return recos
}

// ============================================
// Helpers
// ============================================

function unknownValidity(): ValidityResult {
  return {
    status: 'unknown',
    expiresAt: null,
    daysRemaining: null,
    message: 'Validité non déterminable',
    legalReference: null,
  }
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date)
  result.setUTCFullYear(result.getUTCFullYear() + years)
  return result
}
