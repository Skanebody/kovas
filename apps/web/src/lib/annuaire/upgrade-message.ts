/**
 * KOVAS — Annuaire upgrade message helper (Lot Annuaire Dashboard §6).
 *
 * Détermine le message contextuel à afficher dans le bandeau d'upgrade selon
 * (a) le tier annuaire actuel du diagnostiqueur et (b) son tier logiciel
 * éventuel. Le levier majeur exploité :
 *
 *   Boost (39€) → Solo (29€)            : moins cher ET 10× plus de valeur
 *   Premium (79€) → Pro (79€)           : même prix, 10× la valeur (bundle)
 *   Présence (19€) → Boost (39€)        : upsell vertical standard
 *
 * Si l'utilisateur est déjà sur un tier logiciel ≥ Pro, on retourne `null`
 * (déjà au top → ne PAS afficher de banner).
 *
 * IMPORTANT : tous les prix sont lus depuis `pricing-plans.ts` (source de
 * vérité unique). Toute modification de grille tarifaire se propage donc
 * automatiquement à ce helper sans modification du présent fichier.
 */

import {
  ANNUAIRE_PLANS,
  type AnnuairePlanCode,
  LOGICIEL_PLANS,
  type LogicielPlanCode,
} from '@/lib/pricing-plans'

// ════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════

/** Codes V5 officiels reconnus (sans aliases V3 ni grandfathers). */
type AnnuaireV5Code = 'annuaire_free' | 'annuaire_local' | 'annuaire_regional' | 'annuaire_national'
type LogicielV5Code = 'essai' | 'solo_light' | 'solo_pro' | 'cabinet' | 'cabinet_plus'

export interface UpgradeMessage {
  /** Code du tier annuaire courant (ou `'none'` si pas d'abonnement annuaire). */
  readonly currentTier: AnnuaireV5Code | 'none'
  /** Libellé human-readable du tier courant (ex. "Annuaire Boost"). */
  readonly currentTierLabel: string
  /** Code du tier ciblé (annuaire ou logiciel). */
  readonly targetTier: AnnuaireV5Code | LogicielV5Code
  /** Libellé human-readable du tier cible (ex. "KOVAS Solo"). */
  readonly targetTierLabel: string
  /** Prix mensuel HT du tier cible (centimes). */
  readonly targetTierPrice: number
  /** Liste des bénéfices à mettre en avant (3-5 bullets max). */
  readonly benefits: readonly string[]
  /** Href du CTA (vers la page d'upgrade adaptée). */
  readonly ctaHref: string
  /**
   * Le tier cible est-il "plus rentable" que le tier courant ?
   *   - true si downgrade prix (ex. Boost 39€ → Solo 29€)
   *   - true si même prix avec features bonus (ex. Premium 79€ → Pro 79€)
   * Utilisé pour le ton du titre ("Moins cher ET plus de valeur" / "Même prix, 10× la valeur").
   */
  readonly isMoreValuable: boolean
  /** Phrase d'accroche dramatisée à afficher en sous-titre. */
  readonly tagline: string
  /** Type de cible : 'annuaire' (upsell vertical) ou 'logiciel' (cross-sell horizontal). */
  readonly targetTrack: 'annuaire' | 'logiciel'
}

// ════════════════════════════════════════════════════════════════
// Helpers internes
// ════════════════════════════════════════════════════════════════

/** Normalise un code annuaire vers son équivalent V5 (alias V3 acceptés). */
function normalizeAnnuaireCode(code: AnnuairePlanCode | null | undefined): AnnuaireV5Code | null {
  if (!code) return null
  // Alias V3 → V5
  if (code === 'annuaire_pro') return 'annuaire_local'
  if (code === 'annuaire_visibility') return 'annuaire_regional'
  if (code === 'annuaire_sponsored') return 'annuaire_national'
  // V5 directs
  if (
    code === 'annuaire_free' ||
    code === 'annuaire_local' ||
    code === 'annuaire_regional' ||
    code === 'annuaire_national'
  ) {
    return code
  }
  return null
}

