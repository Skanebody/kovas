/**
 * Calculateur de durée de validité des diagnostics immobiliers FR.
 *
 * Règles métier (réf. articles L271-4 à L271-6 CCH + R.134-4-2) :
 * - DPE : 10 ans (depuis 1er juillet 2021 ; les DPE antérieurs peuvent être
 *   périmés selon dates seuil 2017/2018)
 * - Amiante : illimitée si négatif, 3 ans si positif (matériaux amiantés détectés)
 * - Plomb (CREP) : 1 an si positif vente, 6 ans avant 2017 — depuis 2017,
 *   illimité si négatif, 6 ans si positif (location 6 ans dans tous les cas si négatif)
 *   Pour simplifier, on retient : illimité si négatif, 1 an si positif vente,
 *   6 ans si positif location
 * - Gaz : 3 ans (vente), 6 ans (location)
 * - Électricité : 3 ans (vente), 6 ans (location)
 * - Termites : 6 mois (180 jours)
 * - Carrez/Boutin : illimité (sauf modification surface)
 * - ERP (État des Risques et Pollutions) : 6 mois
 */

export type DiagnosticType =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'carrez'
  | 'erp'

export type Usage = 'vente' | 'location' | 'unknown'

export interface ExpirationContext {
  /** Type de diagnostic */
  type: DiagnosticType
  /** Date d'émission ISO (YYYY-MM-DD) */
  dateEmission: string
  /** Vente ou location — par défaut 'vente' (cas par défaut le plus courant) */
  usage?: Usage
  /** Pour amiante / plomb : résultat positif (matériaux détectés) ou négatif */
  resultPositive?: boolean
}

export interface ExpirationResult {
  /** Date d'expiration ISO (YYYY-MM-DD), null si validité illimitée */
  dateExpiration: string | null
  /** Validité humaine ("10 ans", "6 mois", "Illimitée si négatif"…) */
  validityLabel: string
  /** Indication d'imprécision (cas où il manque un paramètre) */
  uncertain: boolean
}

function addYears(isoDate: string, years: number): string {
  const d = new Date(isoDate)
  d.setUTCFullYear(d.getUTCFullYear() + years)
  return d.toISOString().slice(0, 10)
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

/**
 * Calcule la date d'expiration d'un diagnostic selon son type, sa date
 * d'émission et le contexte (vente/location, résultat positif/négatif).
 *
 * Renvoie `dateExpiration: null` si la validité est illimitée.
 */
export function calculateExpiration(ctx: ExpirationContext): ExpirationResult {
  const { type, dateEmission, usage = 'vente', resultPositive } = ctx

  switch (type) {
    case 'dpe':
      return {
        dateExpiration: addYears(dateEmission, 10),
        validityLabel: '10 ans',
        uncertain: false,
      }

    case 'amiante':
      if (resultPositive === true) {
        return {
          dateExpiration: addYears(dateEmission, 3),
          validityLabel: '3 ans (résultat positif)',
          uncertain: false,
        }
      }
      if (resultPositive === false) {
        return {
          dateExpiration: null,
          validityLabel: 'Illimitée (résultat négatif)',
          uncertain: false,
        }
      }
      return {
        dateExpiration: null,
        validityLabel: 'Illimitée si négatif, sinon 3 ans',
        uncertain: true,
      }

    case 'plomb':
      if (resultPositive === false) {
        return {
          dateExpiration: null,
          validityLabel: 'Illimitée (résultat négatif)',
          uncertain: false,
        }
      }
      if (resultPositive === true) {
        return {
          dateExpiration:
            usage === 'location' ? addYears(dateEmission, 6) : addYears(dateEmission, 1),
          validityLabel:
            usage === 'location' ? '6 ans (positif, location)' : '1 an (positif, vente)',
          uncertain: false,
        }
      }
      return {
        dateExpiration: null,
        validityLabel: 'Illimitée si négatif, sinon 1 an vente / 6 ans location',
        uncertain: true,
      }

    case 'gaz':
      return {
        dateExpiration:
          usage === 'location' ? addYears(dateEmission, 6) : addYears(dateEmission, 3),
        validityLabel: usage === 'location' ? '6 ans (location)' : '3 ans (vente)',
        uncertain: usage === 'unknown',
      }

    case 'electricite':
      return {
        dateExpiration:
          usage === 'location' ? addYears(dateEmission, 6) : addYears(dateEmission, 3),
        validityLabel: usage === 'location' ? '6 ans (location)' : '3 ans (vente)',
        uncertain: usage === 'unknown',
      }

    case 'termites':
      return {
        dateExpiration: addMonths(dateEmission, 6),
        validityLabel: '6 mois',
        uncertain: false,
      }

    case 'carrez':
      return {
        dateExpiration: null,
        validityLabel: 'Illimitée (sauf modification de surface)',
        uncertain: false,
      }

    case 'erp':
      return {
        dateExpiration: addMonths(dateEmission, 6),
        validityLabel: '6 mois',
        uncertain: false,
      }

    default: {
      // Exhaustive check — TypeScript signale tout nouveau type non géré
      const _exhaustive: never = type
      void _exhaustive
      return {
        dateExpiration: null,
        validityLabel: 'Type inconnu',
        uncertain: true,
      }
    }
  }
}

export const DIAGNOSTIC_TYPE_LABELS: Record<DiagnosticType, string> = {
  dpe: 'DPE',
  amiante: 'Amiante',
  plomb: 'Plomb (CREP)',
  gaz: 'Gaz',
  electricite: 'Électricité',
  termites: 'Termites',
  carrez: 'Loi Carrez / Boutin',
  erp: 'ERP',
}

/**
 * Statut de validité visuel (vert/ambre/rouge) pour affichage.
 */
export type ValidityStatus = 'valid' | 'expiring' | 'expired' | 'unlimited'

export function getValidityStatus(
  dateExpiration: string | null,
  now: Date = new Date(),
): ValidityStatus {
  if (dateExpiration === null) return 'unlimited'
  const exp = new Date(dateExpiration)
  if (exp.getTime() < now.getTime()) return 'expired'
  const oneYearMs = 365 * 24 * 60 * 60 * 1000
  if (exp.getTime() - now.getTime() < oneYearMs) return 'expiring'
  return 'valid'
}
