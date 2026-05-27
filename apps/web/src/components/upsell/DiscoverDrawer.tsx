'use client'

import { Button } from '@/components/ui/button'
import {
  ADDON_MODULES,
  ADDON_PACKS,
  type AddonCode,
  type AddonPackCode,
  PRICING_PLANS,
  type PricingPlanCode,
} from '@/lib/pricing-plans'
import type { UserAccess } from '@/lib/upsell/access-control'
import { getEffectiveAddons } from '@/lib/upsell/access-control'
import { startTrialAction } from '@/lib/upsell/actions'
import type { PendingUpsellSuggestion } from '@/lib/upsell/load-access'
import { UPSELL_CATALOG, type UpsellCatalogEntry } from '@/lib/upsell/upsell-content'
import { cn } from '@/lib/utils'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Briefcase,
  Globe,
  Languages,
  Layers,
  MessageCircle,
  PenLine,
  Radar,
  Receipt,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  Users2,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useTransition } from 'react'

const ICON_MAP: Record<string, LucideIcon> = {
  Receipt,
  RefreshCw,
  PenLine,
  Languages,
  MessageCircle,
  Users,
  TrendingUp,
  Bell,
  Radar,
  Sparkles,
  Briefcase,
  Globe,
  Layers,
  ArrowUpRight,
  Users2,
}

const TIER_ORDER: readonly PricingPlanCode[] = [
  'essential',
  'decouverte',
  'pro',
  'all_inclusive',
  'cabinet',
] as const

function nextTierAbove(current: PricingPlanCode | null): PricingPlanCode | null {
  if (!current) return 'decouverte'
  const idx = TIER_ORDER.indexOf(current)
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null
  return TIER_ORDER[idx + 1] ?? null
}

export interface DiscoverDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  access: UserAccess
  suggestions: readonly PendingUpsellSuggestion[]
}

/**
 * <DiscoverDrawer> — drawer slide-in right, 3 onglets :
 *   1. Modules en essai      (addons + packs disponibles, essai 14j 1 clic)
 *   2. Forfait supérieur     (preview tier au-dessus avec features uniques)
 *   3. Tout le catalogue     (vue complète tiers + addons + packs)
 *
 * Suggestions personnalisées (depuis `upsell_suggestions`) badgeées
 * "Recommandé pour vous" dans l'onglet 1.
 */