/** Normalise un code logiciel vers son équivalent V5 (alias V3 acceptés). */
function normalizeLogicielCode(code: LogicielPlanCode | null | undefined): LogicielV5Code | null {
  if (!code) return null
  // Alias V3 → V5
  if (code === 'logiciel_free') return 'essai'
  if (code === 'logiciel_starter') return 'solo_light'
  if (code === 'logiciel_active') return 'solo_pro'
  if (code === 'logiciel_cabinet') return 'cabinet'
  if (code === 'logiciel_enterprise') return 'cabinet_plus'
  // V5 directs
  if (
    code === 'essai' ||
    code === 'solo_light' ||
    code === 'solo_pro' ||
    code === 'cabinet' ||
    code === 'cabinet_plus'
  ) {
    return code
  }
  return null
}

/** Lit le prix mensuel d'un plan annuaire depuis `pricing-plans.ts`. */
function getAnnuairePrice(code: AnnuaireV5Code): number {
  const plan = ANNUAIRE_PLANS.find((p) => p.code === code)
  return plan?.monthlyPrice ?? 0
}

/** Lit le prix mensuel d'un plan logiciel depuis `pricing-plans.ts`. */
function getLogicielPrice(code: LogicielV5Code): number {
  const plan = LOGICIEL_PLANS.find((p) => p.code === code)
  return plan?.monthlyPrice ?? 0
}

// ════════════════════════════════════════════════════════════════
// API publique
// ════════════════════════════════════════════════════════════════

export interface GetUpgradeMessageArgs {
  readonly annuaireTier?: AnnuairePlanCode | null
  readonly saasTier?: LogicielPlanCode | null
}

/**
 * Retourne le message d'upgrade adapté au tier annuaire courant du user,
 * ou `null` si aucune suggestion pertinente (user déjà au top, ou pas de
 * contexte annuaire).
 *
 * Règles métier (cf. spec Lot Annuaire §6) :
 *
 *   1. Si saas_tier ∈ {pro, cabinet, cabinet_plus} → null
 *      (l'utilisateur est déjà sur un plan logiciel ≥ Pro qui inclut le
 *       meilleur de l'annuaire, pas de cross-sell pertinent).
 *
 *   2. Si annuaire_tier = 'annuaire_local' (Présence 19€) :
 *      → Upsell vers Boost 39€ (upsell vertical standard, +20€)
 *
 *   3. Si annuaire_tier = 'annuaire_regional' (Boost 39€) :
 *      → Cross-sell vers KOVAS Solo 29€ (logiciel)
 *      → ARGUMENT FORT : moins cher (10€/mo) et 10× plus de valeur
 *
 *   4. Si annuaire_tier = 'annuaire_national' (Premium 79€) :
 *      → Cross-sell vers KOVAS Pro 79€ (logiciel)
 *      → ARGUMENT FORT : même prix, 10× la valeur (bundle Croissance)
 *
 *   5. Sinon (pas d'abonnement annuaire OU free OU code inconnu) :
 *      → Upsell générique vers Présence 19€ (entry-level annuaire)
 */
