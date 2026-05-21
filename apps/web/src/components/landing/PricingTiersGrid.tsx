import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PRICING_PLANS, type PricingPlan } from '@/lib/pricing-plans'
import { Check } from 'lucide-react'
import Link from 'next/link'

/**
 * Grille pricing complète (5 tiers) — page /pricing.
 * Source de vérité : `PRICING_PLANS` (lib/pricing-plans.ts).
 * Cf. CLAUDE.md §4 — pricing finale 2026-06-02.
 */
export function PricingTiersGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {PRICING_PLANS.map((plan) => (
        <PricingTierCard key={plan.code} plan={plan} />
      ))}
    </div>
  )
}

function PricingTierCard({ plan }: { plan: PricingPlan }) {
  const monthlyEuros = Math.floor(plan.monthlyPrice / 100)
  const isFeatured = plan.featured === true

  return (
    <Card
      variant="opaque"
      padding="default"
      className={
        isFeatured ? 'border-navy/30 shadow-accent relative' : 'border-rule/70 relative'
      }
    >
      {isFeatured && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 uppercase tracking-wider">
          Populaire
        </Badge>
      )}
      <CardHeader>
        <CardTitle className="text-lg">{plan.name}</CardTitle>
        <CardDescription>{plan.tagline}</CardDescription>
        <div className="pt-3">
          <div className="text-3xl font-extrabold tracking-tight">
            {monthlyEuros}€
            <span className="text-xs font-normal text-ink-mute"> HT/mois</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <ul className="space-y-2 text-xs">
          {plan.features.map((feature) => (
            <li key={feature} className="flex gap-2">
              <Check className="size-3.5 mt-0.5 shrink-0 text-accent-green" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Button
          className="w-full"
          variant={isFeatured ? 'default' : 'glass'}
          size="sm"
          asChild
        >
          <Link href={`/signup?plan=${plan.code}`}>
            {isFeatured ? 'Choisir Pro' : `Choisir ${plan.name}`}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
