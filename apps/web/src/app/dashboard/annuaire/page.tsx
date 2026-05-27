import { AppPageHeader } from '@/components/app-page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowRight, BarChart3, ExternalLink, IdCard, Inbox, Star, UserCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Annuaire' }

/**
 * Hub annuaire (Server Component) — point d'entrée du module annuaire
 * dans le dashboard du diagnostiqueur.
 *
 * 4 cards de navigation :
 *  1. Ma fiche      → /dashboard/annuaire/ma-fiche
 *  2. Leads         → /dashboard/leads
 *  3. Reviews       → /dashboard/annuaire/reviews
 *  4. Stats         → /dashboard/annuaire/stats
 *
 * Banner stats sommaires (Vues mois · Leads mois · Reviews · Note) si data dispo.
 * Si l'utilisateur n'a pas encore réclamé sa fiche → empty state activation.
 */

type AnnuaireSummary = {
  diagnosticianId: string | null
  publicSlugPath: string | null
  viewsThisMonth: number | null
  leadsThisMonth: number | null
  reviewsCount: number | null
  averageRating: number | null
}

async function loadAnnuaireSummary(): Promise<AnnuaireSummary> {
  const { user, supabase } = await getCurrentUser()
  // biome-ignore lint/suspicious/noExplicitAny: types DB régénérés async
  const sb = supabase as any

  // 1. Diagnostician revendiqué par l'utilisateur (V1 : 1 user = 1 diag)
  const { data: diag } = await sb
    .from('diagnosticians')
    .select(
      'id, slug, slug_city, slug_dept, view_count, quote_request_count, gmb_rating, gmb_review_count',
    )
    .eq('claimed_by_user_id', user.id)
    .maybeSingle()

  if (!diag?.id) {
    return {
      diagnosticianId: null,
      publicSlugPath: null,
      viewsThisMonth: null,
      leadsThisMonth: null,
      reviewsCount: null,
      averageRating: null,
    }
  }

  // 2. URL publique : si on a slug_dept/slug_city/slug → /diagnostiqueurs/...
  const publicSlugPath =
    diag.slug && diag.slug_dept && diag.slug_city
      ? `/diagnostiqueurs/${diag.slug_dept}/${diag.slug_city}/${diag.slug}`
      : null

  return {
    diagnosticianId: diag.id as string,
    publicSlugPath,
    viewsThisMonth: typeof diag.view_count === 'number' ? diag.view_count : null,
    leadsThisMonth: typeof diag.quote_request_count === 'number' ? diag.quote_request_count : null,
    reviewsCount: typeof diag.gmb_review_count === 'number' ? diag.gmb_review_count : null,
    averageRating:
      typeof diag.gmb_rating === 'number' && diag.gmb_rating > 0 ? Number(diag.gmb_rating) : null,
  }
}

