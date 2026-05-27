/**
 * KOVAS — Catalogue d'offres unifié et algorithme de recommandation
 * pour la page Découvrir.
 *
 * Trois familles d'offres :
 *  - logiciel (SaaS KOVAS, 5 plans)
 *  - annuaire (KOVAS Annuaire, 4 plans + sponsorisé)
 *  - bundle (combos cross-sell logiciel + annuaire avec remise)
 *  - addons (extensions ponctuelles)
 *
 * L'algorithme calcule un score par offre à partir des signaux comportementaux
 * trackés client-side dans `intent-tracker.ts`.
 *
 * Le matching tient compte du track utilisateur courant (logiciel-only,
 * annuaire-only, dual, free) pour éviter de recommander une offre déjà
 * souscrite.
 *
 * Cf. CLAUDE.md §1 (KOVAS + KOVAS Annuaire) et §4 (pricing).
 */

export type DecouvrirSection =
  | 'logiciel'
  | 'annuaire'
  | 'bundle'
  | 'addons'
  | 'sponsorise'
  | 'recommandations'
  | 'situation'
  | 'faq'

export type UserTrack = 'logiciel_only' | 'annuaire_only' | 'dual' | 'free'

export type OfferFamily = 'logiciel' | 'annuaire' | 'bundle' | 'addon' | 'sponsorise'

export interface OfferDescriptor {
  /** Identifiant stable utilisé pour le scoring + analytics */
  code: string
  family: OfferFamily
  section: DecouvrirSection
  label: string
  tagline: string
  priceLabel: string
  /** Prix HT mensuel en centimes (0 pour gratuit, null pour à l'usage) */
  priceMonthlyCents: number | null
  features: readonly string[]
  /** Codes des autres offres que celle-ci rend redondante ou superflue */
  excludesCodes?: readonly string[]
  /** Tracks ciblés en priorité (boost de score) */
  primaryTracks?: readonly UserTrack[]
  /** Tracks à exclure du matching (offre déjà incluse / non pertinente) */
  excludeTracks?: readonly UserTrack[]
  /** Mise en avant éditoriale (apparait dans Section 2 sans signal) */
  defaultRecommended?: boolean
  /** Pour bundles : remise affichée */
  bundleSavingLabel?: string
}

// ---------------------------------------------------------------------------
// Catalogue d'offres
// ---------------------------------------------------------------------------

export const LOGICIEL_OFFERS: readonly OfferDescriptor[] = [
  {
    code: 'logiciel_essai',
    family: 'logiciel',
    section: 'logiciel',
    label: 'Essai gratuit 30 jours',
    tagline: 'Tester KOVAS sans débit immédiat',
    priceLabel: 'Gratuit · 30 jours',
    priceMonthlyCents: 0,
    features: [
      'Accès complet à toutes les fonctionnalités',
      'Aucune limite de missions pendant 30 jours',
      'CB demandée à l’inscription, débit à J+30',
      'Résiliable en 2 clics depuis ton compte',
    ],
    primaryTracks: ['free'],
    excludeTracks: ['logiciel_only', 'dual'],
  },
  {
    code: 'logiciel_solo_light',
    family: 'logiciel',
    section: 'logiciel',
    label: 'Solo',
    tagline: 'Pour démarrer ou les petits volumes',
    priceLabel: '29€ HT / mois',
    priceMonthlyCents: 2900,
    features: [
      '40 missions incluses / mois',
      'Surplus 0,99€ HT / mission',
      '20 Go de stockage',
      'Tous les exports universels',
    ],
    primaryTracks: ['free', 'annuaire_only'],
  },
  {
    code: 'logiciel_solo_pro',
    family: 'logiciel',
    section: 'logiciel',
    label: 'Pro',
    tagline: 'Le plus choisi par les solopreneurs',
    priceLabel: '79€ HT / mois',
    priceMonthlyCents: 7900,
    features: [
      '100 missions incluses / mois',
      'Surplus 0,79€ HT / mission',
      '50 Go de stockage',
      'Pack conformité ADEME inclus',
    ],
    defaultRecommended: true,
    primaryTracks: ['free', 'annuaire_only', 'logiciel_only'],
  },
  {
    code: 'logiciel_cabinet',
    family: 'logiciel',
    section: 'logiciel',
    label: 'Cabinet',
    tagline: 'Pour les power users en cabinet (jusqu’à 5 users)',
    priceLabel: '199€ HT / mois',
    priceMonthlyCents: 19900,
    features: [
      '300 missions incluses / mois',
      'Surplus 0,59€ HT / mission',
      '100 Go de stockage',
      "Jusqu'à 5 utilisateurs inclus",
    ],
    primaryTracks: ['logiciel_only'],
  },
  {
    code: 'logiciel_cabinet_plus',
    family: 'logiciel',
    section: 'logiciel',
    label: 'Cabinet +',
    tagline: 'Pour les structures multi-utilisateurs (jusqu’à 15 users)',
    priceLabel: '499€ HT / mois',
    priceMonthlyCents: 49900,
    features: [
      '1000 missions incluses / mois',
      'Surplus 0,29€ HT / mission',
      '200 Go de stockage',
      "Jusqu'à 15 utilisateurs inclus",
    ],
    primaryTracks: ['logiciel_only', 'dual'],
  },
] as const

