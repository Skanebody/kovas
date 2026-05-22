import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { B2BStrip } from '@/components/public/landing/B2BStrip'
import { B2CStrip } from '@/components/public/landing/B2CStrip'
import { HeroHome } from '@/components/public/landing/HeroHome'
import { ObservatoryTeaser } from '@/components/public/landing/ObservatoryTeaser'
import { SocialProof } from '@/components/public/landing/SocialProof'
import { Button } from '@/components/ui/button'
import { getPublicStats } from '@/lib/public-stats'
import { buildMetadata } from '@/lib/seo/metadata'
import Link from 'next/link'

export const metadata = buildMetadata({
  title: 'KOVAS — Diagnostic immobilier IA-first',
  description:
    'Logiciel SaaS B2B pour diagnostiqueurs immobiliers indépendants. Saisie vocale terrain, photos géolocalisées, exports universels. 1h30 gagnée par mission DPE.',
  path: '/',
})

/**
 * KOVAS — Homepage marketing kovas.fr/
 * Lot #141 SITE-HOME · Refonte 5 sections + footer 6 colonnes (brand V5 strict).
 * Avatar client : diagnostiqueur 43 ans, ex-cadre. Ton SOBRE PROFESSIONNEL.
 */
export default async function HomePage() {
  const stats = await getPublicStats()

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PublicHeader />
      <main className="flex-1">
        <HeroHome stats={stats} />
        <B2CStrip />
        <B2BStrip />
        <ObservatoryTeaser />
        <SocialProof />
      </main>
      <SiteFooter />
    </div>
  )
}

/**
 * Header public marketing — sticky, transparent sur background sage, glass léger au scroll.
 * Toggle B2C ↔ B2B simple via deux liens nav.
 */
function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-rule/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 lg:px-12 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="size-8 rounded-md bg-ink" aria-hidden />
          <span className="text-base font-bold tracking-tight text-ink">KOVAS</span>
        </Link>
        <nav
          className="hidden md:flex items-center gap-7 text-sm"
          aria-label="Navigation principale"
        >
          <Link
            href="/calculateur-dpe-gratuit"
            className="text-ink-mute hover:text-ink transition-colors"
          >
            Calculateur DPE
          </Link>
          <Link href="/diagnostiqueurs" className="text-ink-mute hover:text-ink transition-colors">
            Annuaire
          </Link>
          <Link href="/observatoire" className="text-ink-mute hover:text-ink transition-colors">
            Observatoire
          </Link>
          <Link href="/pros" className="text-ink-mute hover:text-ink transition-colors">
            Pour diagnostiqueurs
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Se connecter</Link>
          </Button>
          <Button size="sm" variant="accent" asChild>
            <Link href="/signup">Essai 30j</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
