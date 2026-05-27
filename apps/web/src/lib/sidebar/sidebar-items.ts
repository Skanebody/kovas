/**
 * KOVAS — Registre canonique des items de sidebar (refonte 2026-05-23 +
 * extension 2026-05-27 — Benjamin a demandé l'audit complet du registre :
 * ajout de 9 items manquants + retrait de `algos` qui est devenu une
 * sous-page de `decouvrir`).
 *
 * Source de vérité pour les 5 zones de la sidebar :
 *
 *   Zone 1 — Avatar / identité (rendu inline dans AppSidebar)
 *   Zone 2 — Workflow quotidien (5 items par défaut)
 *   Zone 3 — Business (4 items par défaut)
 *   Zone 4 — Menu "Plus" (collapsible, items secondaires)
 *   Zone 5 — Système (Aide / Paramètres / Personnaliser)
 *
 * Les zones 2+3 forment les "main items" (max 9 visibles), la zone 4 forme
 * les "more items". Le user peut redistribuer via la modale Personnaliser.
 */

import type { AddonCode, PricingPlanCode } from '@/lib/pricing-plans'
import {
  Archive,
  BarChart3,
  Bell,
  BookUser,
  Building2,
  Calendar,
  Compass,
  FolderOpen,
  HelpCircle,
  Home,
  Inbox,
  LayoutGrid,
  MessageSquare,
  Newspaper,
  Receipt,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Identifiants stables des items. Servent de clé dans la table
 * sidebar_preferences (JSONB main_items / more_items) — NE JAMAIS renommer
 * sans migration, sinon les préférences user pointent dans le vide.
 *
 * Note 2026-05-27 : `algos` retiré du registre (devenu sous-page de
 * `/dashboard/decouvrir/algos`, accessible via l'item `decouvrir`). Si
 * d'anciennes préférences utilisateur référencent encore `algos`, le helper
 * `SIDEBAR_ITEMS_BY_ID.get('algos')` renvoie undefined et la sidebar ignore
 * l'entrée (cf. app-sidebar.tsx ligne 437 filter).
 */
export type SidebarItemId =
  | 'home'
  | 'dossiers'
  | 'calendar'
  | 'clients'
  | 'properties'
  | 'capture'
  | 'facturation'
  | 'analytics'
  | 'gain'
  | 'messages'
  | 'archive'
  | 'outils'
  | 'parrainage'
  | 'annuaire'
  | 'decouvrir'
  | 'leads'
  | 'relances'
  | 'veille'
  | 'cockpit_ademe'
  | 'cockpit_fraude'

export type SidebarZone = 'main' | 'more'

export interface SidebarItemDef {
  /** Identifiant stable (clé JSONB). */
  id: SidebarItemId
  /** Lien Next.js (href interne). */
  href: string
  /** Label affiché (FR). */
  label: string
  /**
   * Tooltip optionnel (hover natif via `title=`).
   * Sert à lever toute ambiguïté entre deux items proches sémantiquement
   * — par ex. distinguer "Facturation" (revenus diagnostiqueur) de
   * "Compte > Factures KOVAS" (abonnement payé à KOVAS).
   */
  tooltip?: string
  /** Icône Lucide React. */
  icon: LucideIcon
  /** Zone par défaut (avant personnalisation user). */
  defaultZone: SidebarZone
  /** Position par défaut dans sa zone (0..n). */
  defaultPosition: number
  /** True si le user peut le masquer / déplacer (false = item système). */
  customizable: boolean
  /** Restriction d'accès optionnelle (tier / addons). */
  requiredTier?: PricingPlanCode
  requiredAddons?: readonly AddonCode[]
  /** Clé du compteur de badge à afficher (null = pas de badge). */
  badgeKey?: 'active_dossiers' | 'overdue_invoices' | 'unread_messages' | 'unread_notifications'
  /** Style visuel "accent" (pour Capture, mise en avant chartreuse subtile). */
  accent?: boolean
}

/**
 * Registre canonique. Chaque item définit son href, label, icône, zone par
 * défaut, et position par défaut.
 *
 * `Capture` (#6) reçoit `accent: true` → mise en avant visuelle chartreuse
 * subtile, pour matcher le DS v5 (action principale).
 */
export const SIDEBAR_ITEMS_REGISTRY: readonly SidebarItemDef[] = [
  // =====================================================================
  // Zone 2 — Workflow quotidien (positions 0..5)
  // =====================================================================
  {
    id: 'home',
    href: '/dashboard/dashboard',
    label: 'Accueil',
    icon: Home,
    defaultZone: 'main',
    defaultPosition: 0,
    customizable: true,
  },
  {
    id: 'dossiers',
    href: '/dashboard/dossiers',
    label: 'Dossiers',
    icon: FolderOpen,
    defaultZone: 'main',
    defaultPosition: 1,
    customizable: true,
    badgeKey: 'active_dossiers',
  },
  {
    id: 'calendar',
    href: '/dashboard/calendar',
    label: 'Calendrier',
    icon: Calendar,
    defaultZone: 'main',
    defaultPosition: 2,
    customizable: true,
  },
  {
    id: 'clients',
    href: '/dashboard/clients',
    label: 'Clients',
    icon: Users,
    defaultZone: 'main',
    defaultPosition: 3,
    customizable: true,
  },
  {
    id: 'properties',
    href: '/dashboard/properties',
    label: 'Biens',
    tooltip: 'Biens immobiliers visités (DPE, amiante, plomb, etc.)',
    icon: Building2,
    defaultZone: 'main',
    defaultPosition: 4,
    customizable: true,
  },
  {
    id: 'capture',
    // FIX-JJ — multi-accès #2 : redirect intelligent vers le mode mission selon
    // le contexte (mission en cours / RDV imminent / fallback wizard).
    // NB : l'id reste 'capture' pour préserver les préférences user en DB.
    // Le label est passé à "Démarrer" (verbe d'action métier, plus intuitif
    // que "Capture" qui est un anglicisme technique non natif diagnostiqueur,
    // cf. KOVAS_COPY_FOUNDATIONS §8.1 vocabulaire interdit en client-facing).
    href: '/dashboard/capture',
    label: 'Démarrer',
    tooltip: 'Démarrer une nouvelle mission ou reprendre celle en cours',
    icon: Sparkles,
    defaultZone: 'main',
    defaultPosition: 5,
    customizable: true,
    accent: true,
  },

  // =====================================================================
  // Zone 3 — Business (positions 6..8)
  // =====================================================================
  {
    id: 'facturation',
    href: '/dashboard/facturation',
    label: 'Facturation',
    // Note : tooltip explicite pour lever toute ambiguïté entre cette page
    // (= revenus du diagnostiqueur, factures émises à SES clients) et
    // /dashboard/account?tab=facturation (= factures KOVAS pour son abonnement).
    tooltip: 'Devis et factures émises à tes clients (revenus)',
    icon: Receipt,
    defaultZone: 'main',
    defaultPosition: 6,
    customizable: true,
    badgeKey: 'overdue_invoices',
  },
  {
    id: 'analytics',
    href: '/dashboard/analytics',
    label: 'Statistiques',
    tooltip: 'KPI activité, benchmarks zone et tendances mensuelles',
    icon: BarChart3,
    defaultZone: 'main',
    defaultPosition: 7,
    customizable: true,
  },
  {
    id: 'gain',
    href: '/dashboard/gain',
    label: 'Gain',
    tooltip: 'Suivi du gain de temps cumulé ce mois et projection annuelle',
    icon: TrendingUp,
    defaultZone: 'main',
    defaultPosition: 8,
    customizable: true,
  },

  // =====================================================================
  // Zone 4 — Menu "Plus" (positions 0..n)
  // =====================================================================
  {
    id: 'annuaire',
    href: '/dashboard/annuaire',
    label: 'Annuaire',
    tooltip: 'Ta fiche publique KOVAS Annuaire (avis, stats, leads B2C)',
    icon: BookUser,
    defaultZone: 'more',
    defaultPosition: 0,
    customizable: true,
  },
  {
    id: 'decouvrir',
    href: '/dashboard/decouvrir',
    label: 'Découvrir',
    tooltip: 'Catalogue des offres KOVAS : logiciel, annuaire, bundles, add-ons',
    icon: Compass,
    defaultZone: 'more',
    defaultPosition: 1,
    customizable: true,
  },
  {
    id: 'leads',
    href: '/dashboard/leads',
    label: 'Leads',
    tooltip: 'File des demandes B2C entrantes depuis l’annuaire',
    icon: Inbox,
    defaultZone: 'more',
    defaultPosition: 2,
    customizable: true,
  },
  {
    id: 'relances',
    href: '/dashboard/relances',
    label: 'Relances',
    tooltip: 'Relances automatiques des factures impayées',
    icon: Bell,
    defaultZone: 'more',
    defaultPosition: 3,
    customizable: true,
    badgeKey: 'overdue_invoices',
  },
  {
    id: 'messages',
    href: '/dashboard/messages',
    label: 'Messages',
    icon: MessageSquare,
    defaultZone: 'more',
    defaultPosition: 4,
    customizable: true,
    badgeKey: 'unread_messages',
  },
  {
    id: 'veille',
    href: '/dashboard/veille',
    label: 'Veille',
    tooltip: 'Veille réglementaire IA : nouveautés DPE, jurisprudence, méthodes',
    icon: Newspaper,
    defaultZone: 'more',
    defaultPosition: 5,
    customizable: true,
  },
  {
    id: 'cockpit_ademe',
    href: '/dashboard/cockpit-ademe',
    label: 'Pré-validation ADEME',
    tooltip: 'Cross-check 6 sources publiques avant envoi ADEME (game-changer 1)',
    icon: ShieldCheck,
    defaultZone: 'more',
    defaultPosition: 6,
    customizable: true,
  },
  {
    id: 'cockpit_fraude',
    href: '/dashboard/cockpit-fraude',
    label: 'Anti-fraude DPE',
    tooltip: 'Score anti-fraude de tes DPE (game-changer 6)',
    icon: ShieldAlert,
    defaultZone: 'more',
    defaultPosition: 7,
    customizable: true,
  },
  {
    id: 'archive',
    href: '/dashboard/archive',
    label: 'Archives',
    icon: Archive,
    defaultZone: 'more',
    defaultPosition: 8,
    customizable: true,
  },
  {
    id: 'outils',
    href: '/dashboard/outils',
    label: 'Outils',
    tooltip: 'Convertisseurs, calculatrices, génération QR code…',
    icon: Wrench,
    defaultZone: 'more',
    defaultPosition: 9,
    customizable: true,
  },
  {
    id: 'parrainage',
    href: '/dashboard/account/parrainage',
    label: 'Parrainage',
    tooltip: 'Programme parrainage : gagne 1 mois offert par filleul actif',
    icon: Users,
    defaultZone: 'more',
    defaultPosition: 10,
    customizable: true,
  },
] as const

/**
 * Items système (Zone 5) — toujours visibles en bas, non personnalisables.
 * Aide / Paramètres / Personnaliser sont rendus en dur dans AppSidebar.
 */
export const SYSTEM_ITEMS = {
  aide: {
    href: '/dashboard/aide',
    label: 'Aide',
    icon: HelpCircle,
  },
  parametres: {
    href: '/dashboard/account',
    label: 'Paramètres',
    icon: Settings,
  },
  personnaliser: {
    label: 'Personnaliser',
    icon: LayoutGrid,
  },
} as const

/** Index par id pour lookup O(1). */
export const SIDEBAR_ITEMS_BY_ID: ReadonlyMap<SidebarItemId, SidebarItemDef> = new Map(
  SIDEBAR_ITEMS_REGISTRY.map((item) => [item.id, item]),
)

/** Retourne l'item par id (undefined si inconnu). */
export function getSidebarItem(id: SidebarItemId): SidebarItemDef | undefined {
  return SIDEBAR_ITEMS_BY_ID.get(id)
}
