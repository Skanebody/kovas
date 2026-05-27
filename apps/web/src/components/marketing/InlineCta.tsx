/**
 * InlineCta — Bloc CTA inline placé entre 2 sections de la homepage.
 *
 * Stratégie Tugan Bara / Joanna Wiebe / Oli Gardner (consensus expert) :
 *   - Placer des CTAs aux pics psychologiques (rationnel / émotionnel)
 *   - Single primary action : tous pointent vers /signup ou /signup/qualify
 *   - Secondaire vers /tarifs pour les indécis qui veulent comparer
 *   - Attention Ratio respecté (1 action dominante par bloc)
 *
 * Visibilité support-aware (cf. demande Benjamin 2026-05-27) :
 *   - `desktopOnly` : visible >= lg (CTAs inline aux pics rationnel/émotionnel)
 *   - `mobileOnly`  : visible < lg (1 seul CTA inline mobile, le reste passe
 *     par la sticky bar)
 *   - `all` (défaut) : visible partout
 *
 * Variants éditoriaux (ton avatar SOBRE PROFESSIONNEL + tutoiement) :
 *   - `rational`  : après pic rationnel (post-éco, post-pricing) — copy chiffré
 *   - `emotional` : après pic émotionnel (post-lettre fondateur) — copy humain
 *   - `pricing`   : après pricing teaser — primary "Voir tarifs" inversé
 */

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

type Variant = 'rational' | 'emotional' | 'pricing'
type Visibility = 'desktopOnly' | 'mobileOnly' | 'all'

interface InlineCtaProps {
  variant: Variant
  visibility?: Visibility
}

const COPY: Record<
  Variant,
  {
    title: React.ReactNode
    sub: string
    primary: string
    primaryHref: string
    secondary: string
    secondaryHref: string
  }
> = {
  rational: {
    title: (
      <>
        Récupère <span className="font-serif italic font-normal">35 minutes</span> par mission.
      </>
    ),
    sub: 'Essai 30 jours · 0 € débité avant J+30 · résiliation libre',
    primary: 'Démarrer mon essai',
    primaryHref: '/signup/qualify',
    secondary: 'Voir tous les tarifs',
    secondaryHref: '/tarifs',
  },
  emotional: {
    title: (
      <>
        Tu peux rentrer chez toi à <span className="font-serif italic font-normal">17 h</span>.
      </>
    ),
    sub: 'Si la lettre de Benjamin t’a parlé, teste KOVAS 30 jours. Tu peux arrêter en 2 clics.',
    primary: 'Démarrer mon essai',
    primaryHref: '/signup/qualify',
    secondary: 'Lire la garantie 60 jours',
    secondaryHref: '/garantie',
  },
  pricing: {
    title: (
      <>
        Le bon plan dépend de ton <span className="font-serif italic font-normal">volume</span>.
      </>
    ),
    sub: 'Compare les 4 tiers et bundles · essai 30 jours sur tous les plans',
    primary: 'Voir tous les tarifs',
    primaryHref: '/tarifs',
    secondary: 'Démarrer mon essai',
    secondaryHref: '/signup/qualify',
  },
}

const VISIBILITY_CLASS: Record<Visibility, string> = {
  desktopOnly: 'hidden lg:block',
  mobileOnly: 'lg:hidden',
  all: '',
}

export function InlineCta({ variant, visibility = 'all' }: InlineCtaProps): React.ReactElement {
  const copy = COPY[variant]
  const isPricingVariant = variant === 'pricing'

  return (
    <section
      className={`${VISIBILITY_CLASS[visibility]} px-5 sm:px-12 py-14 sm:py-16 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60`}
    >
      <div className="max-w-[920px] mx-auto text-center space-y-6">
        <h2
          className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.1]"
          style={{ fontSize: 'clamp(28px, 3.6vw, 48px)' }}
        >
          {copy.title}
        </h2>
        <p className="text-[15px] sm:text-base text-[#0F1419]/68 max-w-xl mx-auto">{copy.sub}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button asChild variant={isPricingVariant ? 'default' : 'accent'} size="lg">
            <Link href={copy.primaryHref}>
              {copy.primary}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={copy.secondaryHref}>{copy.secondary}</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
