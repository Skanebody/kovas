import { Button } from '@/components/ui/button'
import { ArrowRight, Camera, FileCheck2, Users2 } from 'lucide-react'
import Link from 'next/link'

const B2B_BULLETS = [
  {
    icon: Camera,
    title: 'Capture mobile IA',
    description:
      'Saisie vocale par pièce, photos géolocalisées, structuration automatique des données terrain.',
  },
  {
    icon: FileCheck2,
    title: 'Pré-vérification ADEME',
    description:
      'Validation cohérence avant export. Les rejets ADEME deviennent l’exception, pas la règle.',
  },
  {
    icon: Users2,
    title: 'Annuaire connecté au calculateur',
    description:
      'Les particuliers qui estiment leur DPE peuvent vous demander un devis en deux clics.',
  },
] as const

const B2B_PARTNERS = [
  { name: 'Stripe' },
  { name: 'Brevo' },
  { name: 'Anthropic' },
  { name: 'Cal.com' },
  { name: 'Supabase' },
] as const

/**
 * Section 3 — B2B strip dark.
 * Fort contraste sage → navy-deep. Promesse 3h/mission + leads qualifiés.
 */
export function B2BStrip() {
  return (
    <section className="bg-navy-deep text-cream py-20 md:py-28 px-4 sm:px-6 md:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl space-y-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Colonne gauche — titre + promesse + CTAs */}
          <div className="space-y-8">
            <h2
              className="font-sans font-medium tracking-tight text-cream leading-[1.05]"
              style={{ fontSize: 'clamp(34px, 5vw, 68px)' }}
            >
              Vous êtes{' '}
              <span className="font-serif italic font-normal text-chartreuse">diagnostiqueur</span>{' '}
              ?
            </h2>
            <p className="text-cream/80 text-lg leading-relaxed max-w-xl">
              L&apos;outil quotidien qui fait gagner 3 heures par mission, sécurise vos exports
              ADEME, et amène des leads qualifiés tous les jours.
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-3 pt-2">
              <Button size="lg" variant="accent" asChild>
                <Link href="/pros/demo">
                  Voir la plateforme en démo <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="bg-transparent text-cream border border-cream/40 hover:bg-cream/10 shadow-none"
              >
                <Link href="/signup">Essai gratuit 30 jours</Link>
              </Button>
            </div>
          </div>

          {/* Colonne droite — 3 bullets */}
          <ul className="space-y-6">
            {B2B_BULLETS.map((b) => (
              <li key={b.title} className="flex items-start gap-4">
                <div className="size-10 rounded-md bg-cream/10 border border-cream/15 flex items-center justify-center text-chartreuse shrink-0">
                  <b.icon className="size-5" aria-hidden />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-cream">{b.title}</h3>
                  <p className="text-sm text-cream/70 leading-relaxed">{b.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Bande logos partenaires — sobre, niveaux de gris (texte mono) */}
        <div className="pt-10 border-t border-cream/10">
          <p className="text-xs font-mono uppercase tracking-wider text-cream/40 mb-6 text-center">
            Stack technique de confiance
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {B2B_PARTNERS.map((p) => (
              <li
                key={p.name}
                className="text-cream/50 font-sans font-semibold text-sm tracking-wide"
              >
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
