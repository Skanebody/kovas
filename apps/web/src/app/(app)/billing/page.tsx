import { ArrowLeft, Check, CreditCard, ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { KOVAS_TIERS } from '@/lib/stripe-config'
import { CheckoutButton } from './checkout-button'

export const metadata: Metadata = { title: 'Abonnement' }

export default async function BillingPage() {
  const { supabase, orgId } = await getCurrentUser()

  const [{ data: subscription }, { count: monthMissions }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('tier, status, missions_included, overage_price_cents, current_period_end, cancel_at_period_end')
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ])

  const isActive = subscription?.status === 'active'
  const currentTier = subscription?.tier

  return (
    <div className="max-w-4xl space-y-8">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/dashboard">
          <ArrowLeft className="size-4" /> Tableau de bord
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Abonnement</h1>
        <p className="text-sm text-muted-foreground">
          {isActive
            ? `Vous êtes sur l'offre ${KOVAS_TIERS.find((t) => t.id === currentTier)?.label ?? currentTier}.`
            : 'Aucun abonnement actif. Choisissez une offre pour activer votre compte.'}
        </p>
      </div>

      {isActive && subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="size-4" />
              Consommation du mois
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <div className="text-3xl font-bold tracking-tight">
                  {monthMissions ?? 0}
                  <span className="text-base font-normal text-muted-foreground">
                    {' '}/ {subscription.missions_included} missions
                  </span>
                </div>
                {(monthMissions ?? 0) > (subscription.missions_included ?? 0) && (
                  <p className="text-sm text-accent-orange mt-1">
                    {(monthMissions ?? 0) - (subscription.missions_included ?? 0)} missions au-delà
                    du forfait · estimation surplus :{' '}
                    {(((monthMissions ?? 0) - (subscription.missions_included ?? 0)) * (subscription.overage_price_cents ?? 0) / 100).toFixed(2)}€
                  </p>
                )}
              </div>
              <Badge variant={subscription.cancel_at_period_end ? 'orange' : 'green'}>
                {subscription.cancel_at_period_end ? 'Annulation en cours' : 'Actif'}
              </Badge>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-cta transition-all"
                style={{
                  width: `${Math.min(((monthMissions ?? 0) / (subscription.missions_included || 1)) * 100, 100)}%`,
                }}
              />
            </div>
            <PortalButton />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {KOVAS_TIERS.map((tier) => {
          const isCurrent = isActive && currentTier === tier.id
          return (
            <Card
              key={tier.id}
              className={tier.recommended ? 'border-foreground/40 shadow-md relative' : ''}
            >
              {tier.recommended && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Recommandé</Badge>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{tier.label}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="pt-4">
                  <div className="text-3xl font-bold tracking-tight">
                    {tier.priceMonthlyCents / 100}€
                  </div>
                  <div className="text-sm text-muted-foreground">HT / mois</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <Check className="size-4 mt-0.5 shrink-0" />
                    <span>{tier.missionsIncluded} missions / mois</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="size-4 mt-0.5 shrink-0" />
                    <span>Surplus : {(tier.overagePriceCents / 100).toFixed(2)}€/mission</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="size-4 mt-0.5 shrink-0" />
                    <span>{tier.storageGb} Go de stockage</span>
                  </li>
                </ul>
                {isCurrent ? (
                  <Badge variant="green" className="w-full justify-center py-2">
                    Votre offre
                  </Badge>
                ) : (
                  <CheckoutButton tier={tier.id} label={tier.label} />
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-subtle-foreground text-center">
        Annuel : 2 mois offerts (10 mois payés sur 12). Sans engagement. Plafond mensuel
        auto-protecteur activable depuis votre Stripe Portal.
      </p>
    </div>
  )
}

function PortalButton() {
  return (
    <form action="/api/billing/portal" method="POST">
      <Button type="submit" variant="outline" size="sm">
        <ExternalLink className="size-4" /> Gérer mon abonnement
      </Button>
    </form>
  )
}