export function DiscoverDrawer({ open, onOpenChange, access, suggestions }: DiscoverDrawerProps) {
  const [activeTab, setActiveTab] = useState<'trial' | 'upgrade' | 'catalog'>('trial')
  const recommendedTargets = useMemo(
    () => new Set(suggestions.map((s) => s.suggested_target)),
    [suggestions],
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-navy/30 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />
        <DialogPrimitive.Content
          aria-describedby="discover-drawer-description"
          className={cn(
            'fixed right-0 top-0 bottom-0 z-50 flex w-full sm:w-[480px] flex-col',
            'border-l border-rule/80 bg-paper shadow-glass-lg outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            'duration-300 ease-out',
          )}
        >
          <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3 border-b border-rule/40">
            <div>
              <DialogPrimitive.Title className="font-serif italic text-2xl text-ink leading-tight">
                Découvrir KOVAS
              </DialogPrimitive.Title>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute mt-1">
                Tous les modules · Essai 14 jours
              </p>
            </div>
            <DialogPrimitive.Close
              aria-label="Fermer"
              className="flex size-9 items-center justify-center rounded-full bg-sage/60 text-foreground/70 hover:bg-sage hover:text-foreground transition-colors"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Description id="discover-drawer-description" className="sr-only">
            Catalogue complet des modules KOVAS disponibles à l&apos;essai ou à l&apos;achat.
          </DialogPrimitive.Description>

          <div className="flex border-b border-rule/40 px-6 pt-2 shrink-0">
            <TabButton active={activeTab === 'trial'} onClick={() => setActiveTab('trial')}>
              Modules à l&apos;essai
            </TabButton>
            <TabButton active={activeTab === 'upgrade'} onClick={() => setActiveTab('upgrade')}>
              Forfait supérieur
            </TabButton>
            <TabButton active={activeTab === 'catalog'} onClick={() => setActiveTab('catalog')}>
              Tout
            </TabButton>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeTab === 'trial' && (
              <TrialTab
                access={access}
                recommendedTargets={recommendedTargets}
                onClose={() => onOpenChange(false)}
              />
            )}
            {activeTab === 'upgrade' && (
              <UpgradeTab access={access} onClose={() => onOpenChange(false)} />
            )}
            {activeTab === 'catalog' && (
              <CatalogTab access={access} onClose={() => onOpenChange(false)} />
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-2.5 text-[12px] font-medium transition-colors border-b-2 -mb-px',
        active
          ? 'text-ink border-chartreuse-deep'
          : 'text-ink-mute border-transparent hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

// ─────────────────── Tab 1 : Modules à l'essai ───────────────────
function TrialTab({
  access,
  recommendedTargets,
  onClose,
}: {
  access: UserAccess
  recommendedTargets: Set<string>
  onClose: () => void
}) {
  const effectiveAddons = new Set(getEffectiveAddons(access))
  const items = useMemo(() => {
    const addonItems = ADDON_MODULES.filter((a) => !effectiveAddons.has(a.code)).map((a) => {
      const entry = UPSELL_CATALOG[a.code]
      return entry
    })
    const packItems = ADDON_PACKS.filter((p) => !access.activePacks.includes(p.code)).map(
      (p) => UPSELL_CATALOG[p.code],
    )
    return [...addonItems, ...packItems]
  }, [access.activePacks, effectiveAddons])

  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-[13px] text-ink-mute">
        Vous avez déjà activé tous les modules à l&apos;essai disponibles.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((entry) => (
        <TrialCard
          key={entry.code}
          entry={entry}
          recommended={recommendedTargets.has(entry.code)}
          onClose={onClose}
        />
      ))}
    </div>
  )
}

function TrialCard({
  entry,
  recommended,
  onClose,
}: {
  entry: UpsellCatalogEntry
  recommended: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const Icon = ICON_MAP[entry.icon] ?? Sparkles

  const handleStart = () => {
    startTransition(async () => {
      const res = await startTrialAction(entry.code, 'discover_drawer')
      if (res.error) {
        console.warn('[TrialCard] failed', res.error)
        return
      }
      onClose()
      if (res.redirectTo) router.push(res.redirectTo)
      else router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-rule/60 bg-paper-soft/50 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <span
          aria-hidden
          className="size-10 rounded-md bg-chartreuse/15 flex items-center justify-center shrink-0"
        >
          <Icon className="size-4 text-[#0F1419]" />
        </span>
        {recommended ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.08em] bg-chartreuse/30 text-ink px-1.5 py-0.5 rounded">
            Recommandé
          </span>
        ) : null}
      </div>
      <div>
        <p className="font-medium text-[13px] text-ink leading-tight">{entry.title}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute mt-1">
          {entry.priceLabel} · {entry.trialLabel}
        </p>
      </div>
      <p className="text-[12px] text-ink-mute leading-relaxed flex-1">{entry.description}</p>
      <Button variant="accent" size="sm" onClick={handleStart} disabled={isPending}>
        Démarrer
        <ArrowRight className="size-3" />
      </Button>
    </div>
  )
}

// ─────────────────── Tab 2 : Forfait supérieur ───────────────────
function UpgradeTab({ access, onClose }: { access: UserAccess; onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const target = nextTierAbove(access.planCode)

  if (!target) {
    return (
      <div className="text-center py-10 text-[13px] text-ink-mute">
        Vous êtes déjà sur le forfait le plus complet.
      </div>
    )
  }

  const targetPlan = PRICING_PLANS.find((p) => p.code === target)
  const currentPlan = access.planCode ? PRICING_PLANS.find((p) => p.code === access.planCode) : null
  const entry = UPSELL_CATALOG[target]
  const deltaCents = (targetPlan?.monthlyPrice ?? 0) - (currentPlan?.monthlyPrice ?? 0)

  // Features uniques du tier supérieur (présentes dans target, absentes dans current)
  const uniqueFeatures = (targetPlan?.features ?? []).filter(
    (f) => !(currentPlan?.features ?? []).includes(f),
  )

  const handleUpgrade = () => {
    startTransition(async () => {
      const res = await startTrialAction(target, 'discover_drawer_upgrade')
      onClose()
      if (res.redirectTo) router.push(res.redirectTo)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-rule/60 bg-paper-soft/50 p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute mb-2">
          Prochain palier
        </p>
        <h3 className="font-serif italic text-2xl text-ink leading-tight">
          {targetPlan?.name ?? entry.title}
        </h3>
        <p className="text-[13px] text-ink-mute mt-2 leading-relaxed">{entry.description}</p>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="font-serif italic text-3xl text-ink">
            {(targetPlan?.monthlyPrice ?? 0) / 100}€
          </span>
          <span className="font-mono text-[11px] text-ink-mute">/ mois HT</span>
          {deltaCents > 0 && currentPlan ? (
            <span className="font-mono text-[10px] text-ink-mute ml-auto">
              + {deltaCents / 100}€ vs {currentPlan.name}
            </span>
          ) : null}
        </div>
      </div>

      {uniqueFeatures.length > 0 ? (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute mb-2">
            Ce que vous débloquerez
          </p>
          <ul className="space-y-1.5">
            {uniqueFeatures.slice(0, 7).map((f) => (
              <li key={f} className="flex items-start gap-2 text-[13px] text-ink">
                <span aria-hidden className="text-ink-mute mt-0.5">
                  →
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button
        variant="accent"
        size="default"
        onClick={handleUpgrade}
        disabled={isPending}
        className="w-full"
      >
        Passer sur {targetPlan?.name}
        <ArrowUpRight className="size-3.5" />
      </Button>
    </div>
  )
}

// ─────────────────── Tab 3 : Catalogue complet ───────────────────
function CatalogTab({ access: _access, onClose }: { access: UserAccess; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<
    'all' | 'productivity' | 'compliance' | 'commercial' | 'cabinet'
  >('all')

  const allEntries = useMemo(() => {
    const tiers = PRICING_PLANS.map((p) => UPSELL_CATALOG[p.code as PricingPlanCode])
    const addons = ADDON_MODULES.map((a) => UPSELL_CATALOG[a.code as AddonCode])
    const packs = ADDON_PACKS.map((p) => UPSELL_CATALOG[p.code as AddonPackCode])
    return [...tiers, ...packs, ...addons]
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allEntries.filter((e) => {
      if (category !== 'all' && e.category !== category) return false
      if (q && !e.title.toLowerCase().includes(q) && !e.description.toLowerCase().includes(q))
        return false
      return true
    })
  }, [allEntries, category, query])

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un module..."
        className="w-full rounded-md border border-rule/60 bg-paper-soft/50 px-3 py-2 text-[13px] text-ink placeholder:text-ink-ghost focus:outline-none focus:ring-2 focus:ring-foreground/20"
      />
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'productivity', 'compliance', 'commercial', 'cabinet'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              'font-mono text-[10px] uppercase tracking-[0.08em] px-2 py-1 rounded transition-colors',
              category === c
                ? 'bg-foreground text-paper'
                : 'bg-sage/40 text-ink-mute hover:bg-sage',
            )}
          >
            {c === 'all' ? 'Tout' : c}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((entry) => {
          const Icon = ICON_MAP[entry.icon] ?? Sparkles
          return (
            <button
              key={entry.code}
              type="button"
              onClick={() => {
                onClose()
                router.push(`/pricing/compare`)
              }}
              className="w-full text-left rounded-md border border-rule/60 bg-paper-soft/50 hover:bg-paper px-3 py-3 flex items-start gap-3 transition-colors"
            >
              <span
                aria-hidden
                className="size-8 rounded-md bg-chartreuse/15 flex items-center justify-center shrink-0"
              >
                <Icon className="size-3.5 text-[#0F1419]" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[13px] text-ink leading-tight truncate">
                  {entry.title}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute mt-0.5">
                  {entry.priceLabel} ·{' '}
                  {entry.kind === 'tier_upgrade'
                    ? 'Forfait'
                    : entry.kind === 'pack'
                      ? 'Pack'
                      : 'Module'}
                </p>
              </div>
              <ArrowRight className="size-3.5 text-ink-mute mt-1.5" />
            </button>
          )
        })}
        {filtered.length === 0 ? (
          <p className="text-center text-[13px] text-ink-mute py-6">Aucun résultat.</p>
        ) : null}
      </div>

      <div className="text-center pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onClose()
            router.push('/pricing/compare')
          }}
        >
          Comparaison détaillée
          <ArrowRight className="size-3" />
        </Button>
      </div>
    </div>
  )
}
