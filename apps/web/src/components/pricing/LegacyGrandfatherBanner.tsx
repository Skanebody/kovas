'use client'

// Type B2 dependency — pricing-plans.ts refonte by parallel agent
import {
  type LegacyPlanCode,
  type LogicielPlanCode,
  getLegacyPlanMapping,
  getLogicielPlan,
} from '@/lib/pricing-plans'
import { cn } from '@/lib/utils'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

interface LegacyGrandfatherBannerProps {
  /**
   * Code du plan E2c hérité par l'utilisateur connecté. Quand `null` (visiteur
   * anonyme ou compte sans plan legacy), le composant ne rend rien.
   */
  legacyPlanCode: LegacyPlanCode | null
}

/**
 * Bannière "Client historique" — affichée uniquement si l'utilisateur connecté
 * a un plan E2c grandfathered (cf. spec §6).
 *
 * - Rappelle que le prix actuel est verrouillé à vie
 * - Propose un calcul d'économies estimées si bascule vers nouvelle grille V3
 * - CTA "Comparer mes options" → page de simulation
 *
 * En l'absence de prop ou en SSR sans contexte auth, retourne `null`.
 */
export function LegacyGrandfatherBanner({ legacyPlanCode }: LegacyGrandfatherBannerProps) {
  if (legacyPlanCode === null) return null

  const mapping = getLegacyPlanMapping(legacyPlanCode)
  if (!mapping) return null

  const newPlan = getLogicielPlan(mapping.suggestedNewPlanCode as LogicielPlanCode)
  if (!newPlan) return null

  const grandfatherEuros = Math.round(mapping.grandfatherMonthlyPriceCents / 100)
  const newPlanEuros = Math.round(newPlan.monthlyPrice / 100)
  const monthlyDelta = newPlanEuros - grandfatherEuros

  return (
    <section
      aria-label="Bannière client historique"
      className={cn(
        'bg-[#0F1419] text-white rounded-[24px] p-6 sm:p-8',
        'grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6 items-center',
      )}
    >
      <div>
        <div className="inline-flex items-center gap-2 bg-chartreuse/15 text-chartreuse font-mono text-[11px] uppercase tracking-[0.16em] font-semibold px-3 py-1.5 rounded-full mb-4">
          <ShieldCheck aria-hidden className="size-3.5" />
          Client historique
        </div>
        <h3 className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em] leading-tight mb-3">
          Votre prix est verrouillé à vie : {grandfatherEuros} € HT / mois.
        </h3>
        <p className="text-[14px] text-white/90 leading-relaxed">
          Vous êtes sur le forfait <strong>{mapping.legacyDisplayName}</strong> de la grille E2c
          (juin 2026). Vous gardez ce prix tant que votre abonnement reste actif, même quand la
          grille V3 augmente.
        </p>
      </div>

      <div className="bg-white/[0.06] rounded-[16px] p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/72 font-semibold mb-3">
          Si vous basculiez sur la nouvelle grille
        </p>
        <ul className="space-y-2 text-[13px] mb-4">
          <li className="flex items-baseline justify-between gap-3">
            <span className="text-white/72">Forfait équivalent</span>
            <span className="font-semibold tabular-nums">{newPlan.name}</span>
          </li>
          <li className="flex items-baseline justify-between gap-3">
            <span className="text-white/72">Prix V3</span>
            <span className="font-semibold tabular-nums">{newPlanEuros} € HT / mois</span>
          </li>
          <li className="flex items-baseline justify-between gap-3 border-t border-white/15 pt-2">
            <span className="text-white/72">Écart mensuel</span>
            <span
              className={cn(
                'font-semibold tabular-nums',
                monthlyDelta > 0 ? 'text-chartreuse' : 'text-white/90',
              )}
            >
              {monthlyDelta > 0
                ? `+ ${monthlyDelta} €`
                : monthlyDelta < 0
                  ? `− ${Math.abs(monthlyDelta)} €`
                  : 'identique'}
            </span>
          </li>
        </ul>
        <Link
          href="/dashboard/account/billing/migration"
          aria-label="Comparer mes options de migration grille V3"
          className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-[12px] text-[13px] font-semibold bg-chartreuse text-[#0F1419] hover:bg-chartreuse-deep transition-colors"
        >
          Comparer mes options
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  )
}