export const ANNUAIRE_OFFERS: readonly OfferDescriptor[] = [
  {
    code: 'annuaire_gratuit',
    family: 'annuaire',
    section: 'annuaire',
    label: 'Annuaire Gratuit',
    tagline: 'Visibilité de base sur kovas.fr',
    priceLabel: 'Gratuit',
    priceMonthlyCents: 0,
    features: [
      'Fiche publique avec nom + ville',
      'Affichage dans les résultats nationaux',
      'Demande de devis par formulaire',
      'Sans engagement',
    ],
    primaryTracks: ['free', 'logiciel_only'],
    excludeTracks: ['annuaire_only', 'dual'],
  },
  {
    code: 'annuaire_local',
    family: 'annuaire',
    section: 'annuaire',
    label: 'Annuaire Présence',
    tagline: 'Priorité sur ta ville',
    priceLabel: '19€ HT / mois',
    priceMonthlyCents: 1900,
    features: [
      'Top 3 sur 1 ville (population < 50 000)',
      'Fiche enrichie : photos, certifications, avis',
      'Notifications de demande en temps réel',
      'Statistiques de profil mensuelles',
    ],
    primaryTracks: ['logiciel_only', 'free'],
  },
  {
    code: 'annuaire_regional',
    family: 'annuaire',
    section: 'annuaire',
    label: 'Annuaire Boost',
    tagline: 'Couverture département complet',
    priceLabel: '39€ HT / mois',
    priceMonthlyCents: 3900,
    features: [
      'Top 3 sur 1 département entier',
      'Mise en avant cartographie',
      'Réponse prioritaire aux demandes',
      'Export hebdomadaire des contacts',
    ],
    primaryTracks: ['logiciel_only'],
    defaultRecommended: true,
  },
  {
    code: 'annuaire_national',
    family: 'annuaire',
    section: 'annuaire',
    label: 'Annuaire Premium',
    tagline: 'Pour les enseignes multi-régions',
    priceLabel: '79€ HT / mois',
    priceMonthlyCents: 7900,
    features: [
      'Présence prioritaire France entière',
      'Profil bilingue FR/EN',
      'Account manager dédié',
      'API leads (Webhook + CSV)',
    ],
    primaryTracks: ['logiciel_only', 'dual'],
  },
] as const

