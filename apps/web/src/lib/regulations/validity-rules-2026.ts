/**
 * KOVAS — Règles de validité des diagnostics existants (mai 2026).
 *
 * Authority : Code de la construction et de l'habitation + décrets DPE 2021/2024.
 * Référence : brief module Utilities §1.2.
 *
 * Toutes les dates manipulées sont des `Date` UTC. Les "X mois/années" sont
 * calculés en arithmétique calendaire stricte (pas en millisecondes — sinon
 * les années bissextiles décalent les seuils).
 */

import type { DiagnosticType } from '@/lib/mission/types'

// ============================================
// 1. Types publics
// ============================================

/** Statut renvoyé par checkValidity. */
export type ValidityStatus = 'valid' | 'expiring_soon' | 'expired' | 'unlimited'

/** Résultat positif/négatif des diagnostics amiante / plomb. */
export type DiagnosticResult = 'negative' | 'positive' | 'unknown'

/** Contexte transaction utilisé pour PLOMB / GAZ / ELEC. */
export type TransactionContext = 'sale' | 'rental' | 'unknown'

export interface ValidityCheckInput {
  diagnosticType: DiagnosticType
  /** Date de réalisation du diagnostic (ISO date YYYY-MM-DD acceptée). */
  performedAt: string | Date
  /** Optionnel — résultat amiante/plomb. Modifie la durée de validité. */
  result?: DiagnosticResult
  /** Optionnel — contexte transaction. Modifie la validité plomb/gaz/élec. */
  transaction?: TransactionContext
}

export interface ValidityResult {
  status: ValidityStatus
  /** Date d'expiration calculée (null pour 'unlimited'). */
  expiresAt: Date | null
  /** Nombre de jours avant expiration (négatif si expiré). null pour 'unlimited'. */
  daysRemaining: number | null
  /** Message FR court à afficher utilisateur (statut + horizon). */
  message: string
  /** Référence réglementaire affichée à l'utilisateur. */
  referenceRule: string
  /** Recommandation actionnable FR (refaire / patienter / etc.). */
  recommendation: string
}

// ============================================
// 2. Helpers calendaires
// ============================================

const MS_PER_DAY = 86_400_000

function toDate(input: string | Date): Date {
  if (input instanceof Date) return new Date(input.getTime())
  // Force UTC pour éviter les décalages timezone.
  // Si chaîne ISO sans Z, on assume minuit UTC.
  const ms = Date.parse(input)
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid date input: ${String(input)}`)
  }
  return new Date(ms)
}

function addYears(d: Date, years: number): Date {
  const out = new Date(d.getTime())
  out.setUTCFullYear(out.getUTCFullYear() + years)
  return out
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime())
  out.setUTCMonth(out.getUTCMonth() + months)
  return out
}

function daysBetween(now: Date, target: Date): number {
  return Math.floor((target.getTime() - now.getTime()) / MS_PER_DAY)
}

function statusForExpiry(expiresAt: Date, now: Date): ValidityStatus {
  const days = daysBetween(now, expiresAt)
  if (days < 0) return 'expired'
  if (days < 90) return 'expiring_soon'
  return 'valid'
}

function formatFR(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })
}

// ============================================
// 3. Helpers de message
// ============================================

function buildResult(
  expiresAt: Date | null,
  now: Date,
  referenceRule: string,
  recommendationByStatus: Record<ValidityStatus, string>,
): ValidityResult {
  if (expiresAt === null) {
    return {
      status: 'unlimited',
      expiresAt: null,
      daysRemaining: null,
      message: 'Validité illimitée',
      referenceRule,
      recommendation: recommendationByStatus.unlimited,
    }
  }

  const days = daysBetween(now, expiresAt)
  const status = statusForExpiry(expiresAt, now)
  let message: string
  switch (status) {
    case 'expired':
      message = `Expiré depuis ${Math.abs(days)} jour${Math.abs(days) > 1 ? 's' : ''} (${formatFR(expiresAt)})`
      break
    case 'expiring_soon':
      message = `Expire dans ${days} jour${days > 1 ? 's' : ''} (${formatFR(expiresAt)})`
      break
    default:
      message = `Valide jusqu'au ${formatFR(expiresAt)}`
  }

  return {
    status,
    expiresAt,
    daysRemaining: days,
    message,
    referenceRule,
    recommendation: recommendationByStatus[status],
  }
}

// ============================================
// 4. Règles par diagnostic
// ============================================

