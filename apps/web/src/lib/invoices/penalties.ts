/**
 * Calcul des pénalités de retard L441-10 Code Commerce (B2B).
 *
 * Règles :
 * - Taux d'intérêt légal majoré de 10 points (ou 3 × taux légal selon usage —
 *   on retient 3 × taux d'intérêt légal annuel BCE qui est la version la plus
 *   couramment appliquée par défaut dans les CGV des prestataires de services).
 * - Indemnité forfaitaire pour frais de recouvrement : 40 € HT (D.441-5).
 * - Application possible à compter du jour suivant la date d'échéance,
 *   sans mise en demeure préalable obligatoire.
 *
 * On utilise un taux par défaut (3,5 % BCE × 3 = 10,5 %) configurable
 * via env `LATE_PAYMENT_RATE_PERCENT`. Pour V1 — ce calcul reste indicatif :
 * un avocat devrait valider la formule exacte pour les mises en demeure.
 */

/** Taux annuel appliqué pour calcul des pénalités (en pourcentage, ex: 10.5 = 10,5 %). */
export const DEFAULT_LATE_PAYMENT_RATE_PERCENT = 10.5

/** Indemnité forfaitaire frais de recouvrement (D.441-5 CCom). */
export const RECOVERY_FLAT_FEE_EUR = 40

export interface PenaltiesInput {
  /** Montant HT impayé en euros */
  unpaidAmountHt: number
  /** Nombre de jours de retard depuis date d'échéance (entier positif). */
  daysLate: number
  /** Taux annuel à appliquer (défaut DEFAULT_LATE_PAYMENT_RATE_PERCENT) */
  ratePercent?: number
}

export interface PenaltiesResult {
  interestEur: number
  flatFeeEur: number
  totalEur: number
  ratePercent: number
  daysLate: number
}

/**
 * Calcule les pénalités à date pour un montant impayé.
 *
 * Formule : intérêts = montant × (taux/100) × (joursRetard / 365) + 40 € fixe
 */
export function computeLatePenalties({
  unpaidAmountHt,
  daysLate,
  ratePercent = DEFAULT_LATE_PAYMENT_RATE_PERCENT,
}: PenaltiesInput): PenaltiesResult {
  const safeAmount = Math.max(0, unpaidAmountHt)
  const safeDays = Math.max(0, Math.floor(daysLate))
  const interest = (safeAmount * (ratePercent / 100) * safeDays) / 365
  const interestRounded = Math.round(interest * 100) / 100
  const total = interestRounded + RECOVERY_FLAT_FEE_EUR
  return {
    interestEur: interestRounded,
    flatFeeEur: RECOVERY_FLAT_FEE_EUR,
    totalEur: Math.round(total * 100) / 100,
    ratePercent,
    daysLate: safeDays,
  }
}

/**
 * Mention légale L441-10 à imprimer en pied de facture (texte court).
 */
export const L441_10_FOOTNOTE = `En cas de retard de paiement, application sans mise en demeure préalable d'un intérêt au taux annuel de ${DEFAULT_LATE_PAYMENT_RATE_PERCENT.toString().replace('.', ',')} % (3 × taux d'intérêt légal) et d'une indemnité forfaitaire pour frais de recouvrement de ${RECOVERY_FLAT_FEE_EUR} € (art. L.441-10 et D.441-5 du Code de commerce).`
