import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
// Type B2 dependency — pricing-plans.ts refonte by parallel agent
import { getAnnuairePlan, getLogicielPlan } from '@/lib/pricing-plans'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import Link from 'next/link'

/**
 * Teaser pricing pour la landing diagnostiqueurs (`/pour-les-diagnostiqueurs`).
 *
 * Refonte V3 dual track 2026-05-21 : 2 cards côte-à-côte
 * (Annuaire Pro 19 € + KOVAS 360 Active 59 €) + lien vers `/pricing` détail
 * complet (4 + 5 tiers + bundles + sponsored slot + add-ons).
 */
export function LandingPricingTeaser() {
  const annuairePro = getAnnuairePlan('annuaire_pro')
  const logicielActive = getLogicielPlan('logiciel_active')

  if (!annuairePro || !logicielActive) {
    return null
  }

  const annuaireEuros = Math.round(annuairePro.monthlyPrice / 100)
  const logicielEuros = Math.round(logicielActive.monthlyPrice / 100)

  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="muted">Tarification</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Deux produits. Un prix juste.
          </h2>
          <p className="text-ink-mute">
            Choisissez ce dont vous avez besoin : visibilité B2C avec l'Annuaire, productivité
            terrain avec KOVAS 360, ou les deux en bundle remisé.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <article className="rounded-xl border border-rule/70 glass-opaque p-6 space-y-4">
            <header>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-ink-mute">
                KOVAS Annuaire
              </p>
              <h3 className="text-xl font-bold tracking-tight mt-1">{annuairePro.name}</h3>
            </header>
            <div>
              <p className="text-3xl font-extrabold tracking-tight">
                {annuaireEuros}€
                <span className="text-sm font-medium text-ink-mute"> HT / mois</span>
              </p>
            </div>
            <ul className="space-y-2 text-sm text-ink-mute">
              <li className="flex items-start gap-2">
                <Check className="size-3.5 text-success shrink-0 mt-1" aria-hidden />
                <span>{annuairePro.leadsPerMonth} leads particuliers / mois</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-3.5 text-success shrink-0 mt-1" aria-hidden />
                <span>Fiche premium (photos, services, tarifs indicatifs)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-3.5 text-success shrink-0 mt-1" aria-hidden />
                <span>Analytics fiche + chat sécurisé</span>
              </li>
            </ul>
          </article>

          <article className="rounded-xl border border-chartreuse-deep bg-chartreuse-soft/40 shadow-md p-6 space-y-4">
            <header>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-ink-mute flex items-center gap-1.5">
                KOVAS 360
                <Sparkles className="size-3.5 text-chartreuse-deep" aria-hidden />
              </p>
              <h3 className="text-xl font-bold tracking-tight mt-1">{logicielActive.name}</h3>
            </header>
            <div>
              <p className="text-3xl font-extrabold tracking-tight">
                {logicielEuros}€
                <span className="text-sm font-medium text-ink-mute"> HT / mois</span>
              </p>
            </div>
            <ul className="space-y-2 text-sm text-ink-mute">
              <li className="flex items-start gap-2">
                <Check className="size-3.5 text-success shrink-0 mt-1" aria-hidden />
                <span>{logicielActive.caps.missions} missions / mois (fair-use)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-3.5 text-success shrink-0 mt-1" aria-hidden />
                <span>IA Vision + recommandations post-DPE F/G</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-3.5 text-success shrink-0 mt-1" aria-hidden />
                <span>Exports universels + sync iPad/iPhone/Web</span>
              </li>
            </ul>
          </article>
        </div>

        <div className="text-center text-sm text-ink-mute leading-relaxed max-w-xl mx-auto">
          <strong className="text-ink">Bundle Active Pro</strong> : Annuaire Pro + KOVAS 360
          Active à <strong className="text-ink">69 €/mo</strong> au lieu de 78 € — soit 9 €
          d'économie chaque mois.
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" variant="outline" asChild>
            <Link href="/pricing" aria-label="Voir tous les tarifs KOVAS">
              Voir tous les tarifs <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" asChild>
            <Link href="/signup?plan=logiciel_starter" aria-label="Démarrer l'essai 14 jours">
              Démarrer l'essai 14 jours
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
