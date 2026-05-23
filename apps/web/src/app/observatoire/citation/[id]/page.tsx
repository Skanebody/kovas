/**
 * /observatoire/citation/[id] — Page publique d'une citation presse.
 *
 * FIX-E (2026-05-24) : page interne accessible depuis la section "Des données
 * reprises par la presse nationale" de /observatoire. Affiche l'extrait cité
 * intégral + lien article original + bouton "Vérifier la source".
 *
 * Le bouton "Vérifier la source" pointe vers `/admin/observatoire/citations/[id]`
 * pour les admins (page protégée par le middleware admin). Pour les non-admins,
 * il pointe vers l'article original (proxy de confiance).
 *
 * RLS : seules les citations `status = 'verified'` sont exposées publiquement.
 * Une citation `pending_review` ou `rejected` renvoie un 404 ici.
 */

import { SiteFooter } from '@/components/site-footer'
import { Button } from '@/components/ui/button'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { PRESS_MENTIONS } from '@/lib/institutional/press-mentions'
import { getPublicPressCitation } from '@/lib/observatoire/press-citations'
import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

const KOVAS_BASE_URL = 'https://kovas.fr'

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const citation = await getPublicPressCitation(id)
  if (!citation) {
    return {
      title: 'Citation introuvable · Observatoire KOVAS',
      robots: { index: false, follow: false },
    }
  }
  const media = PRESS_MENTIONS.find((m) => m.id === citation.mediaSlug)
  const mediaName = media?.name ?? citation.mediaSlug
  return {
    title: `${citation.articleTitle} · ${mediaName} · Observatoire KOVAS`,
    description: citation.quoteExcerpt.slice(0, 160),
    alternates: { canonical: `${KOVAS_BASE_URL}/observatoire/citation/${citation.id}` },
    openGraph: {
      type: 'article',
      locale: 'fr_FR',
      url: `${KOVAS_BASE_URL}/observatoire/citation/${citation.id}`,
      siteName: 'KOVAS',
      title: `${citation.articleTitle} · ${mediaName}`,
      description: citation.quoteExcerpt.slice(0, 200),
      publishedTime: citation.publishedAt,
    },
  }
}

export default async function PressCitationPage({ params }: PageProps) {
  const { id } = await params
  const citation = await getPublicPressCitation(id)
  if (!citation) notFound()

  // Côté navigation, vérification admin pour brancher le bouton "Vérifier la
  // source" vers l'écran de modération ou vers l'article original.
  const adminAccess = await verifyAdminAccess()
  const isAdmin = adminAccess.isAdmin && !adminAccess.needs2FA && !adminAccess.hasNoSecret

  const media = PRESS_MENTIONS.find((m) => m.id === citation.mediaSlug)
  const mediaName = media?.name ?? citation.mediaSlug
  const logoPath = media?.logoPath ?? null

  const publishedLabel = new Date(citation.publishedAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // JSON-LD ClaimReview pour aider à signaler le rôle de référence presse.
  const claimSchema = {
    '@context': 'https://schema.org',
    '@type': 'Quotation',
    spokenByCharacter: { '@type': 'Organization', name: mediaName },
    text: citation.quoteExcerpt,
    citation: citation.articleUrl,
    inLanguage: 'fr-FR',
    isBasedOn: {
      '@type': 'NewsArticle',
      headline: citation.articleTitle,
      url: citation.articleUrl,
      datePublished: citation.publishedAt,
      publisher: { '@type': 'Organization', name: mediaName },
    },
  }

  return (
    <div className="min-h-dvh flex flex-col bg-sage text-ink font-sans">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD inline standard pratique
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(claimSchema).replace(/</g, '\\u003c'),
        }}
      />

      <main className="flex-1">
        <section className="bg-paper border-b border-rule/40">
          <div className="max-w-[860px] mx-auto px-6 pt-16 sm:pt-20 pb-12">
            <Link
              href="/observatoire"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 hover:text-ink transition-colors mb-10"
            >
              <ArrowLeft className="size-3" aria-hidden />
              Retour à l&apos;Observatoire
            </Link>

            <div className="flex items-center gap-4 mb-10">
              {logoPath ? (
                <img
                  src={logoPath}
                  alt={`Logo ${mediaName}`}
                  className="h-10 max-w-[160px] object-contain opacity-80"
                  loading="eager"
                  decoding="async"
                />
              ) : null}
              <div className="flex flex-col">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
                  {mediaName}
                </span>
                <span className="font-mono text-[11px] text-ink/45">{publishedLabel}</span>
              </div>
            </div>

            <h1 className="font-sans font-semibold text-[32px] sm:text-[44px] md:text-[52px] leading-[1.1] tracking-[-0.02em] mb-10">
              {citation.articleTitle}
            </h1>

            <blockquote className="border-l-4 border-chartreuse-deep pl-6 sm:pl-8 py-2 mb-10">
              <p className="font-serif italic text-[20px] sm:text-[24px] text-ink/90 leading-relaxed">
                {`« ${citation.quoteExcerpt} »`}
              </p>
              {citation.author ? (
                <footer className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
                  — {citation.author}
                </footer>
              ) : null}
            </blockquote>

            <div className="flex flex-wrap gap-3 mb-2">
              <Button asChild variant="default" size="lg">
                <a href={citation.articleUrl} target="_blank" rel="noreferrer noopener">
                  Lire l&apos;article original sur {mediaName}
                  <ExternalLink className="size-4" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a
                  href={
                    isAdmin ? `/admin/observatoire/citations/${citation.id}` : citation.articleUrl
                  }
                  {...(isAdmin ? {} : { target: '_blank', rel: 'noreferrer noopener' })}
                >
                  <ShieldCheck className="size-4" />
                  Vérifier la source
                </a>
              </Button>
            </div>
            <p className="font-mono text-[11px] text-ink/45 mt-6">
              Citation référencée dans la bibliothèque éditoriale KOVAS et validée par notre équipe
              avant publication.
            </p>
          </div>
        </section>

        <section className="border-b border-rule/40">
          <div className="max-w-[860px] mx-auto px-6 py-14">
            <h2 className="font-sans font-semibold text-[24px] sm:text-[28px] leading-tight mb-4">
              À propos de l&apos;Observatoire KOVAS
            </h2>
            <p className="text-[15px] sm:text-[17px] text-ink/72 leading-relaxed">
              L&apos;Observatoire KOVAS agrège chaque mois les données publiques du diagnostic
              immobilier en France métropolitaine : prix médians par région, distribution des
              classes énergétiques, évolution de la rénovation et classement des villes en
              transition. Sources ADEME, Géorisques, INSEE et missions KOVAS anonymisées.
            </p>
            <div className="mt-8">
              <Button asChild variant="outline">
                <Link href="/observatoire">
                  Voir le dossier complet
                  <ArrowLeft className="size-4 rotate-180" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