export const BUNDLE_OFFERS: readonly OfferDescriptor[] = [
  {
    code: 'bundle_solo_starter',
    family: 'bundle',
    section: 'bundle',
    label: 'Pack Solo Starter',
    tagline: 'Solo + Annuaire Présence',
    priceLabel: '39€ HT / mois',
    priceMonthlyCents: 3900,
    bundleSavingLabel: 'Économie 9€/mois',
    features: [
      'KOVAS Solo (40 missions)',
      'KOVAS Annuaire Présence (1 ville)',
      'Synchronisation profil automatique',
      'Engagement 0 — résiliation 1 clic',
    ],
    primaryTracks: ['free'],
    excludeTracks: ['dual'],
  },
  {
    code: 'bundle_solo_pro_local',
    family: 'bundle',
    section: 'bundle',
    label: 'Pack Croissance',
    tagline: 'Pro + Annuaire Présence',
    priceLabel: '99€ HT / mois',
    priceMonthlyCents: 9900,
    bundleSavingLabel: 'Économie 9€/mois',
    features: [
      'KOVAS Pro (100 missions)',
      'KOVAS Annuaire Présence',
      'Synchronisation profil automatique',
      'Pack conformité ADEME inclus',
    ],
    defaultRecommended: true,
    primaryTracks: ['free', 'logiciel_only', 'annuaire_only'],
  },
  {
    code: 'bundle_solo_pro_regional',
    family: 'bundle',
    section: 'bundle',
    label: 'Pack Acquisition',
    tagline: 'Pro + Annuaire Boost',
    priceLabel: '89€ HT / mois',
    priceMonthlyCents: 8900,
    bundleSavingLabel: 'Économie 29€/mois',
    features: [
      'KOVAS Pro (100 missions)',
      'KOVAS Annuaire Boost (département)',
      'Mise en avant cartographique',
      'Statistiques sectorielles',
    ],
    primaryTracks: ['logiciel_only', 'annuaire_only'],
  },
  {
    code: 'bundle_cabinet_regional',
    family: 'bundle',
    section: 'bundle',
    label: 'Pack Cabinet',
    tagline: 'Cabinet + Annuaire Premium',
    priceLabel: '229€ HT / mois',
    priceMonthlyCents: 22900,
    bundleSavingLabel: 'Économie 49€/mois',
    features: [
      'KOVAS Cabinet (300 missions, 5 users)',
      'KOVAS Annuaire Premium',
      'Account manager partagé',
      'Reporting trimestriel',
    ],
    primaryTracks: ['logiciel_only', 'annuaire_only'],
  },
  {
    code: 'bundle_cabinet_national',
    family: 'bundle',
    section: 'bundle',
    label: 'Pack Cabinet+',
    tagline: 'Cabinet+ + Annuaire Premium',
    priceLabel: '529€ HT / mois',
    priceMonthlyCents: 52900,
    bundleSavingLabel: 'Économie 49€/mois',
    features: [
      'KOVAS Cabinet+ (1000 missions, 15 users)',
      'KOVAS Annuaire Premium',
      'API leads + Webhooks',
      'Onboarding personnalisé 2h',
    ],
    primaryTracks: ['dual'],
  },
] as const

