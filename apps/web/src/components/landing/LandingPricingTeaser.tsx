import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PRICING_PLANS } from '@/lib/pricing-plans'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

/**
 * Mini-teaser pricing pour la landing — affiche les 5 tiers en mini-grid
 * et redirige vers /pricing pour le détail.
 * Cf. CLAUDE.md §4 — pricing finale 2026-06-02.
 */
export function LandingPricingTeaser() {
  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="muted">Tarification</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            À partir de 19€/mois. Sans surprise. Sans engagement.
          </h2>
          <p className="text-ink-mute">
            5 formules pour s’adapter à votre rythme — du diagnostiqueur qui démarre
            au cabinet en équipe. Toutes les fonctionnalités cœur sont incluses.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {PRICING_PLANS.map((plan) => {
            const euros = Math.floor(plan.monthlyPrice / 100)
            const isFeatured = plan.featured === true
            return (
              <div
                key={plan.code}
                className={`rounded-lg border p-4 text-center space-y-1 ${
                  isFeatured
                    ? 'border-navy/40 bg-navy/[0.04] shadow-accent'
                    : 'border-rule/70 glass-opaque'
                }`}
              >
                <div className="text-[11px] uppercase tracking-wider font-semibold">
                  {plan.name}
                </div>
                <div className="text-2xl font-extrabold tracking-tight">
                  {euros}€
                </div>
                <div className="text-[10px] text-ink-mute">HT/mois</div>
                {isFeatured && (
                  <Badge variant="default" className="text-[9px] py-0">
                    Populaire
                  </Badge>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" variant="outline" asChild>
            <Link href="/pricing">
              Voir le détail des formules <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" asChild>
            <Link href="/signup">Commencer l’essai 14 jours</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
