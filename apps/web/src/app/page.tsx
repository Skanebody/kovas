import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { B2BStrip } from '@/components/public/landing/B2BStrip'
import { B2CStrip } from '@/components/public/landing/B2CStrip'
import { HeroHome } from '@/components/public/landing/HeroHome'
import { ObservatoryTeaser } from '@/components/public/landing/ObservatoryTeaser'
import { SocialProof } from '@/components/public/landing/SocialProof'
import { getPublicStats } from '@/lib/public-stats'
import { buildMetadata } from '@/lib/seo/metadata'

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

