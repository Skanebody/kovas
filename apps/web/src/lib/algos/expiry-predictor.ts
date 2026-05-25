/**
 * KOVAS — Algo A1.3.10 : Certificate expiry predictor.
 *
 * Pure function qui anticipe les renouvellements COFRAC + RC Pro d'un
 * diagnostiqueur. Sert à :
 *   - Cockpit admin renouvellements (vue priorisée par urgence)
 *   - Emails personnalisés (séquence J-60 / J-30 / J-7 / expiré)
 *   - Calcul churn_risk (A1.3.11) — un cert expiré bloque l'activité
 *   - Recommandations dashboard diagnostiqueur (proactif)
 *
 * Déterministe, testable, sans IO — toute la logique en TypeScript pur.
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §A1.3.10 + verification_continuous_crons
 * (les seuils 60/30/7 sont déjà câblés côté Edge Function, on les harmonise).
 */

export type UrgencyLevel = 'safe' | 'attention' | 'urgent' | 'critical' | 'expired'

export interface ExpiryInput {
  /** Date d'expiration COFRAC (YYYY-MM-DD ou Date ou null) */
  cofrac_valid_until: string | Date | null
  /** Date d'expiration RC Pro (YYYY-MM-DD ou Date ou null) */
  rcpro_valid_until: string | Date | null
  /** Date de référence pour le calcul (défaut : maintenant) */
  reference_date?: Date
}

export interface CertExpiryStatus {
  /** Type de certification */
  cert: 'cofrac' | 'rcpro'
  /** Date d'expiration normalisée ISO YYYY-MM-DD, ou null si pas renseignée */
  expires_on: string | null
  /** Jours jusqu'à expiration (négatif si déjà expirée) */
  days_until_expiry: number | null
  /** Urgence dérivée */
  urgency: UrgencyLevel
}

export interface ExpiryPredictionResult {
  /** Détail par certification */
  cofrac: CertExpiryStatus
  rcpro: CertExpiryStatus
  /** La plus urgente des deux (utilisée pour priorisation cockpit) */
  worst_urgency: UrgencyLevel
  /** Jours avant la prochaine expiration (la plus proche) */
  days_until_next_expiry: number | null
  /** Type de la prochaine certification à renouveler */
  next_cert_to_renew: 'cofrac' | 'rcpro' | null
  /** Action recommandée */
  recommended_action: 'none' | 'remind_60' | 'remind_30' | 'urgent_remind_7' | 'block_expired'
  /** Phrase humaine prête à l'emploi (UI ou email) */
  human_message: string
}

const SEUIL_ATTENTION_J = 60
const SEUIL_URGENT_J = 30
const SEUIL_CRITICAL_J = 7

function parseDate(input: string | Date | null): Date | null {
  if (input == null) return null
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input
  // Format attendu : YYYY-MM-DD (PostgreSQL date) ou ISO
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

function diffDays(target: Date, reference: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  // Arrondi au jour entier (UTC pour éviter pièges DST)
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  const refUtc = Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate(),
  )
  return Math.round((targetUtc - refUtc) / MS_PER_DAY)
}

function urgencyFromDays(days: number | null): UrgencyLevel {
  if (days == null) return 'safe' // Pas de date = pas d'urgence (mais voir below)
  if (days < 0) return 'expired'
  if (days <= SEUIL_CRITICAL_J) return 'critical'
  if (days <= SEUIL_URGENT_J) return 'urgent'
  if (days <= SEUIL_ATTENTION_J) return 'attention'
  return 'safe'
}

function urgencyRank(u: UrgencyLevel): number {
  switch (u) {
    case 'expired':
      return 4
    case 'critical':
      return 3
    case 'urgent':
      return 2
    case 'attention':
      return 1
    default:
      return 0
  }
}

function buildCertStatus(
  cert: 'cofrac' | 'rcpro',
  raw: string | Date | null,
  reference: Date,
): CertExpiryStatus {
  const parsed = parseDate(raw)
  if (!parsed) {
    return {
      cert,
      expires_on: null,
      days_until_expiry: null,
      urgency: 'safe',
    }
  }
  const days = diffDays(parsed, reference)
  return {
    cert,
    expires_on: parsed.toISOString().slice(0, 10),
    days_until_expiry: days,
    urgency: urgencyFromDays(days),
  }
}

function buildHumanMessage(
  worst: UrgencyLevel,
  nextCert: 'cofrac' | 'rcpro' | null,
  daysNext: number | null,
): string {
  const label = nextCert === 'cofrac' ? 'certification COFRAC' : 'assurance RC Pro'
  switch (worst) {
    case 'expired':
      return `Votre ${label} est expirée. Renouvellement urgent requis pour maintenir votre activité.`
    case 'critical':
      return `Votre ${label} expire dans ${daysNext} jours. Lancez le renouvellement maintenant.`
    case 'urgent':
      return `Votre ${label} expire dans ${daysNext} jours. Préparez le dossier de renouvellement.`
    case 'attention':
      return `Votre ${label} expire dans ${daysNext} jours. Anticipez le renouvellement.`
    default:
      return nextCert
        ? `Vos certifications sont à jour. Prochain renouvellement : ${label} dans ${daysNext} jours.`
        : "Aucune date d'expiration renseignée — pensez à compléter votre profil."
  }
}

function recommendedActionFromUrgency(
  u: UrgencyLevel,
): 'none' | 'remind_60' | 'remind_30' | 'urgent_remind_7' | 'block_expired' {
  switch (u) {
    case 'expired':
      return 'block_expired'
    case 'critical':
      return 'urgent_remind_7'
    case 'urgent':
      return 'remind_30'
    case 'attention':
      return 'remind_60'
    default:
      return 'none'
  }
}

export function predictExpiry(input: ExpiryInput): ExpiryPredictionResult {
  const reference = input.reference_date ?? new Date()
  const cofrac = buildCertStatus('cofrac', input.cofrac_valid_until, reference)
  const rcpro = buildCertStatus('rcpro', input.rcpro_valid_until, reference)

  // Détermine la pire urgence + la plus proche échéance
  const worstUrgency: UrgencyLevel =
    urgencyRank(cofrac.urgency) >= urgencyRank(rcpro.urgency) ? cofrac.urgency : rcpro.urgency

  // Plus proche échéance non-NULL (positive ou négative)
  let nextCert: 'cofrac' | 'rcpro' | null = null
  let daysNext: number | null = null
  if (cofrac.days_until_expiry != null && rcpro.days_until_expiry != null) {
    if (cofrac.days_until_expiry <= rcpro.days_until_expiry) {
      nextCert = 'cofrac'
      daysNext = cofrac.days_until_expiry
    } else {
      nextCert = 'rcpro'
      daysNext = rcpro.days_until_expiry
    }
  } else if (cofrac.days_until_expiry != null) {
    nextCert = 'cofrac'
    daysNext = cofrac.days_until_expiry
  } else if (rcpro.days_until_expiry != null) {
    nextCert = 'rcpro'
    daysNext = rcpro.days_until_expiry
  }

  return {
    cofrac,
    rcpro,
    worst_urgency: worstUrgency,
    days_until_next_expiry: daysNext,
    next_cert_to_renew: nextCert,
    recommended_action: recommendedActionFromUrgency(worstUrgency),
    human_message: buildHumanMessage(worstUrgency, nextCert, daysNext),
  }
}