export default async function AnnuaireHubPage() {
  const summary = await loadAnnuaireSummary()

  // Cas 1 : aucune fiche revendiquée → empty state activation
  if (!summary.diagnosticianId) {
    return (
      <div className="space-y-8 pb-8">
        <AppPageHeader
          eyebrow="KOVAS Annuaire"
          title="Annuaire"
          description="Gère ta fiche publique sur kovas.fr et reçois tes leads particuliers."
        />

        <Card variant="flat" padding="lg">
          <EmptyState
            icon={UserCheck}
            title="Active ta fiche annuaire."
            description="Réclame ta fiche publique en deux minutes pour apparaître dans les recherches de particuliers et recevoir tes premiers leads qualifiés."
            action={
              <Button asChild variant="accent">
                <Link href="/dashboard/upgrade/annuaire">
                  Activer ma fiche
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            }
            secondaryAction={
              <Button asChild variant="ghost">
                <Link href="/diagnostiqueurs">Voir l&apos;annuaire public</Link>
              </Button>
            }
          />
        </Card>
      </div>
    )
  }

  const hasAnyMetric =
    summary.viewsThisMonth !== null ||
    summary.leadsThisMonth !== null ||
    summary.reviewsCount !== null ||
    summary.averageRating !== null

  return (
    <div className="space-y-8 pb-8">
      <AppPageHeader
        eyebrow="KOVAS Annuaire"
        title="Annuaire"
        accent="ta fiche publique"
        description="Pilote ta présence sur kovas.fr : fiche, leads, avis et statistiques au même endroit."
        action={
          summary.publicSlugPath ? (
            <Button asChild variant="outline">
              <Link href={summary.publicSlugPath} target="_blank" rel="noopener noreferrer">
                Aperçu public
                <ExternalLink className="size-4" />
              </Link>
            </Button>
          ) : undefined
        }
      />

      {hasAnyMetric ? (
        <Card variant="flat" padding="sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryStat label="Vues ce mois" value={summary.viewsThisMonth} format="int" />
            <SummaryStat label="Leads ce mois" value={summary.leadsThisMonth} format="int" />
            <SummaryStat label="Avis Google" value={summary.reviewsCount} format="int" />
            <SummaryStat label="Note moyenne" value={summary.averageRating} format="rating" />
          </div>
        </Card>
      ) : null}

      <section
        aria-labelledby="annuaire-nav-heading"
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <h2 id="annuaire-nav-heading" className="sr-only">
          Navigation annuaire
        </h2>

        <HubCard
          href="/dashboard/annuaire/ma-fiche"
          icon={IdCard}
          title="Ma fiche"
          description="Profil, photos, certifications, zones d'intervention, tarifs et disponibilités."
          badge="11 sections"
        />
        <HubCard
          href="/dashboard/leads"
          icon={Inbox}
          title="Leads"
          description="Demandes de devis qualifiées entrantes — accepter, refuser, prioriser."
          badge={summary.leadsThisMonth !== null ? `${summary.leadsThisMonth} ce mois` : undefined}
        />
        <HubCard
          href="/dashboard/annuaire/reviews"
          icon={Star}
          title="Avis"
          description="Avis Google synchronisés, réponses suggérées par l'IA et modération."
          badge={
            summary.reviewsCount !== null && summary.reviewsCount > 0
              ? `${summary.reviewsCount} avis`
              : undefined
          }
        />
        <HubCard
          href="/dashboard/annuaire/stats"
          icon={BarChart3}
          title="Statistiques"
          description="Vues, conversions, classement, audit SEO mensuel de ta fiche."
          badge={summary.viewsThisMonth !== null ? `${summary.viewsThisMonth} vues` : undefined}
        />
      </section>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  format,
}: {
  label: string
  value: number | null
  format: 'int' | 'rating'
}) {
  const formatted =
    value === null ? '—' : format === 'rating' ? value.toFixed(1) : value.toLocaleString('fr-FR')

  return (
    <div className="space-y-1">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">{label}</p>
      <p className="font-serif italic text-3xl text-ink leading-none">{formatted}</p>
    </div>
  )
}

function HubCard({
  href,
  icon: Icon,
  title,
  description,
  badge,
}: {
  href: string
  icon: typeof IdCard
  title: string
  description: string
  badge?: string
}) {
  return (
    <Link
      href={href}
      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/20"
    >
      <Card
        variant="flat"
        padding="default"
        className="h-full transition-all duration-base ease-spring group-hover:-translate-y-px group-hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-4">
          <div
            aria-hidden
            className="flex size-10 items-center justify-center rounded-full bg-cream-deep text-ink"
          >
            <Icon className="size-5" strokeWidth={1.5} />
          </div>
          {badge ? <Badge variant="outline">{badge}</Badge> : null}
        </div>
        <div className="mt-5 space-y-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="mt-5 flex items-center gap-1.5 text-[12px] font-medium text-ink-mute group-hover:text-ink">
          Ouvrir
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  )
}
