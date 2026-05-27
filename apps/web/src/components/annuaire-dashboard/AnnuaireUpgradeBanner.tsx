import 'server-only'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatMonthlyPriceShort, getUpgradeMessage } from '@/lib/annuaire/upgrade-message'
import type { AnnuairePlanCode, LogicielPlanCode } from '@/lib/pricing-plans'
import { createClient } from '@/lib/supabase/server'
import { ArrowRight, Check } from 'lucide-react'
import Link from 'next/link'
import type React from 'react'
import { BannerDismissShell } from './BannerDismissShell'

/**
 * AnnuaireUpgradeBanner — Server Component (lecture DB subscriptions).
 *
 * Affiche un bandeau d'upgrade contextuel selon le tier annuaire courant du
 * diagnostiqueur. La logique de message est dans
 * `lib/annuaire/upgrade-message.ts` (helper testable). Ce composant se
 * charge uniquement de :
 *   - récupérer les tiers actifs depuis Supabase (souscriptions actives)
 *   - rendre le markup DS v5 (sage card + chartreuse CTA)
 *   - wrap le tout dans `<BannerDismissShell>` qui gère le dismiss localStorage
 *
 * Si aucune suggestion pertinente (user déjà sur Pro/Cabinet/+) : `return null`.
 *
 * Props optionnelles pour les call sites qui connaissent déjà les tiers (évite
 * une seconde requête DB). Sinon le composant fetch lui-même via le profile.
 */
interface AnnuaireUpgradeBannerProps {
  /** Tier annuaire courant si déjà connu côté call site. */
  currentAnnuaireTier?: AnnuairePlanCode | null
  /** Tier logiciel courant si déjà connu côté call site. */
  currentSaasTier?: LogicielPlanCode | null
}

interface ActiveSubscriptionRow {
  plan_code?: string | null
  tier?: string | null
}

async function loadCurrentTiers(): Promise<{
  annuaireTier: AnnuairePlanCode | null
  saasTier: LogicielPlanCode | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { annuaireTier: null, saasTier: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('default_org_id')
    .eq('id', user.id)
    .maybeSingle()

  const orgId = (profile as { default_org_id?: string | null } | null)?.default_org_id
  if (!orgId) return { annuaireTier: null, saasTier: null }

  // Cast untyped local : la colonne `plan_code` est introduite par la
  // migration Phase B et peut ne pas être présente dans tous les schémas.
  const untyped = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          eq: (col: string, val: string) => Promise<{ data: unknown[] | null }>
        }
      }
    }
  }

  // Première tentative avec plan_code + tier (schémas Phase B et postérieurs).
  let raw: ActiveSubscriptionRow[] = []
  const firstAttempt = await untyped
    .from('subscriptions')
    .select('plan_code, tier, status')
    .eq('organization_id', orgId)
    .eq('status', 'active')
  if (firstAttempt.data && firstAttempt.data.length > 0) {
    raw = firstAttempt.data as ActiveSubscriptionRow[]
  } else {
    // Fallback schéma E2c : seule la colonne `tier` existe.
    const fallback = await untyped
      .from('subscriptions')
      .select('tier, status')
      .eq('organization_id', orgId)
      .eq('status', 'active')
    raw = (fallback.data ?? []) as ActiveSubscriptionRow[]
  }

  // Codes annuaire / logiciel reconnus (V5 + alias V3).
  const ANNUAIRE_CODES = new Set<string>([
    'annuaire_free',
    'annuaire_local',
    'annuaire_regional',
    'annuaire_national',
    'annuaire_pro',
    'annuaire_visibility',
    'annuaire_sponsored',
  ])

  const LOGICIEL_CODES = new Set<string>([
    'essai',
    'solo_light',
    'solo_pro',
    'cabinet',
    'cabinet_plus',
    'logiciel_free',
    'logiciel_starter',
    'logiciel_active',
    'logiciel_cabinet',
    'logiciel_enterprise',
  ])

  let annuaireTier: AnnuairePlanCode | null = null
  let saasTier: LogicielPlanCode | null = null

  for (const row of raw) {
    const code = row.plan_code ?? row.tier
    if (!code) continue
    if (ANNUAIRE_CODES.has(code) && annuaireTier === null) {
      annuaireTier = code as AnnuairePlanCode
    } else if (LOGICIEL_CODES.has(code) && saasTier === null) {
      saasTier = code as LogicielPlanCode
    }
  }

  return { annuaireTier, saasTier }
}

