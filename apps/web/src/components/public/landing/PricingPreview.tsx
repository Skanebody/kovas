import { Button } from '@/components/ui/button'
import { LOGICIEL_PLANS, UNLIMITED_CAP } from '@/lib/pricing-plans'
import { cn } from '@/lib/utils'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import Link from 'next/link'

/**
 * Mini-grille preview tarifs B2B (utilisé sur /pour-les-diagnostiqueurs).
 *
 * SOURCE DE VÉRITÉ : `lib/pricing-plans.ts` (LOGICIEL_PLANS).
 * Affiche les 4 tiers payants V4 (Solo Light 29 / Solo Pro 59 / Cabinet 149 /
 * Cabinet+ 299) — on exclut le code `essai` (mode trial des autres tiers).
 *
 * Audit FIX-SS (2026-05-23) : suppression des 5 anciens tiers E2c
 * (Essential 19, Découverte 29, Pro 39, All Inclusive 99, Cabinet 149).
 */

interface PreviewBullet {
  text: string
}

function buildBullets(plan: (typeof LOGICIEL_PLANS)[number]): readonly PreviewBullet[] {
  const isUnlimited = plan.caps.missions >= UNLIMITED_CAP
  const missionsLabel = isUnlimited
    ? 'Missions illimitées (fair-use)'
    : `${plan.caps.missions} missions / mois`
  const usersLabel =
    plan.caps.users === 1 ? '1 utilisateur' : `Jusqu'à ${plan.caps.users} utilisateurs`
  const storageLabel = `${plan.caps.storageGb} Go de stockage`

  return [{ text: missionsLabel }, { text: usersLabel }, { text: storageLabel }]
}

const PAID_TIERS = LOGICIEL_PLANS.filter((p) => p.code !== 'essai')

export function PricingPreview() {
  return (
    <section id="pricing" className="px-6 py-20 md:py-24 bg-paper">
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-wider text-ink-faint">
            05 · Tarification
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            4 forfaits. Aucune surprise.
          </h2>
          <p className="text-ink-mute leading-relaxed">
            Toutes les fonctionnalités dans tous les tiers. Essai 30 jours avec CB enregistrée et
            débit auto à l&apos;issue, sans engagement.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PAID_TIERS.map((tier) => {
            const priceEuros = Math.round(tier.monthlyPrice / 100)
            const bullets = buildBullets(tier)
            const ctaHref = `/pricing/checkout?plan=${tier.code}&billing=monthly`
            return (
              <article
                key={tier.code}
                className={cn(
                  'rounded-xl border p-5 flex flex-col space-y-4 transition-colors duration-200',
                  tier.featured
                    ? 'border-chartreuse-deep bg-chartreuse-soft/40 shadow-md'
                    : 'border-rule/70 bg-paper hover:border-ink/20',
                )}
              >
                <header className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-base font-bold text-ink">{tier.name}</h3>
                    {tier.featured && (
                      <Sparkles className="size-3.5 text-chartreuse-deep" aria-hidden />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-ink">
                    {priceEuros}€
                    <span className="text-xs font-medium text-ink-mute"> /mois HT</span>
                  </p>
                </header>

                <ul className="space-y-2 flex-1">
                  {bullets.map((b) => (
                    <li key={b.text} className="flex items-start gap-2 text-xs text-ink-mute">
                      <Check className="size-3.5 text-success shrink-0 mt-0.5" aria-hidden />
                      <span>{b.text}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  size="sm"
                  variant={tier.featured ? 'accent' : 'outline'}
                  className="w-full"
                  asChild
                >
                  <Link href={ctaHref}>Choisir</Link>
                </Button>
              </article>
            )
          })}
        </div>

        <div className="text-center">
          <Button variant="ghost" asChild>
            <Link href="/pricing">
              Voir tous les détails
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