export const ADDON_OFFERS: readonly OfferDescriptor[] = [
  {
    code: 'addon_volume_ia',
    family: 'addon',
    section: 'addons',
    label: 'Volume IA',
    tagline: 'Augmenter les caps Whisper / Vision',
    priceLabel: '15€ HT / mois',
    priceMonthlyCents: 1500,
    features: [
      '+ 60h de transcription mensuelle',
      '+ 1000 analyses Vision IA',
      'Activation immédiate',
    ],
  },
  {
    code: 'addon_pack_conformite',
    family: 'addon',
    section: 'addons',
    label: 'Pack Conformité',
    tagline: 'Validation cohérence + audit qualité',
    priceLabel: '12€ HT / mois',
    priceMonthlyCents: 1200,
    features: [
      'Audit qualité automatique pré-export',
      'Modèles validés ADEME 3CL-2021',
      'Journal de conformité PDF',
    ],
  },
  {
    code: 'addon_pack_international',
    family: 'addon',
    section: 'addons',
    label: 'Pack International',
    tagline: 'Rapports bilingues FR/EN',
    priceLabel: '9€ HT / mois',
    priceMonthlyCents: 900,
    features: [
      'Tous les PDF en bilingue FR/EN',
      'Templates clients étrangers',
      'Support email anglais',
    ],
  },
  {
    code: 'addon_sync_compta',
    family: 'addon',
    section: 'addons',
    label: 'Sync Compta',
    tagline: 'Pennylane · Gestiondiag · CSV',
    priceLabel: '14€ HT / mois',
    priceMonthlyCents: 1400,
    features: [
      'Sync factures Pennylane bidirectionnelle',
      'Export Factur-X automatique',
      'Webhook personnalisé',
    ],
  },
  {
    code: 'addon_user_supp',
    family: 'addon',
    section: 'addons',
    label: 'Utilisateur supplémentaire',
    tagline: 'Pour les cabinets en croissance',
    priceLabel: '25€ HT / mois / user',
    priceMonthlyCents: 2500,
    features: [
      'Compte collaborateur séparé',
      'Permissions granulaires',
      'Activité collaborative en temps réel',
    ],
  },
] as const

export const SPONSORISE_OFFERS: readonly OfferDescriptor[] = [
  {
    code: 'sponsorise_xs',
    family: 'sponsorise',
    section: 'sponsorise',
    label: 'Sponsorisé XS — < 10k habitants',
    tagline: 'Village ou petite commune',
    priceLabel: '9€ HT / mois',
    priceMonthlyCents: 900,
    features: ['Bandeau "Sponsorisé" en haut de la commune', '1 commune au choix'],
  },
  {
    code: 'sponsorise_s',
    family: 'sponsorise',
    section: 'sponsorise',
    label: 'Sponsorisé S — 10–30k habitants',
    tagline: 'Petite ville ou périphérie',
    priceLabel: '19€ HT / mois',
    priceMonthlyCents: 1900,
    features: ['Bandeau Sponsorisé en haut', '1 commune au choix'],
  },
  {
    code: 'sponsorise_m',
    family: 'sponsorise',
    section: 'sponsorise',
    label: 'Sponsorisé M — 30–80k habitants',
    tagline: 'Ville moyenne',
    priceLabel: '39€ HT / mois',
    priceMonthlyCents: 3900,
    features: ['Bandeau Sponsorisé', 'Rapports de visibilité'],
  },
  {
    code: 'sponsorise_l',
    family: 'sponsorise',
    section: 'sponsorise',
    label: 'Sponsorisé L — 80–200k habitants',
    tagline: 'Grande ville',
    priceLabel: '79€ HT / mois',
    priceMonthlyCents: 7900,
    features: ['Bandeau premium animé', 'Statistiques détaillées'],
  },
  {
    code: 'sponsorise_xl',
    family: 'sponsorise',
    section: 'sponsorise',
    label: 'Sponsorisé XL — 200–500k habitants',
    tagline: 'Métropole régionale',
    priceLabel: '149€ HT / mois',
    priceMonthlyCents: 14900,
    features: ['Bandeau premium animé', 'Account manager mensuel'],
  },
  {
    code: 'sponsorise_xxl',
    family: 'sponsorise',
    section: 'sponsorise',
    label: 'Sponsorisé XXL — > 500k habitants',
    tagline: 'Paris · Lyon · Marseille',
    priceLabel: '299€ HT / mois',
    priceMonthlyCents: 29900,
    features: ['Top permanent sur la commune', 'Reporting hebdo'],
  },
] as const

export const ALL_OFFERS: readonly OfferDescriptor[] = [
  ...LOGICIEL_OFFERS,
  ...ANNUAIRE_OFFERS,
  ...BUNDLE_OFFERS,
  ...ADDON_OFFERS,
  ...SPONSORISE_OFFERS,
] as const

export function getOffer(code: string): OfferDescriptor | undefined {
  return ALL_OFFERS.find((o) => o.code === code)
}