/**
 * Helper : prix mensuel du tier courant pour affichage eyebrow.
 * Valeurs lues depuis pricing-plans.ts (source de vérité). Hardcodées ici
 * UNIQUEMENT pour l'affichage cosmétique du tier courant en eyebrow.
 */
function getCurrentTierPrice(
  code: 'none' | 'annuaire_free' | 'annuaire_local' | 'annuaire_regional' | 'annuaire_national',
): number {
  if (code === 'annuaire_local') return 1900
  if (code === 'annuaire_regional') return 3900
  if (code === 'annuaire_national') return 7900
  return 0
}

export async function AnnuaireUpgradeBanner(
  props: AnnuaireUpgradeBannerProps = {},
): Promise<React.JSX.Element | null> {
  // Détermine les tiers : props prioritaires (cas où le call site a déjà
  // fetched), sinon fetch interne via le profile courant.
  const tiers =
    props.currentAnnuaireTier !== undefined || props.currentSaasTier !== undefined
      ? {
          annuaireTier: props.currentAnnuaireTier ?? null,
          saasTier: props.currentSaasTier ?? null,
        }
      : await loadCurrentTiers()

  const message = getUpgradeMessage({
    annuaireTier: tiers.annuaireTier,
    saasTier: tiers.saasTier,
  })

  if (!message) return null

  // Clé de dismiss : tier courant + tier cible pour resurfacer si l'état change.
  const dismissKey = `kovas_upgrade_banner_dismissed_${message.currentTier}_${message.targetTier}`

  const hasPriceLabel = message.currentTier !== 'none' && message.currentTier !== 'annuaire_free'

  return (
    <BannerDismissShell dismissKey={dismissKey} dismissDurationDays={7}>
      <Card
        variant="flat"
        padding="none"
        className="bg-sage border border-ink/[0.08]"
        aria-label="Suggestion d'upgrade KOVAS"
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 sm:gap-6 p-5 sm:p-6">
          {/* ──────────────── COLONNE GAUCHE : message + bénéfices ──────────── */}
          <div className="space-y-3 sm:space-y-4 min-w-0">
            {/* Eyebrow : tier actuel */}
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-mute">
              Vous utilisez {message.currentTierLabel}
              {hasPriceLabel
                ? ` · ${formatMonthlyPriceShort(getCurrentTierPrice(message.currentTier))}`
                : ''}
            </p>

            {/* Titre dramatisé : nom du tier cible + prix */}
            <h3 className="font-sans text-[20px] sm:text-[22px] font-semibold text-ink leading-tight">
              {message.isMoreValuable ? 'Passez à ' : 'Découvrez '}
              <span className="font-serif italic font-normal">{message.targetTierLabel}</span>{' '}
              <span className="text-ink-mute font-normal">
                ({formatMonthlyPriceShort(message.targetTierPrice)})
              </span>
            </h3>

            <p className="text-[13px] sm:text-[14px] text-ink-mute leading-relaxed">
              {message.tagline}
            </p>

            {/* Bénéfices : 3-5 bullets */}
            <ul className="space-y-1.5 pt-1">
              {message.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-2 text-[13px] text-ink leading-snug"
                >
                  <Check
                    className="size-4 text-ink shrink-0 mt-0.5"
                    aria-hidden
                    strokeWidth={2.5}
                  />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ──────────────── COLONNE DROITE : CTA chartreuse + dismiss ──────── */}
          <div className="flex flex-col gap-2 sm:gap-3 md:items-end md:justify-center md:min-w-[200px]">
            <Button asChild variant="accent" size="default" className="w-full md:w-auto">
              <Link href={message.ctaHref} prefetch={false}>
                Découvrir
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>

            {/* Bouton "Pas maintenant" rendu par le shell (logique client) */}
          </div>
        </div>
      </Card>
    </BannerDismissShell>
  )
}
