'use client'

import { DiscoverSidebarButton } from '@/components/upsell/DiscoverSidebarButton'
import type { TrackAccess } from '@/lib/access/track-access'
import type { AddonCode, PricingPlanCode } from '@/lib/pricing-plans'
import { type UserAccess, hasFeatureAccess } from '@/lib/upsell/access-control'
import type { PendingUpsellSuggestion } from '@/lib/upsell/load-access'
import { cn } from '@/lib/utils'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  Archive,
  Bell,
  Briefcase,
  Building2,
  ChartLine,
  Gift,
  HelpCircle,
  IdCard,
  Inbox,
  KeyRound,
  MessageSquare,
  Radar,
  Receipt,
  ScrollText,
  Send,
  Settings,
  Sparkle,
  TrendingUp,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

type MoreItem = {
  href: string
  label: string
  icon: LucideIcon
  requiredTier?: PricingPlanCode
  requiredAddons?: readonly AddonCode[]
}

type MoreSection = {
  title: string
  items: readonly MoreItem[]
}

/**
 * Sections de navigation regroupées pour le bottom sheet "Plus".
 *
 * L1 (2026-06-05) : tagged avec requiredTier / requiredAddons. Filtré en
 * runtime selon UserAccess. Section "Découvrir" ajoutée en bas.
 */