function checkDPE(performedAt: Date, now: Date): ValidityResult {
  const year = performedAt.getUTCFullYear()
  const month = performedAt.getUTCMonth() + 1 // 1-12
  const referenceRule = 'Décret n° 2020-1610 du 17/12/2020 + Arrêté 31/03/2021 (régime 3CL-2021)'

  // DPE pré-2013 : obsolète (n'a plus de valeur opposable).
  if (year < 2013) {
    return {
      status: 'expired',
      expiresAt: new Date(Date.UTC(2013, 0, 1)),
      daysRemaining: -daysBetween(new Date(Date.UTC(2013, 0, 1)), now),
      message: `DPE pré-2013 (${formatFR(performedAt)}) — obsolète, non opposable`,
      referenceRule,
      recommendation: "Refaire un DPE en méthode 3CL-2021 — la version 2013 n'est plus reconnue.",
    }
  }

  // DPE 2013-2017 : expirés au 31/12/2022.
  if (year >= 2013 && year <= 2017) {
    const expiresAt = new Date(Date.UTC(2022, 11, 31))
    return buildResult(expiresAt, now, referenceRule, {
      valid: 'Toujours valable.',
      expiring_soon: 'Toujours valable mais proche de la limite réglementaire.',
      expired:
        'Refaire un DPE 3CL-2021. Les anciens DPE 2013-2017 ne sont plus valables depuis le 01/01/2023.',
      unlimited: 'Toujours valable.',
    })
  }

  // DPE 2018 à 30/06/2021 : expirés au 31/12/2024.
  if (year < 2021 || (year === 2021 && month <= 6)) {
    const expiresAt = new Date(Date.UTC(2024, 11, 31))
    return buildResult(expiresAt, now, referenceRule, {
      valid: 'Toujours valable.',
      expiring_soon: 'Anticiper un renouvellement avant le 31/12/2024.',
      expired:
        'Refaire un DPE 3CL-2021 — les DPE 2018 à juin 2021 ne sont plus valables depuis le 01/01/2025.',
      unlimited: 'Toujours valable.',
    })
  }

  // DPE post-01/07/2021 : 10 ans glissants.
  const expiresAt = addYears(performedAt, 10)
  return buildResult(expiresAt, now, referenceRule, {
    valid: 'DPE 3CL-2021 valide, aucune action.',
    expiring_soon: 'Planifier un renouvellement dans les 3 mois.',
    expired: 'Refaire un DPE — la validité 10 ans est dépassée.',
    unlimited: 'DPE 3CL-2021 valide.',
  })
}

function checkAmiante(performedAt: Date, now: Date, result: DiagnosticResult): ValidityResult {
  const year = performedAt.getUTCFullYear()
  const referenceRule =
    'Code de la santé publique art. R.1334-15 + Décret n° 2011-629 du 03/06/2011'

  // Pré-2013 (avant l'évolution réglementaire 2011-2013) : à refaire.
  if (year < 2013) {
    return {
      status: 'expired',
      expiresAt: new Date(Date.UTC(2013, 0, 1)),
      daysRemaining: -daysBetween(new Date(Date.UTC(2013, 0, 1)), now),
      message: 'Repérage amiante pré-2013 — à refaire au format actuel',
      referenceRule,
      recommendation:
        'Refaire un repérage amiante (DTA / repérage avant-vente) selon la réglementation post-2013.',
    }
  }

  // Post-2013, négatif → illimité.
  if (result === 'negative' || result === 'unknown') {
    return {
      status: 'unlimited',
      expiresAt: null,
      daysRemaining: null,
      message:
        result === 'negative'
          ? 'Repérage négatif post-2013 — validité illimitée'
          : 'Repérage post-2013 — validité illimitée si négatif',
      referenceRule,
      recommendation:
        result === 'unknown'
          ? 'Confirmer le résultat (négatif/positif) pour déterminer la validité exacte.'
          : 'Pas de renouvellement nécessaire si aucun travaux modifiant les matériaux.',
    }
  }

  // Post-2013, positif → contrôle visuel obligatoire tous les 3 ans.
  const expiresAt = addYears(performedAt, 3)
  return buildResult(expiresAt, now, referenceRule, {
    valid: 'Contrôle visuel obligatoire tous les 3 ans — toujours valable.',
    expiring_soon: 'Planifier un contrôle visuel triennal avant expiration.',
    expired: 'Contrôle visuel triennal en retard — à refaire sans délai.',
    unlimited: 'Toujours valable.',
  })
}

