import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { getCurrentUser } from '@/lib/auth/current-user'
import { KOVAS_TIERS } from '@/lib/stripe-config'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Building2,
  Check,
  CreditCard,
  ExternalLink,
  Sparkles,
  User,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckoutButton } from './checkout-button'
import { CompanyForm } from './company-form'
import { ProfileForm } from './profile-form'

export const metadata: Metadata = { title: 'Mon compte' }

function eurosCents(cents: number) {
  return (cents / 100).toFixed(2)
}

export default async function AccountPage() {
  const { supabase, orgId, profile } = await getCurrentUser()

  const [{ data: subscription }, { count: monthMissions }, { data: organization }] =
    await Promise.all([
      supabase
        .from('subscriptions')
        .select(
          'tier, status, missions_included, overage_price_cents, current_period_end, cancel_at_period_end',
        )
        .eq('organization_id', orgId)
        .maybeSingle(),
      supabase
        .from('missions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .gte(
          'created_at',
          new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        ),
      supabase
        .from('organizations')
        .select('name, siret, vat_number, address, postal_code, city, certification_n')
        .eq('id', orgId)
        .maybeSingle(),
    ])

  const isActive = subscription?.status === 'active'
  const currentTier = subscription?.tier
  const tier = currentTier ? KOVAS_TIERS.find((t) => t.id === currentTier) : null
  const missionsCount = monthMissions ?? 0
  const overage = Math.max(0, missionsCount - (subscription?.missions_included ?? 0))
  const overagePrice = subscription?.overage_price_cents ?? 0
  const overageTotal = (overage * overagePrice) / 100
  const usagePct =
    subscription && subscription.missions_included
      ? Math.min((missionsCount / subscription.missions_included) * 100, 100)
      : 0

  return (
    <div className="max-w-3xl space-y-8">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/dashboard">
          <ArrowLeft className="size-4" /> Tableau de bord
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Mon compte</h1>
        <p className="text-sm text-muted-foreground">
          Profil, apparence, abonnement, facturation et informations légales.
        </p>
      </div>

      {/* PROFIL — ouvert par défaut (frequent) */}
      <CollapsibleSection
        storageKey="kovas_account_profile"
        defaultExpanded
        title={
          <>
            <User className="size-4" /> Profil
          </>
        }
      >
        <ProfileForm
          initial={{
            full_name: profile.full_name,
            email: profile.email,
            phone: profile.phone ?? null,
          }}
        />
      </CollapsibleSection>

      {/* ENTREPRISE — ouvert par défaut (V1 setup) */}
      <CollapsibleSection
        storageKey="kovas_account_company"
        defaultExpanded
        title={
          <>
            <Building2 className="size-4" /> Mon entreprise
          </>
        }
      >
        <p className="text-xs text-muted-foreground pb-3">
          Ces informations apparaissent sur vos exports et en-têtes de rapports.
        </p>
        <CompanyForm
          initial={{
            name: organization?.name ?? null,
            siret: organization?.siret ?? null,
            vat_number: organization?.vat_number ?? null,
            address: organization?.address ?? null,
            postal_code: organization?.postal_code ?? null,
            city: organization?.city ?? null,
            certification_n: organization?.certification_n ?? null,
          }}
        />
      </CollapsibleSection>

      {/* ABONNEMENT — ouvert par défaut (usage du mois pertinent) */}
      <CollapsibleSection
        storageKey="kovas_account_subscription"
        defaultExpanded
        title={
          <>
            <Sparkles className="size-4" /> Abonnement
          </>
        }
      >
        <div className="space-y-4">
          {isActive && subscription ? (
            <>
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Formule actuelle
                  </div>
                  <div className="text-2xl font-bold tracking-tight">
                    {tier?.label ?? currentTier}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tier
                      ? `${eurosCents(tier.priceMonthlyCents)}€ HT/mois · ${tier.missionsIncluded} missions incluses`
                      : ''}
                  </div>
                </div>
                <Badge variant={subscription.cancel_at_period_end ? 'orange' : 'green'}>
                  {subscription.cancel_at_period_end ? 'Annulation en cours' : 'Actif'}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">
                    {missionsCount}
                    <span className="text-muted-foreground">
                      {' '}
                      / {subscription.missions_included} missions ce mois
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {Math.round(usagePct)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all',
                      usagePct >= 100 ? 'bg-accent-orange' : 'bg-cta',
                    )}
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
              </div>

              {overage > 0 && (
                <div className="rounded-lg border border-accent-orange/30 bg-accent-orange/5 p-3 space-y-1">
                  <p className="text-sm font-medium text-accent-orange">
                    {overage} mission{overage > 1 ? 's' : ''} au-delà du forfait
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Surplus estimé : {overageTotal.toFixed(2)}€ HT · facturé en fin de cycle. Aucune
                    rupture de service.
                  </p>
                </div>
              )}

              <PortalButton />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun abonnement actif. Choisissez une offre ci-dessous pour activer votre compte.
            </p>
          )}
        </div>
      </CollapsibleSection>

      {/* PLANS COMPARISON — ouvert si pas d'abonnement actif (subscribe flow),
          fermé sinon (action peu fréquente quand abonnement déjà actif) */}
      <CollapsibleSection
        storageKey="kovas_account_plans"
        defaultExpanded={!isActive}
        title={
          <>
            <CreditCard className="size-4" /> Changer de formule
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {KOVAS_TIERS.map((t) => {
              const isCurrent = isActive && currentTier === t.id
              return (
                <div
                  key={t.id}
                  className={cn(
                    'rounded-lg border p-4 space-y-3',
                    isCurrent ? 'border-cta/40 bg-cta/[0.04]' : 'border-cta/10 bg-card/60',
                    t.recommended && !isCurrent && 'border-cta/20',
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs uppercase tracking-wider font-semibold">
                        {t.label}
                      </span>
                      {t.recommended && (
                        <Badge variant="muted" className="text-[10px] py-0">
                          Recommandé
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="green" className="text-[10px] py-0">
                          Actuelle
                        </Badge>
                      )}
                    </div>
                    <div className="text-2xl font-extrabold tracking-tight">
                      {eurosCents(t.priceMonthlyCents)}€
                      <span className="text-xs font-normal text-muted-foreground"> HT/mois</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    <li className="flex items-start gap-2">
                      <Check className="size-3.5 mt-0.5 shrink-0 text-accent-green" />
                      <span>{t.missionsIncluded} missions incluses / mois</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="size-3.5 mt-0.5 shrink-0 text-accent-green" />
                      <span>Surplus {eurosCents(t.overagePriceCents)}€ HT / mission au-delà</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="size-3.5 mt-0.5 shrink-0 text-accent-green" />
                      <span>{t.storageGb} Go de stockage</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="size-3.5 mt-0.5 shrink-0 text-accent-green" />
                      <span>Toutes les fonctionnalités KOVAS</span>
                    </li>
                  </ul>
                  {!isCurrent && <CheckoutButton tier={t.id} label={t.label} />}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Annuel : 2 mois offerts (10 mois payés sur 12). Sans engagement. Plafond mensuel
            auto-protecteur activable depuis le portail Stripe.
          </p>
        </div>
      </CollapsibleSection>

      {/* INFORMATIONS LÉGALES KOVAS — fermé par défaut (référence statique) */}
      <CollapsibleSection storageKey="kovas_account_legal" title={<>Informations légales KOVAS</>}>
        <div className="space-y-2 text-sm">
          <Row label="Éditeur">SASU Nexus 1993</Row>
          <Row label="Siège social">66 Av Champs Élysées, 75008 Paris</Row>
          <Row label="SIREN">982 786 154</Row>
          <Row label="Domaine">kovas.fr</Row>
          <p className="text-xs text-muted-foreground pt-2">
            Vos factures KOVAS sont émises HT avec TVA 20% en sus, déductible si vous êtes
            assujetti.
          </p>
        </div>
      </CollapsibleSection>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap">
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
        {label}
      </span>
      <span className="text-foreground">{children}</span>
    </div>
  )
}

function PortalButton() {
  return (
    <form action="/api/billing/portal" method="POST">
      <Button type="submit" variant="outline" size="sm">
        <ExternalLink className="size-4" /> Gérer factures et paiement (Stripe)
      </Button>
    </form>
  )
}
