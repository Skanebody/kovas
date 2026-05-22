import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import Link from 'next/link'

interface PreviewTier {
  id: string
  name: string
  price: string
  bullets: [string, string, string]
  highlighted?: boolean
  ctaHref: string
}

const TIERS: PreviewTier[] = [
  {
    id: 'essential',
    name: 'Essential',
    price: '19€',
    bullets: ['20 missions/mois', 'Exports universels', 'Support email 48h'],
    ctaHref: '/pricing/checkout?plan=essential&billing=monthly',
  },
  {
    id: 'decouverte',
    name: 'Découverte',
    price: '29€',
    bullets: ['30 missions/mois', 'Saisie vocale incluse', 'Support email 24h'],
    ctaHref: '/pricing/checkout?plan=decouverte&billing=monthly',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '39€',
    bullets: ['80 missions/mois', 'Annuaire public', 'Toutes fonctionnalités'],
    highlighted: true,
    ctaHref: '/pricing/checkout?plan=pro&billing=monthly',
  },
  {
    id: 'all-inclusive',
    name: 'All Inclusive',
    price: '99€',
    bullets: ['200 missions/mois', 'Factur-X intégré', 'Support prioritaire 4h'],
    ctaHref: '/pricing/checkout?plan=all-inclusive&billing=monthly',
  },
  {
    id: 'cabinet',
    name: 'Cabinet',
    price: '149€',
    bullets: ['Missions illimitées', '3 utilisateurs', 'Account manager dédié'],
    ctaHref: '/pricing/checkout?plan=cabinet&billing=monthly',
  },
]

/**
 * Mini-grille 5 tiers preview, lien vers /pricing pour détails complets.
 * B2B only.
 */
export function PricingPreview() {
  return (
    <section id="pricing" className="px-6 py-20 md:py-24 bg-paper">
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-wider text-ink-faint">
            05 · Tarification
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            5 forfaits. Aucune surprise.
          </h2>
          <p className="text-ink-mute leading-relaxed">
            Tous les forfaits incluent : missions illimitées, essai 30 jours avec CB enregistrée
            et débit auto à l&apos;issue, sans engagement.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {TIERS.map((t) => (
            <article
              key={t.id}
              className={cn(
                'rounded-xl border p-5 flex flex-col space-y-4 transition-colors duration-200',
                t.highlighted
                  ? 'border-chartreuse-deep bg-chartreuse-soft/40 shadow-md'
                  : 'border-rule/70 bg-paper hover:border-ink/20',
              )}
            >
              <header className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-bold text-ink">{t.name}</h3>
                  {t.highlighted && (
                    <Sparkles className="size-3.5 text-chartreuse-deep" aria-hidden />
                  )}
                </div>
                <p className="text-2xl font-bold text-ink">
                  {t.price}
                  <span className="text-xs font-medium text-ink-mute"> /mois HT</span>
                </p>
              </header>

              <ul className="space-y-2 flex-1">
                {t.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-xs text-ink-mute">
                    <Check className="size-3.5 text-success shrink-0 mt-0.5" aria-hidden />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <Button
                size="sm"
                variant={t.highlighted ? 'accent' : 'outline'}
                className="w-full"
                asChild
              >
                <Link href={t.ctaHref}>Choisir</Link>
              </Button>
            </article>
          ))}
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