export function getUpgradeMessage(args: GetUpgradeMessageArgs): UpgradeMessage | null {
  const annuaireTier = normalizeAnnuaireCode(args.annuaireTier ?? null)
  const saasTier = normalizeLogicielCode(args.saasTier ?? null)

  // Règle 1 : si user a déjà Pro/Cabinet/Cabinet+ → pas de banner.
  // Le bundle Pro inclut déjà Premium annuaire, donc aucun upsell n'a de sens.
  if (saasTier === 'solo_pro' || saasTier === 'cabinet' || saasTier === 'cabinet_plus') {
    return null
  }

  // Règle 2 : Présence (annuaire_local, 19€) → Boost (annuaire_regional, 39€).
  if (annuaireTier === 'annuaire_local') {
    const targetPrice = getAnnuairePrice('annuaire_regional')
    return {
      currentTier: 'annuaire_local',
      currentTierLabel: 'Annuaire Présence',
      targetTier: 'annuaire_regional',
      targetTierLabel: 'Annuaire Boost',
      targetTierPrice: targetPrice,
      benefits: [
        '+3 photos additionnelles sur votre fiche',
        'Carte multi-commune',
        'Calendrier de disponibilité visible',
        'Booking direct via KOVAS',
        'Notifications push de leads',
      ],
      ctaHref: '/dashboard/upgrade/annuaire',
      isMoreValuable: false,
      tagline: 'Passez devant vos concurrents dans les résultats annuaire.',
      targetTrack: 'annuaire',
    }
  }

  // Règle 3 : Boost (39€) → KOVAS Solo (29€). LEVIER MAJEUR.
  // Moins cher de 10€/mo ET inclut tout l'écosystème logiciel.
  if (annuaireTier === 'annuaire_regional') {
    const targetPrice = getLogicielPrice('solo_light')
    return {
      currentTier: 'annuaire_regional',
      currentTierLabel: 'Annuaire Boost',
      targetTier: 'solo_light',
      targetTierLabel: 'KOVAS Solo',
      targetTierPrice: targetPrice,
      benefits: [
        'Capture mission terrain (vocal + photos IA)',
        'Cross-Check 6 sources avant ADEME',
        'Pré-export Liciel / ORIS / OBBC',
        '35 minutes gagnées par mission',
      ],
      ctaHref: '/dashboard/upgrade/logiciel',
      isMoreValuable: true,
      tagline: 'Moins cher (10€/mo) et 10× plus de valeur.',
      targetTrack: 'logiciel',
    }
  }

  // Règle 4 : Premium (79€) → KOVAS Pro (79€). LEVIER MAJEUR.
  // Même prix, mais le bundle Croissance inclut Premium annuaire + Pro logiciel.
  if (annuaireTier === 'annuaire_national') {
    const targetPrice = getLogicielPrice('solo_pro')
    return {
      currentTier: 'annuaire_national',
      currentTierLabel: 'Annuaire Premium',
      targetTier: 'solo_pro',
      targetTierLabel: 'KOVAS Pro',
      targetTierPrice: targetPrice,
      benefits: [
        'Capture vocale + photos IA terrain',
        'Cross-Check 6 sources avant ADEME',
        'Export auto Liciel / ORIS / OBBC',
        '100 missions / mois incluses',
        'Inclut Premium annuaire (bundle Croissance)',
      ],
      ctaHref: '/dashboard/upgrade/logiciel',
      isMoreValuable: true,
      tagline: 'Même prix, 10× la valeur.',
      targetTrack: 'logiciel',
    }
  }

  // Règle 5 : pas d'abonnement annuaire actif (free, none, code inconnu)
  // → upsell entry-level vers Présence 19€.
  if (annuaireTier === null || annuaireTier === 'annuaire_free') {
    const targetPrice = getAnnuairePrice('annuaire_local')
    return {
      currentTier: annuaireTier === 'annuaire_free' ? 'annuaire_free' : 'none',
      currentTierLabel:
        annuaireTier === 'annuaire_free' ? 'Annuaire Fiche réclamée (gratuit)' : 'Aucun annuaire',
      targetTier: 'annuaire_local',
      targetTierLabel: 'Annuaire Présence',
      targetTierPrice: targetPrice,
      benefits: [
        'Fiche publique sur l’annuaire KOVAS',
        '3 derniers avis Google affichés',
        'Indicateur de disponibilité',
        'Réception de demandes de devis',
      ],
      ctaHref: '/dashboard/upgrade/annuaire',
      isMoreValuable: false,
      tagline: 'Les particuliers de votre département vous trouvent en priorité.',
      targetTrack: 'annuaire',
    }
  }

  // Cas non géré (code annuaire inconnu non null) → ne rien afficher.
  return null
}

/** Formate un prix mensuel (centimes integer → "29 €/mo"). */
export function formatMonthlyPriceShort(cents: number): string {
  const euros = Math.round(cents / 100)
  return `${euros} €/mo`
}