function checkPlomb(
  performedAt: Date,
  now: Date,
  result: DiagnosticResult,
  transaction: TransactionContext,
): ValidityResult {
  const referenceRule = 'Code de la santé publique art. L.1334-5 à L.1334-9 (CREP)'

  if (result === 'negative' || result === 'unknown') {
    return {
      status: 'unlimited',
      expiresAt: null,
      daysRemaining: null,
      message:
        result === 'negative'
          ? 'CREP négatif (< seuil 1 mg/cm²) — validité illimitée'
          : 'CREP — validité illimitée si négatif',
      referenceRule,
      recommendation:
        result === 'unknown'
          ? 'Confirmer le résultat pour calculer la validité exacte.'
          : 'Aucun renouvellement nécessaire (CREP négatif).',
    }
  }

  // Positif : 1 an vente, 6 ans location.
  const years = transaction === 'rental' ? 6 : 1
  const ctxLabel = transaction === 'rental' ? 'location' : 'vente'
  const expiresAt = addYears(performedAt, years)
  return buildResult(expiresAt, now, referenceRule, {
    valid: `CREP positif (${ctxLabel}) — toujours valable (${years} an${years > 1 ? 's' : ''} max).`,
    expiring_soon: `Renouvellement CREP (${ctxLabel}) à prévoir.`,
    expired: `CREP positif expiré — à refaire avant transaction (${ctxLabel}).`,
    unlimited: 'Toujours valable.',
  })
}

function checkGazOrElec(
  performedAt: Date,
  now: Date,
  transaction: TransactionContext,
  diag: 'GAZ' | 'ELEC',
): ValidityResult {
  const referenceRule =
    diag === 'GAZ'
      ? 'Décret n° 2006-1147 du 14/09/2006 (DIGI)'
      : 'Décret n° 2008-384 du 22/04/2008 (DIE)'

  const years = transaction === 'rental' ? 6 : 3
  const ctxLabel = transaction === 'rental' ? 'location' : 'vente'
  const expiresAt = addYears(performedAt, years)
  return buildResult(expiresAt, now, referenceRule, {
    valid: `Diagnostic ${diag} (${ctxLabel}) — toujours valable.`,
    expiring_soon: `Renouvellement ${diag} (${ctxLabel}) à planifier.`,
    expired: `Diagnostic ${diag} expiré — à refaire avant ${ctxLabel}.`,
    unlimited: 'Toujours valable.',
  })
}

function checkTermites(performedAt: Date, now: Date): ValidityResult {
  const referenceRule = 'Code de la construction art. L.133-6 (état termites)'
  const expiresAt = addMonths(performedAt, 6)
  return buildResult(expiresAt, now, referenceRule, {
    valid: 'État termites valide (validité 6 mois).',
    expiring_soon: 'Renouvellement termites à planifier (validité 6 mois).',
    expired: 'État termites expiré — à refaire (validité 6 mois).',
    unlimited: 'Valide.',
  })
}

function checkERP(performedAt: Date, now: Date): ValidityResult {
  const referenceRule = "Code de l'environnement art. L.125-5 (ERP / Géorisques)"
  const expiresAt = addMonths(performedAt, 6)
  return buildResult(expiresAt, now, referenceRule, {
    valid: 'ERP valide (6 mois).',
    expiring_soon: 'Renouvellement ERP imminent.',
    expired: 'ERP expiré — régénérer via Géorisques.',
    unlimited: 'Valide.',
  })
}

function checkCarrez(): ValidityResult {
  return {
    status: 'unlimited',
    expiresAt: null,
    daysRemaining: null,
    message: 'Loi Carrez / Boutin — validité illimitée sauf modification de surface',
    referenceRule: 'Loi n° 96-1107 du 18/12/1996 (Carrez) + Loi Boutin 25/03/2009',
    recommendation:
      'Aucune action — refaire uniquement si modification physique (travaux, réunion/division).',
  }
}

// ============================================
// 5. Entrée publique : checkValidity
// ============================================

export function checkValidity(input: ValidityCheckInput): ValidityResult {
  const performedAt = toDate(input.performedAt)
  const now = new Date()
  const transaction: TransactionContext = input.transaction ?? 'unknown'
  const result: DiagnosticResult = input.result ?? 'unknown'

  switch (input.diagnosticType) {
    case 'DPE':
      return checkDPE(performedAt, now)
    case 'AMIANTE':
      return checkAmiante(performedAt, now, result)
    case 'PLOMB':
      return checkPlomb(performedAt, now, result, transaction)
    case 'GAZ':
      return checkGazOrElec(performedAt, now, transaction, 'GAZ')
    case 'ELEC':
      return checkGazOrElec(performedAt, now, transaction, 'ELEC')
    case 'TERMITES':
      return checkTermites(performedAt, now)
    case 'ERP':
      return checkERP(performedAt, now)
    case 'CARREZ':
      return checkCarrez()
    default: {
      // Exhaustivité : si on ajoute un nouveau DiagnosticType, TS doit hurler.
      const _exhaustive: never = input.diagnosticType
      throw new Error(`Unsupported diagnostic type: ${String(_exhaustive)}`)
    }
  }
}
