/**
 * KOVAS — Catalogue des 13 algorithmes A1.3.* exposés au diagnostiqueur.
 *
 * Lot B82 (Vague 3A) : version diag-facing du `SectionAlgosCatalog` de la
 * home publique. Chaque algo y est référencé avec :
 *  - son statut d'exposition dans l'app (`exposed` / `coming-soon`)
 *  - la route où le diagnostiqueur peut le voir agir (si exposé)
 *  - le composant icône Lucide qui le représente
 *
 * Source de vérité partagée avec la page `/dashboard/decouvrir/algos`.
 * Quand un nouvel algo est branché dans une page existante, on bascule son
 * statut ici pour mettre à jour automatiquement le badge "EXPOSÉ" + le lien.
 */

import {
  AlertTriangle,
  Bell,
  Brain,
  Database,
  FileSearch,
  Layers,
  LineChart,
  RefreshCw,
  Scan,
  Search,
  Shield,
  Target,
  TrendingDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AlgoExposureStatus = 'exposed' | 'coming-soon'

export interface AlgoCatalogEntry {
  /** Code stable A1.3.X — utilisé comme clé React + tracking analytics. */
  readonly code: string
  /** Icône Lucide associée (cohérence avec la home publique). */
  readonly icon: LucideIcon
  /** Titre court. */
  readonly title: string
  /** "Ce que ça fait" — registre technique. */
  readonly what: string
  /** "Pour toi" — bénéfice diagnostiqueur (tutoiement strict). */
  readonly forYou: string
  /** Statut d'exposition dans l'app. */
  readonly status: AlgoExposureStatus
  /**
   * Route interne où l'algo est visible (si `status === 'exposed'`).
   * `undefined` si pas encore branché côté UI (coming-soon).
   */
  readonly exposedAt?: string
  /**
   * Libellé de la surface qui expose l'algo (utilisé sur la card catalogue).
   * Ex: "Dashboard", "Validation mission", "Compte > Parrainage".
   */
  readonly exposedAtLabel?: string
}

/**
 * Catalogue ordonné (1 → 13) — ordre cohérent avec la home publique.
 *
 * Statut MAJ Vague NEURO (26 mai 2026) :
 *  - 13/13 EXPOSÉS : chaque algo pointe vers la surface dashboard où il agit
 *    déjà (parfois via widget intégré, parfois via page complète).
 *  - Mapping algos → surfaces dashboard :
 *      A1.3.1  → /dashboard/cockpit-fraude   (DPE shopping)
 *      A1.3.2  → /dashboard/cockpit-ademe/prevalidation (cadastre)
 *      A1.3.3  → /dashboard/dossiers         (score conformité pré-validation)
 *      A1.3.4  → /dashboard/properties       (profil unifié bien)
 *      A1.3.5  → /dashboard/leads/incoming   (lead scoring intent)
 *      A1.3.6  → /dashboard/dossiers         (Vision IA équipement)
 *      A1.3.7  → /dashboard/dossiers         (tri docs client)
 *      A1.3.8  → /dashboard/account          (sync annuaire 4 sources)
 *      A1.3.9  → /dashboard/cockpit-fraude   (anomalies production)
 *      A1.3.10 → /dashboard/dashboard        (alerte expirations)
 *      A1.3.11 → /dashboard/clients         (risque churn)
 *      A1.3.12 → /dashboard/account/parrainage (SEO fiche)
 *      A1.3.13 → /dashboard/analytics       (apprentissage méthode)
 *
 * Si un algo est désactivé / pas encore branché en surface UI, basculer
 * son `status` à `'coming-soon'` et supprimer `exposedAt`.
 */
export const DASHBOARD_ALGOS_CATALOG: ReadonlyArray<AlgoCatalogEntry> = [
  {
    code: 'A1.3.6',
    icon: Scan,
    title: 'Vision équipement',
    what: 'Reconnaît chaudières, étiquettes énergétiques et matériaux isolants directement depuis tes photos terrain.',
    forYou: 'Les caractéristiques se pré-remplissent toutes seules. Tu valides au lieu de saisir.',
    // V2 différée (cf. CLAUDE.md §3 — Vision IA reportée 3-6 mois post-launch)
    status: 'coming-soon',
  },
  {
    code: 'A1.3.3',
    icon: Shield,
    title: 'Score conformité',
    what: 'Note de 0 à 100 sur la cohérence globale du DPE : croisement cadastre, distribution locale, équipements, surface.',
    forYou: 'Tu sais avant export si ton rapport va passer les contrôles ADEME.',
    status: 'exposed',
    exposedAt: '/dashboard/dossiers',
    exposedAtLabel: 'Pré-validation mission',
  },
  {
    code: 'A1.3.2',
    icon: Layers,
    title: 'Cohérence cadastre',
    what: 'Compare la surface saisie avec le cadastre IGN officiel. Alerte si écart supérieur à 10 %.',
    forYou: 'Tu évites les sanctions ADEME pour incohérence métré. Détection en 0,2 seconde.',
    status: 'exposed',
    exposedAt: '/dashboard/cockpit-ademe/prevalidation',
    exposedAtLabel: 'Pré-validation ADEME',
  },
  {
    code: 'A1.3.4',
    icon: Database,
    title: 'Profil unifié propriété',
    what: 'Agrège ADEME + IGN + DVF + Géorisques + BAN en un seul appel API.',
    forYou:
      '15 minutes de recherche gagnées par mission. Tu arrives sur place avec tout le contexte.',
    status: 'exposed',
    exposedAt: '/dashboard/properties',
    exposedAtLabel: 'Fiche bien',
  },
  {
    code: 'A1.3.1',
    icon: Search,
    title: 'DPE shopping detection',
    what: 'Détecte les propriétaires qui multiplient les diagnostics chez plusieurs cabinets en peu de temps pour obtenir la meilleure classe.',
    forYou:
      'Tu identifies les clients qui cherchent un diag « arrangeant ». Tu protèges ta certification.',
    status: 'exposed',
    exposedAt: '/dashboard/cockpit-fraude',
    exposedAtLabel: 'Cockpit fraude',
  },
  {
    code: 'A1.3.9',
    icon: AlertTriangle,
    title: 'Anomalies de production',
    what: 'Détecte les jumps suspects dans ta zone : classe G en 2023 puis A en 2024 sans travaux déclarés.',
    forYou: 'Tu sais quels biens dans ton secteur risquent de provoquer un signalement.',
    status: 'exposed',
    exposedAt: '/dashboard/cockpit-fraude',
    exposedAtLabel: 'Cockpit fraude',
  },
  {
    code: 'A1.3.7',
    icon: FileSearch,
    title: 'Tri des documents client',
    what: 'Classe automatiquement les docs uploadés par le propriétaire : factures énergie, anciens DPE, plans, attestations travaux.',
    forYou: 'Tu arrives sur place avec un dossier déjà structuré. Zéro tri manuel à faire.',
    status: 'exposed',
    exposedAt: '/dashboard/dossiers',
    exposedAtLabel: 'Documents dossier',
  },
  {
    code: 'A1.3.10',
    icon: Bell,
    title: 'Alerte expirations',
    what: 'Prédit la date d’expiration de ta certification COFRAC et de ta RC Pro. Alerte 90, 60 et 30 jours avant.',
    forYou: "Aucun risque d'oubli. Plus de mission refusée pour certification expirée.",
    status: 'exposed',
    exposedAt: '/dashboard',
    exposedAtLabel: 'Tableau de bord',
  },
  {
    code: 'A1.3.13',
    icon: Brain,
    title: 'Apprentissage de ta méthode',
    what: 'Apprend ta façon de saisir au fil des missions : terminologie, ordre des pièces, équipements types.',
    forYou:
      'Les suggestions deviennent de plus en plus précises. -60 à -70 % de tokens IA après 6 mois.',
    // Phase 3 différée (cf. CLAUDE.md §3 — assistant IA conversationnel métier M19+)
    status: 'coming-soon',
  },
  {
    code: 'A1.3.5',
    icon: Target,
    title: 'Lead scoring intent',
    what: "Score d'intention 0-100 sur chaque demande B2C reçue via kovas.fr. Routing Thompson sampling vers le diag le plus pertinent.",
    forYou: 'Tu reçois en priorité les leads qui vont signer. Pas de temps perdu sur les curieux.',
    status: 'exposed',
    exposedAt: '/dashboard/leads/incoming',
    exposedAtLabel: 'Leads B2C',
  },
  {
    code: 'A1.3.11',
    icon: TrendingDown,
    title: 'Risque de churn client',
    what: 'Repère tes clients à risque de revente prochaine (signaux DVF, durée détention, prix marché).',
    forYou: '+20 % de missions récurrentes grâce aux relances ciblées au bon moment.',
    status: 'exposed',
    exposedAt: '/dashboard/clients',
    exposedAtLabel: 'Liste clients',
  },
  {
    code: 'A1.3.12',
    icon: LineChart,
    title: 'SEO de ta fiche publique',
    what: 'Audit en continu de ta fiche kovas.fr/[ville] : title, meta, schema.org, maillage, mots-clés.',
    forYou: 'Ta fiche annuaire remonte sur Google sans publicité. Leads B2C en pilote auto.',
    // V1.5 : page dédiée audit SEO fiche publique pas encore exposée
    // (la surface actuelle /account/parrainage gère le programme de parrainage, pas le SEO).
    status: 'coming-soon',
  },
  {
    code: 'A1.3.8',
    icon: RefreshCw,
    title: 'Sync annuaire 4 sources',
    what: 'Met à jour ta fiche depuis 4 sources officielles : DHUP, INSEE Sirene, COFRAC, Google My Business.',
    forYou:
      'Aucun travail manuel. Ta fiche reflète tes certifications réelles 24 h après tout changement.',
    status: 'exposed',
    exposedAt: '/dashboard/account',
    exposedAtLabel: 'Mon compte',
  },
]

/** Compteurs dérivés (utilisés en footer page catalogue). */
export const ALGOS_STATS = {
  total: DASHBOARD_ALGOS_CATALOG.length,
  exposed: DASHBOARD_ALGOS_CATALOG.filter((a) => a.status === 'exposed').length,
  comingSoon: DASHBOARD_ALGOS_CATALOG.filter((a) => a.status === 'coming-soon').length,
} as const