const LOGICIEL_SECTIONS: readonly MoreSection[] = [
  {
    title: 'Communication',
    items: [
      { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
      { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
      { href: '/dashboard/coach', label: 'Coach IA', icon: Sparkle },
    ],
  },
  {
    title: 'Workflow',
    items: [
      { href: '/dashboard/clients', label: 'Clients', icon: Users },
      { href: '/dashboard/properties', label: 'Biens', icon: Building2 },
      { href: '/dashboard/gain', label: 'Performance', icon: ChartLine },
      { href: '/dashboard/archive', label: 'Archives', icon: Archive },
      { href: '/dashboard/coffre', label: 'Coffre-fort certifications', icon: KeyRound },
      { href: '/dashboard/outils', label: 'Outils', icon: Wrench },
      { href: '/dashboard/annuaire', label: 'Mon annuaire', icon: Inbox },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      {
        href: '/dashboard/cockpit-ademe',
        label: 'Cockpit ADEME',
        icon: Radar,
        requiredTier: 'pro',
      },
      { href: '/dashboard/analytics', label: 'Analytics', icon: TrendingUp, requiredTier: 'pro' },
      {
        href: '/dashboard/veille',
        label: 'Veille',
        icon: Bell,
        requiredAddons: ['regulatory_watch'],
      },
      {
        href: '/dashboard/communaute',
        label: 'Communauté',
        icon: MessageSquare,
        requiredAddons: ['community_pro'],
      },
    ],
  },
  {
    title: 'Facturation',
    items: [
      { href: '/dashboard/facturation?tab=devis', label: 'Devis', icon: ScrollText },
      { href: '/dashboard/facturation?tab=factures', label: 'Factures', icon: Receipt },
      { href: '/dashboard/relances', label: 'Relances', icon: Send },
    ],
  },
  {
    title: 'Croissance',
    items: [
      {
        href: '/dashboard/prescripteurs',
        label: 'Prescripteurs',
        icon: Briefcase,
        requiredTier: 'pro',
      },
      { href: '/dashboard/affiliation', label: 'Affiliation rénovation', icon: Gift },
      { href: '/dashboard/account/parrainage', label: 'Parrainage', icon: Users },
    ],
  },
  {
    title: 'Système',
    items: [
      { href: '/dashboard/aide', label: 'Aide', icon: HelpCircle },
      { href: '/dashboard/account', label: 'Paramètres', icon: Settings },
    ],
  },
] as const

/**
 * Sections KOVAS Annuaire (B2C lead-gen) — affichées si l'organisation a
 * un track annuaire-only ou dual.
 */
const ANNUAIRE_SECTIONS: readonly MoreSection[] = [
  {
    title: 'KOVAS Annuaire',
    items: [
      { href: '/dashboard/annuaire/profile', label: 'Profil annuaire', icon: IdCard },
      { href: '/dashboard/annuaire/leads', label: 'Leads reçus', icon: Inbox },
      { href: '/dashboard/annuaire/stats', label: 'Stats fiche', icon: TrendingUp },
    ],
  },
] as const

/** Sélectionne les sections du bottom sheet selon le track dual. */
function getSectionsForTrack(track: TrackAccess): readonly MoreSection[] {
  switch (track) {
    case 'annuaire-only':
      return ANNUAIRE_SECTIONS
    case 'logiciel-only':
      return LOGICIEL_SECTIONS
    case 'dual':
      return [...LOGICIEL_SECTIONS, ...ANNUAIRE_SECTIONS]
    default:
      return []
  }
}

interface MobileMoreSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  access: UserAccess
  suggestions: readonly PendingUpsellSuggestion[]
  track: TrackAccess
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * MobileMoreSheet — Bottom sheet déclenché par le 5e tab "Plus" de
 * AppMobileNav. Filtre les items par accès (L1) + ajoute section "Découvrir".
 */
export function MobileMoreSheet({
  open,
  onOpenChange,
  access,
  suggestions,
  track,
}: MobileMoreSheetProps) {
  const pathname = usePathname()
  const sections = getSectionsForTrack(track)

  // Auto-close à chaque navigation (le user clique sur un Link → on ferme).
  useEffect(() => {
    if (open) onOpenChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-200',
          )}
        />
        <DialogPrimitive.Content
          aria-describedby="mobile-more-sheet-description"
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col',
            'rounded-t-[24px] border-t border-rule/60',
            'bg-paper shadow-glass-lg outline-none',
            'pb-[env(safe-area-inset-bottom)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
            'duration-200 ease-out',
          )}
        >
          {/* Grip handle */}
          <div className="flex justify-center pt-3 pb-2 shrink-0">
            <div aria-hidden className="h-1.5 w-12 rounded-full bg-foreground/15" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pb-3 shrink-0">
            <DialogPrimitive.Title className="text-2xl font-serif italic text-foreground">
              Plus de sections
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Fermer"
              className="flex size-9 items-center justify-center rounded-full bg-sage/60 text-foreground/70 hover:bg-sage hover:text-foreground transition-colors"
            >
              <X className="size-4" strokeWidth={2} />
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Description id="mobile-more-sheet-description" className="sr-only">
            Toutes les sections KOVAS non visibles dans la barre de navigation mobile principale,
            regroupées par catégorie.
          </DialogPrimitive.Description>

          {/* Body : sections scrollables (filtrées par track dual) */}
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {sections.map((section) => {
              const visibleItems = section.items.filter((item) => hasFeatureAccess(access, item))
              if (visibleItems.length === 0) return null
              return (
                <section key={section.title} className="mb-6 last:mb-2">
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.06em] text-foreground/55 mb-3">
                    {section.title}
                  </h3>
                  <ul className="grid grid-cols-2 gap-2">
                    {visibleItems.map((item) => {
                      const Icon = item.icon
                      const active = isActive(pathname, item.href)
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => onOpenChange(false)}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'flex min-h-[64px] items-center gap-3 rounded-[12px] p-4 transition-colors',
                              active
                                ? 'bg-sage text-foreground ring-1 ring-foreground/15'
                                : 'bg-sage/40 text-foreground/85 hover:bg-sage',
                            )}
                          >
                            <Icon className="size-5 shrink-0" strokeWidth={1.75} />
                            <span className="text-sm font-medium leading-tight">{item.label}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}

            {/* Section Découvrir — toujours visible */}
            <section className="mb-2">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.06em] text-foreground/55 mb-3">
                Découvrir
              </h3>
              <DiscoverSidebarButton access={access} suggestions={suggestions} variant="inline" />
            </section>
          </div>

          {/* Footer : bouton Fermer secondaire (alternative au X header) */}
          <div className="border-t border-rule/40 px-6 py-3 shrink-0">
            <DialogPrimitive.Close
              className={cn(
                'w-full rounded-pill bg-foreground text-paper py-3 text-sm font-semibold',
                'hover:bg-foreground/90 transition-colors',
              )}
            >
              Fermer
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * Hook utilitaire pour piloter l'ouverture du sheet depuis AppMobileNav.
 * Exporte aussi le state-pair sans wrapper si on a besoin de l'utiliser
 * ailleurs (ex. trigger depuis FAB Quick Actions).
 */
export function useMobileMoreSheet(): {
  open: boolean
  setOpen: (open: boolean) => void
} {
  const [open, setOpen] = useState(false)
  return { open, setOpen }
}
