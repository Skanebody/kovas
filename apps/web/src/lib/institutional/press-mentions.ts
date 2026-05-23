/**
 * KOVAS — Données presse (page /presse)
 *
 * Communiqués, mentions presse et statistiques marché agrégées
 * pour l'espace presse. Tout placeholder est marqué explicitement
 * `[placeholder]` pour rappeler la nécessité de remplacement avant prod.
 */

export interface PressRelease {
  /** Slug stable (URL future si chaque communiqué reçoit sa page) */
  id: string
  /** Date ISO 8601 */
  date: string
  /** Titre du communiqué */
  title: string
  /** Résumé 2-3 phrases */
  excerpt: string
  /** Lien PDF complet — null pour V1 placeholder */
  pdfPath: string | null
  /** Statut éditorial */
  status: 'published' | 'placeholder'
}

/**
 * Communiqués officiels publiés par Nexus 1993.
 *
 * V1 : 3 placeholders alignés sur le plan de communication M0-M12.
 * Les vrais communiqués remplaceront ces entrées à mesure des annonces.
 */
export const PRESS_RELEASES: PressRelease[] = [
  {
    id: 'kovas-mvp-launch',
    date: '2026-09-15',
    title: 'KOVAS lance son MVP auprès des diagnostiqueurs indépendants français',
    excerpt:
      "Après six mois de bêta privée auprès de quarante diagnostiqueurs, KOVAS ouvre l'accès public à sa plateforme SaaS. L'outil promet une économie d'une heure trente par mission DPE grâce à la saisie vocale, aux photos géolocalisées et aux exports universels.",
    pdfPath: null,
    status: 'placeholder',
  },
  {
    id: 'kovas-seed-round',
    date: '2027-01-20',
    title: '[placeholder] Annonce levée de fonds amorçage',
    excerpt:
      "Communiqué à publier au moment de l'annonce officielle d'une éventuelle levée de fonds. La trajectoire actuelle privilégie un développement en bootstrap solopreneur jusqu'au million d'euros de chiffre d'affaires récurrent.",
    pdfPath: null,
    status: 'placeholder',
  },
  {
    id: 'kovas-1000-users',
    date: '2027-06-10',
    title: '[placeholder] KOVAS franchit le cap des 1 000 diagnostiqueurs équipés',
    excerpt:
      "Communiqué prévu lors du passage symbolique des mille diagnostiqueurs payants. La date affichée est une projection basée sur le plan de croissance interne, non un engagement public.",
    pdfPath: null,
    status: 'placeholder',
  },
] as const

export interface PressLogo {
  id: string
  name: string
  /** Chemin vers le SVG sobre dans `/public/press/logos/` */
  logoPath: string
  /**
   * Lien vers l'article ou la mention.
   *
   * Lot #153 SITE-POLISH : aucun article réel n'existe encore — `url` reste
   * `null` pour rendre le logo non-cliquable avec tooltip "Article à venir".
   * Ne jamais inventer d'URL vers un journal (interdit propriété intellectuelle
   * et trompeur pour le lecteur).
   */
  url: string | null
}

/**
 * Mentions presse cibles — affichées en logos.
 *
 * IMPORTANT : ces médias sont des cibles éditoriales du plan presse, pas
 * encore des publications effectives. La page présente cette section
 * comme "Médias suivant le secteur" pour éviter toute ambiguïté. Les logos
 * SVG sont sobres (typographie monochrome `#7E8AA4`), créés en interne pour
 * éviter toute reproduction de logo officiel sous droit (cf. lot #153).
 */
export const PRESS_MENTIONS: PressLogo[] = [
  {
    id: 'les-echos',
    name: 'Les Échos',
    logoPath: '/press/logos/les-echos.svg',
    url: null,
  },
  {
    id: 'le-moniteur',
    name: 'Le Moniteur',
    logoPath: '/press/logos/le-moniteur.svg',
    url: null,
  },
  {
    id: 'capital',
    name: 'Capital',
    logoPath: '/press/logos/capital.svg',
    url: null,
  },
  {
    id: 'bfm-immo',
    name: 'BFM Immo',
    logoPath: '/press/logos/bfm-immo.svg',
    url: null,
  },
  {
    id: 'le-particulier',
    name: 'Le Particulier',
    logoPath: '/press/logos/le-particulier.svg',
    url: null,
  },
  {
    id: 'decideurs-magazine',
    name: 'Décideurs Magazine',
    logoPath: '/press/logos/decideurs.svg',
    url: null,
  },
] as const

export interface MarketStat {
  id: string
  value: string
  label: string
  source: string
}

export const MARKET_STATS: MarketStat[] = [
  {
    id: 'diagnosticians-fr',
    value: '13 000',
    label: 'Diagnostiqueurs immobiliers indépendants',
    source: 'Estimation observatoire OPPBTP 2024',
  },
  {
    id: 'dpe-median-price',
    value: '145 €',
    label: 'Prix médian constaté pour un DPE en France',
    source: "Étude tarifaire UFC-Que Choisir 2023, mise à jour interne 2025",
  },
  {
    id: 'fg-properties-share',
    value: '32 %',
    label: 'Biens en location classés F ou G en France métropolitaine',
    source: 'ADEME, base nationale DPE, mai 2025',
  },
] as const

/**
 * Contact presse dédié.
 *
 * Décision Lot #153 SITE-POLISH (2026-05-23) : seule l'adresse `contact@kovas.fr`
 * est valide et publique tant que les mailboxes role-based ne sont pas
 * provisionnées. L'ancienne `presse@kovas.fr` est aliasée vers contact général.
 */
export const PRESS_CONTACT = {
  email: 'contact@kovas.fr',
  // Numéro intentionnellement laissé en placeholder tant que la mailbox
  // dédiée n'est pas effectivement provisionnée (cf. company-identity.ts).
  phone: '[placeholder à compléter]',
  contactName: 'Benjamin BEL',
  role: 'Fondateur et porte-parole',
} as const