// ---------------------------------------------------------------------------
// User access — décrit la situation actuelle de l'utilisateur
// ---------------------------------------------------------------------------

export interface UserAccess {
  /** A un abonnement actif sur le logiciel KOVAS */
  hasLogiciel: boolean
  /** A une fiche annuaire payante active (Local, Régional, National) */
  hasAnnuaire: boolean
  /** Tier logiciel actif (si présent) — pour info, pas pour filtrage strict */
  logicielTier?: 'discovery' | 'standard' | 'volume'
  /** Tier annuaire actif (si présent) */
  annuaireTier?: 'local' | 'regional' | 'national'
}

export function deriveTrack(access: UserAccess): UserTrack {
  if (access.hasLogiciel && access.hasAnnuaire) return 'dual'
  if (access.hasLogiciel) return 'logiciel_only'
  if (access.hasAnnuaire) return 'annuaire_only'
  return 'free'
}

// ---------------------------------------------------------------------------
// Algorithme de scoring
// ---------------------------------------------------------------------------

export interface IntentSignals {
  /** Temps passé par section (ms) */
  sectionTimeMs: Partial<Record<DecouvrirSection, number>>
  /** Score 0..1 de profondeur de scroll par section */
  sectionScrollDepth: Partial<Record<DecouvrirSection, number>>
  /** Durées de hover cumulées par code d'offre (ms) */
  offerHoverMs: Partial<Record<string, number>>
  /** Nombre de clics CTA secondaires par code d'offre */
  offerCtaClicks: Partial<Record<string, number>>
  /** Codes des offres comparées (>=2 = signal de comparaison) */
  comparedCodes: readonly string[]
}

export const EMPTY_INTENT_SIGNALS: IntentSignals = {
  sectionTimeMs: {},
  sectionScrollDepth: {},
  offerHoverMs: {},
  offerCtaClicks: {},
  comparedCodes: [],
}

export interface ScoredOffer {
  offer: OfferDescriptor
  score: number
  reasons: readonly string[]
}

const SECTION_TIME_WEIGHT = 0.3 / 60_000 // 60s de présence = +0.3
const HOVER_WEIGHT = 0.4 / 5_000 // 5s de hover cumulé = +0.4
const SCROLL_WEIGHT = 0.2 // multiplié par la profondeur 0..1
const CTA_CLICK_WEIGHT = 1.0
const TRACK_BOOST = 0.5
const DEFAULT_RECOMMENDED_BOOST = 0.25

/**
 * Détermine si une offre est pertinente pour un track donné.
 */
function isOfferEligible(offer: OfferDescriptor, track: UserTrack): boolean {
  if (offer.excludeTracks?.includes(track)) return false
  return true
}

/**
 * Calcule un score d'intention par offre, retourne la liste triée
 * décroissante.
 */
