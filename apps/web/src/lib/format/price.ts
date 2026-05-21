/**
 * Formatters de prix harmonisés KOVAS — locale française avec virgule
 * décimale + espace insécable avant l'unité € (convention typo FR).
 *
 * Convention : prix stockés en centimes (integer). Helpers convertissent
 * en euros et appliquent `Intl.NumberFormat('fr-FR', {style:'currency'})`.
 *
 * Cf. CLAUDE.md §10 — Conventions formats régionaux.
 */

/**
 * Formate des centimes en EUR avec virgule décimale.
 * Affichage standard avec 2 décimales.
 *
 * @example formatPriceEur(1900) → "19,00 €"
 * @example formatPriceEur(2999) → "29,99 €"
 * @example formatPriceEur(0)    → "0,00 €"
 */
export function formatPriceEur(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Formate des centimes en EUR sans décimales si entier rond, avec sinon.
 * Utile pour affichage marketing où "29 €" est plus lisible que "29,00 €".
 *
 * @example formatPriceEurCompact(1900) → "19 €"
 * @example formatPriceEurCompact(2999) → "29,99 €"
 * @example formatPriceEurCompact(1950) → "19,50 €"
 */
export function formatPriceEurCompact(cents: number): string {
  const hasDecimals = cents % 100 !== 0
  return (cents / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

/**
 * Formate un montant en euros (déjà en EUR, pas en centimes).
 * Pour les cas où la donnée arrive déjà convertie (ex: overage_eur,
 * monthly_cap_eur dans subscriptions).
 *
 * @example formatEurAmount(19) → "19,00 €"
 * @example formatEurAmount(2.5) → "2,50 €"
 */
export function formatEurAmount(eur: number): string {
  return eur.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Variante "/mo" pour affichage abonnement compact en sidebar/card.
 *
 * @example formatMonthlyPriceEur(1900) → "19 €/mo"
 */
export function formatMonthlyPriceEur(cents: number): string {
  return `${formatPriceEurCompact(cents)}/mo`
}
