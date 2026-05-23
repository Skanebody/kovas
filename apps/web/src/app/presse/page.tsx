import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  MARKET_STATS,
  PRESS_CONTACT,
  PRESS_RELEASES,
  SECTOR_MEDIA,
} from '@/lib/institutional/press-mentions'
import { KOVAS_SITE_URL, buildMetadata } from '@/lib/seo/metadata'
import { ArrowDownToLine, ArrowUpRight, Mail, Phone } from 'lucide-react'
import Script from 'next/script'

export const metadata = buildMetadata({
  title: 'Espace presse',
  description:
    'Communiqués de presse, kit médias téléchargeable, statistiques marché du diagnostic immobilier français et contacts journalistes KOVAS.',
  path: '/presse',
})

function buildPressJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': PRESS_RELEASES.filter((p) => p.status === 'published').map((release) => ({
      '@type': 'NewsArticle',
      headline: release.title,
      datePublished: release.date,
      description: release.excerpt,
      url: `${KOVAS_SITE_URL}/presse#${release.id}`,
      publisher: {
        '@type': 'Organization',
        name: 'KOVAS',
        url: KOVAS_SITE_URL,
      },
    })),
  }
}

function formatDateFr(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function PressePage() {
  const jsonLd = buildPressJsonLd()
  const hasJsonLd = (jsonLd['@graph'] as unknown[]).length > 0

  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      {hasJsonLd ? (
        <Script
          id="presse-jsonld"
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON-LD
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}

      <PublicHeader />

      <main className="flex-1">
        {/* HERO */}
        <section className="px-5 sm:px-12 pt-16 sm:pt-24 pb-12 sm:pb-20 animate-fade-in motion-reduce:animate-none">
          <div className="max-w-[1240px] mx-auto">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-6">
              Espace presse
            </p>
            <h1
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05] max-w-3xl"
              style={{ fontSize: 'clamp(40px, 6vw, 88px)' }}
            >
              <span className="font-serif italic font-normal">Espace</span> presse.
            </h1>
            <p className="mt-8 max-w-2xl text-base sm:text-lg text-[#0F1419]/72 leading-relaxed">
              Communiqués, kit médias, statistiques marché et contact direct. Tout ce dont vous avez
              besoin pour parler de KOVAS et du marché du diagnostic immobilier français.
            </p>
          </div>
        </section>

        {/* COMMUNIQUÉS */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto space-y-10">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Communiqués
              </p>
              <h2 className="font-sans font-medium tracking-tight text-3xl sm:text-4xl text-[#0F1419] leading-tight">
                Annonces officielles.
              </h2>
            </div>
            <div className="grid gap-5">
              {PRESS_RELEASES.map((release) => (
                <Card
                  key={release.id}
                  id={release.id}
                  variant="opaque"
                  padding="default"
                  className="space-y-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="text-xs font-mono uppercase tracking-wider text-[#0F1419]/55">
                      {formatDateFr(release.date)}
                    </p>
                    {release.status === 'placeholder' ? (
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[#0F1419]/55 border border-[#0F1419]/[0.12] rounded-pill px-3 py-1">
                        À venir
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-xl font-semibold text-[#0F1419] leading-snug">
                    {release.title}
                  </h3>
                  <p className="text-sm text-[#0F1419]/72 leading-relaxed">{release.excerpt}</p>
                  {release.pdfPath ? (
                    <div>
                      <Button asChild variant="ghost" size="sm">
                        <a href={release.pdfPath} target="_blank" rel="noreferrer noopener">
                          Télécharger le PDF <ArrowDownToLine className="size-4" />
                        </a>
                      </Button>
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* KIT MÉDIAS */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div>
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Kit médias
              </p>
            </div>
            <div className="space-y-6 max-w-3xl">
              <h2 className="font-sans font-medium tracking-tight text-3xl sm:text-4xl text-[#0F1419] leading-tight">
                Tous nos visuels et documents en un téléchargement.
              </h2>
              <p className="text-[#0F1419]/72 leading-relaxed">
                Le kit médias regroupe les logos KOVAS en haute définition (SVG, PNG, WEBP), la
                photo officielle du fondateur, la fiche société, les statistiques marché et la
                charte graphique. Format ZIP, environ 15 Mo.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild variant="accent" size="lg">
                  <a href="/presse/kit-medias" download>
                    Télécharger le kit médias (ZIP 15 Mo) <ArrowDownToLine className="size-4" />
                  </a>
                </Button>
                <p className="text-xs text-[#0F1419]/55">
                  Le kit complet sera disponible au moment du lancement public (T4 2026).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* STATS MARCHÉ */}
        <section className="px-5 sm:px-12 py-16 sm:py-24 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto space-y-12">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Statistiques marché
              </p>
              <h2 className="font-sans font-medium tracking-tight text-3xl sm:text-4xl text-[#0F1419] leading-tight">
                Trois chiffres clés pour comprendre le secteur.
              </h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-10">
              {MARKET_STATS.map((stat) => (
                <div key={stat.id} className="space-y-3">
                  <p
                    className="font-serif italic font-normal text-[#0F1419] leading-none"
                    style={{ fontSize: 'clamp(56px, 6vw, 100px)' }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-sm font-medium text-[#0F1419]/80 leading-snug">{stat.label}</p>
                  <p className="text-[11px] text-[#0F1419]/55 italic">{stat.source}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MÉDIAS SECTEUR DIAGNOSTIC */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]">
          <div className="max-w-[1240px] mx-auto space-y-10">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Médias suivant le secteur
              </p>
              <h2 className="font-sans font-medium tracking-tight text-3xl sm:text-4xl text-[#0F1419] leading-tight">
                Ils couvrent l&apos;actualité du diagnostic immobilier.
              </h2>
              <p className="text-sm text-[#0F1419]/55 italic">
                Six supports spécialisés que nous suivons quotidiennement pour rester en veille
                réglementaire et métier. Chaque carte renvoie vers le site éditeur.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SECTOR_MEDIA.map((media) => (
                <a
                  key={media.id}
                  href={media.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col gap-4 rounded-2xl border border-[#0F1419]/[0.08] bg-paper p-5 hover:border-[#0F1419]/40 hover:shadow-glass-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <img
                      src={media.logoPath}
                      alt={`Logo ${media.name}`}
                      width={200}
                      height={80}
                      className="h-14 w-auto max-w-[200px] object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                    <ArrowUpRight
                      className="size-4 text-[#0F1419]/40 group-hover:text-[#0F1419] transition-colors mt-1"
                      aria-hidden
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-mono uppercase tracking-wider text-[10px] text-[#0F1419]/55">
                      {media.frequency}
                    </p>
                    <p className="text-sm text-[#0F1419]/72 leading-snug">{media.editorialAngle}</p>
                  </div>
                  <p className="mt-auto font-mono text-[10px] text-[#0F1419]/45 break-all">
                    {new URL(media.url).hostname.replace(/^www\./, '')}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* CONTACT PRESSE */}
        <section className="px-5 sm:px-12 py-16 sm:py-24 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div>
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Contact presse
              </p>
            </div>
            <div className="space-y-6 max-w-2xl">
              <h2 className="font-sans font-medium tracking-tight text-3xl sm:text-4xl text-[#0F1419] leading-tight">
                Un contact direct pour les journalistes.
              </h2>
              <p className="text-[#0F1419]/72 leading-relaxed">
                {PRESS_CONTACT.contactName} ({PRESS_CONTACT.role}) répond personnellement aux
                sollicitations presse sous vingt-quatre heures ouvrées.
              </p>
              <div className="space-y-3">
                <a
                  href={`mailto:${PRESS_CONTACT.email}`}
                  className="flex items-center gap-3 text-base text-[#0F1419] hover:underline underline-offset-4"
                >
                  <Mail className="size-4 text-[#0F1419]/55" />
                  {PRESS_CONTACT.email}
                </a>
                <div className="flex items-center gap-3 text-base text-[#0F1419]/72">
                  <Phone className="size-4 text-[#0F1419]/55" />
                  {PRESS_CONTACT.phone}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