export function scoreOffers(
  signals: IntentSignals,
  track: UserTrack,
  catalog: readonly OfferDescriptor[] = ALL_OFFERS,
): readonly ScoredOffer[] {
  const scored: ScoredOffer[] = []

  for (const offer of catalog) {
    if (!isOfferEligible(offer, track)) continue

    const reasons: string[] = []
    let score = 0

    // Signal section (temps + scroll) — pondère le score sans exposer
    // de "minutes lues" à l'utilisateur (effet surveillance perçu
    // contre-productif sur un avatar SOBRE PROFESSIONNEL).
    const sectionTime = signals.sectionTimeMs[offer.section] ?? 0
    if (sectionTime > 0) {
      score += sectionTime * SECTION_TIME_WEIGHT
    }

    const scrollDepth = signals.sectionScrollDepth[offer.section] ?? 0
    if (scrollDepth > 0) {
      score += scrollDepth * SCROLL_WEIGHT
    }

    // Signal hover offre — pondère sans exposer le tracking
    const hoverMs = signals.offerHoverMs[offer.code] ?? 0
    if (hoverMs >= 500) {
      score += hoverMs * HOVER_WEIGHT
    }

    // Signal CTA secondaire — l'utilisateur a montré un intérêt actif
    const ctaClicks = signals.offerCtaClicks[offer.code] ?? 0
    if (ctaClicks > 0) {
      score += ctaClicks * CTA_CLICK_WEIGHT
      reasons.push('Tu as exploré cette offre')
    }

    // Boost track ciblé — raison principale (positive framing Walter §13)
    if (offer.primaryTracks?.includes(track)) {
      score += TRACK_BOOST
      reasons.push('Adapté à ton profil actuel')
    }

    // Boost mise en avant éditoriale par défaut — raison fallback
    if (offer.defaultRecommended) {
      score += DEFAULT_RECOMMENDED_BOOST
      if (reasons.length === 0) reasons.push('Choix le plus populaire')
    }

    // Boost comparaison — signal d'engagement actif sur plusieurs offres
    if (signals.comparedCodes.includes(offer.code) && signals.comparedCodes.length >= 2) {
      score += 0.3
      if (!reasons.some((r) => r.includes('exploré'))) {
        reasons.push('Comparée avec d’autres offres')
      }
    }

    scored.push({ offer, score, reasons })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored
}

/**
 * Renvoie les top N offres recommandées tous canaux confondus.
 * Par défaut : 4 offres, en privilégiant la diversité de families
 * (au moins 1 logiciel + 1 annuaire + 1 bundle si possible).
 */
export function getTopRecommendations(
  signals: IntentSignals,
  track: UserTrack,
  count = 4,
): readonly ScoredOffer[] {
  const all = scoreOffers(signals, track)
  if (all.length <= count) return all

  const result: ScoredOffer[] = []
  const seenFamilies = new Set<OfferFamily>()

  // 1er passage : on prend la meilleure de chaque famille tant qu'on peut
  for (const candidate of all) {
    if (result.length >= count) break
    if (!seenFamilies.has(candidate.offer.family)) {
      result.push(candidate)
      seenFamilies.add(candidate.offer.family)
    }
  }

  // 2e passage : on complète avec les meilleures restantes
  for (const candidate of all) {
    if (result.length >= count) break
    if (!result.includes(candidate)) result.push(candidate)
  }

  return result
}

export interface TrackSummary {
  track: UserTrack
  title: string
  description: string
  badgeLabel: string
}

export function summarizeTrack(access: UserAccess): TrackSummary {
  const track = deriveTrack(access)
  switch (track) {
    case 'dual':
      return {
        track,
        title: 'Tu utilises KOVAS + KOVAS Annuaire',
        description:
          'Tu es équipé sur les deux versants : logiciel terrain et visibilité publique. Découvre les modules avancés et les Packs Cabinet pour passer à la vitesse supérieure.',
        badgeLabel: 'Profil complet',
      }
    case 'logiciel_only':
      return {
        track,
        title: 'Tu utilises uniquement KOVAS',
        description:
          'Ton cabinet est outillé côté terrain. Une fiche annuaire te permettrait de capter directement des demandes de particuliers — sans publicité.',
        badgeLabel: 'Logiciel actif',
      }
    case 'annuaire_only':
      return {
        track,
        title: 'Tu es référencé sur KOVAS Annuaire',
        description:
          "Tu reçois déjà des demandes via l'annuaire. KOVAS te permettrait de produire tes rapports terrain 1h30 plus vite, et de synchroniser tes exports automatiquement.",
        badgeLabel: 'Annuaire actif',
      }
    default:
      return {
        track,
        title: "Tu n'as aucun abonnement actif",
        description:
          "Essaie gratuitement KOVAS pendant 30 jours (CB requise, débit auto à J+30, résiliable en 2 clics) ou inscris-toi gratuitement à l'annuaire pour capter tes premières demandes.",
        badgeLabel: 'Démarrage',
      }
  }
}
