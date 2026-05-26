/**
 * KOVAS — Registre canonique des items de sidebar (refonte 2026-05-23).
 *
 * Source de vérité pour les 5 zones de la sidebar :
 *
 *   Zone 1 — Avatar / identité (rendu inline dans AppSidebar)
 *   Zone 2 — Workflow quotidien (5 items par défaut)
 *   Zone 3 — Business (3 items par défaut)
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
  Brain,
  Calendar,
  FolderOpen,
  Gift,
  HelpCircle,
  Home,
  Inbox,
  KeyRound,
  LayoutGrid,
  MessageSquare,
  Receipt,
  Settings,
  Sparkle,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Identifiants stables des items. Servent de clé dans la table
 * sidebar_preferences (JSONB main_items / more_items) — NE JAMAIS renommer
 * sans migration, sinon les préférences user pointent dans le vide.
 */
export type SidebarItemId =
  | 'home'
  | 'dossiers'
  | 'calendar'
  | 'clients'
  | 'capture'
  | 'facturation'
  | 'analytics'
  | 'coach'
  | 'messages'
  | 'notifications'
  | 'annuaire'
  | 'archive'
  | 'coffre'
  | 'outils'
  | 'affiliation'
  | 'parrainage'
  | 'algos'

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
 * `Capture` (#5) reçoit `accent: true` → mise en avant visuelle chartreuse
 * subtile, pour matcher le DS v5 (action principale).
 */
export const SIDEBAR_ITEMS_REGISTRY: readonly SidebarItemDef[] = [
  // Zone 2 — Workflow quotidien (positions 0..4)
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
    id: 'capture',
    // FIX-JJ — multi-accès #2 : redirect intelligent vers le mode mission selon
    // le contexte (mission en cours / RDV imminent / fallback wizard).
    href: '/dashboard/capture',
    label: 'Capture',
    icon: Sparkles,
    defaultZone: 'main',
    defaultPosition: 4,
    customizable: true,
    accent: true,
  },

  // Zone 3 — Business (positions 5..7)
  {
    id: 'facturation',
    href: '/dashboard/facturation',
    label: 'Facturation',
    // Note : tooltip explicite pour lever toute ambiguïté entre cette page
    // (= revenus du diagnostiqueur, factures émises à SES clients) et
    // /dashboard/account?tab=facturation (= factures KOVAS pour son abonnement).
    tooltip: 'Vos devis et factures émises à vos clients (revenus)',
    icon: Receipt,
    defaultZone: 'main',
    defaultPosition: 5,
    customizable: true,
    badgeKey: 'overdue_invoices',
  },
  {
    id: 'analytics',
    href: '/dashboard/analytics',
    label: 'Statistiques',
    icon: BarChart3,
    defaultZone: 'main',
    defaultPosition: 6,
    customizable: true,
  },
  {
    id: 'coach',
    href: '/dashboard/coach',
    label: 'Coach IA',
    icon: Sparkle,
    defaultZone: 'main',
    defaultPosition: 7,
    customizable: true,
  },

  // Zone 4 — Menu "Plus" (positions 0..n)
  {
    id: 'messages',
    href: '/dashboard/messages',
    label: 'Messages',
    icon: MessageSquare,
    defaultZone: 'more',
    defaultPosition: 0,
    customizable: true,
    badgeKey: 'unread_messages',
  },
  {
    id: 'notifications',
    href: '/dashboard/notifications',
    label: 'Notifications',
    icon: Bell,
    defaultZone: 'more',
    defaultPosition: 1,
    customizable: true,
    badgeKey: 'unread_notifications',
  },
  {
    id: 'annuaire',
    href: '/dashboard/annuaire',
    label: 'Mon annuaire',
    icon: Inbox,
    defaultZone: 'more',
    defaultPosition: 2,
    customizable: true,
  },
  {
    id: 'archive',
    href: '/dashboard/archive',
    label: 'Archives',
    icon: Archive,
    defaultZone: 'more',
    defaultPosition: 3,
    customizable: true,
  },
  {
    id: 'coffre',
    href: '/dashboard/coffre',
    label: 'Coffre-fort certifications',
    icon: KeyRound,
    defaultZone: 'more',
    defaultPosition: 4,
    customizable: true,
  },
  {
    id: 'outils',
    href: '/dashboard/outils',
    label: 'Outils',
    icon: Wrench,
    defaultZone: 'more',
    defaultPosition: 5,
    customizable: true,
  },
  {
    id: 'affiliation',
    href: '/dashboard/affiliation',
    label: 'Affiliation rénovation',
    icon: Gift,
    defaultZone: 'more',
    defaultPosition: 6,
    customizable: true,
  },
  {
    id: 'parrainage',
    href: '/dashboard/account/parrainage',
    label: 'Parrainage',
    icon: Users,
    defaultZone: 'more',
    defaultPosition: 7,
    customizable: true,
  },
  // B82 (Vague 3A) — Découvrir > Algorithmes : catalogue diag-facing des
  // 13 algos A1.3.* (pendant interne du SectionAlgosCatalog de la home).
  {
    id: 'algos',
    href: '/dashboard/decouvrir/algos',
    label: 'Algorithmes',
    tooltip: 'Découvrir les 13 algorithmes propriétaires KOVAS',
    icon: Brain,
    defaultZone: 'more',
    defaultPosition: 8,
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
