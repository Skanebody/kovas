/**
 * /dashboard/annuaire/reviews — gestion des avis annuaire KOVAS.
 *
 * Server Component pur. Filtrage via query param `?filter=all|pending|this-week`
 * (Server-side, pas de state client = navigation pillules SSR-friendly).
 *
 * Sections :
 *  1. Header rating (note moyenne serif italic + nb avis mono + distribution 5 barres)
 *  2. Filtres pillules (PageTabs server-side)
 *  3. Liste reviews (cards verticales avec stars + critères + bouton Répondre)
 *  4. CTA bas : demander un avis (placeholder)
 *  5. Empty state si zéro avis
 *
 * Data source : V1 mock (cf. `apps/web/src/lib/annuaire/mock-data.ts`).
 * Le jour où `marketplace_reviews` existe, on remplace l'implémentation des
 * helpers sans changer leur signature ni ce composant.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageTabs } from '@/components/ui/page-tabs'
import {
  type AnnuaireReview,
  type ReviewFilter,
  formatReviewDate,
  getClaimedDiagnosticianId,
  getCriterionLabel,
  getReviewsForDiagnostician,
  getReviewsSummary,
  isReviewFilter,
} from '@/lib/annuaire/mock-data'
import { getCurrentUser } from '@/lib/auth/current-user'
import { MessageSquareDashed, Star } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Avis annuaire' }

/**
 * Feature flag V1 → V1.5.
 *
 * En V1, la table `marketplace_reviews` n'existe pas encore et aucune Server
 * Action n'est branchée pour répondre / modifier / demander des avis. On masque
 * donc les boutons interactifs plutôt que de les laisser visibles mais inertes
 * (= UX frustrante "produit pas fini").
 *
 * À basculer à `true` en V1.5 quand les actions seront branchées.
 */
const FEATURE_REVIEWS_INTERACTIVE = false // TODO V1.5

interface PageProps {
  searchParams: Promise<{ filter?: string }>
}

export default async function AnnuaireReviewsPage({ searchParams }: PageProps) {
  const { user, supabase } = await getCurrentUser()
  const params = await searchParams
  const filter: ReviewFilter = isReviewFilter(params.filter) ? params.filter : 'all'

  const diagnosticianId = await getClaimedDiagnosticianId(supabase, user.id)
  const [summary, reviews] = await Promise.all([
    getReviewsSummary(diagnosticianId),
    getReviewsForDiagnostician(diagnosticianId, filter),
  ])

  const hasAnyReview = summary.totalCount > 0

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <AppPageHeader
        title="Tes"
        accent="avis"
        description="Construis ta réputation locale : les avis Google et KOVAS influencent directement ton classement dans l'annuaire."
      />

      {hasAnyReview ? (
        <>
          <ReviewsRatingHeader summary={summary} />
          <ReviewsFilters
            basePath="/dashboard/annuaire/reviews"
            active={filter}
            summary={summary}
          />
          <ReviewsList reviews={reviews} filter={filter} />
          {FEATURE_REVIEWS_INTERACTIVE ? <RequestReviewCta /> : null}
        </>
      ) : (
        <EmptyState
          icon={MessageSquareDashed}
          title="Aucun avis pour l'instant"
          description="Demande à tes anciens clients de partager leur expérience. Les avis vérifiés boostent ton classement annuaire de +35 % en moyenne."
          action={
            FEATURE_REVIEWS_INTERACTIVE ? (
              <Button variant="accent" size="lg">
                Demander un avis à mes anciens clients
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* HEADER : note moyenne + distribution 5 barres                       */
/* ------------------------------------------------------------------ */

interface ReviewsRatingHeaderProps {
  summary: Awaited<ReturnType<typeof getReviewsSummary>>
}

function ReviewsRatingHeader({ summary }: ReviewsRatingHeaderProps) {
  const { averageRating, totalCount, distribution } = summary
  const maxBarValue = Math.max(...Object.values(distribution), 1)

  return (
    <Card variant="flat" padding="lg" className="relative overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-8 items-center">
        {/* Note moyenne — serif italic dramatisé */}
        <div className="flex flex-col items-center md:items-start">
          <div className="flex items-baseline gap-2">
            <span className="font-serif italic font-normal text-[64px] md:text-[72px] leading-none tracking-tight text-ink">
              {averageRating !== null ? averageRating.toLocaleString('fr-FR') : '—'}
            </span>
            <Star
              className="size-7 fill-amber text-amber md:size-8"
              strokeWidth={1.5}
              aria-hidden
            />
          </div>
          <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.1em] text-ink-mute">
            {totalCount} {totalCount > 1 ? 'avis' : 'avis'}
          </p>
        </div>

        {/* Distribution 5 → 1 (top down) */}
        <div className="flex flex-col gap-2 w-full">
          {([5, 4, 3, 2, 1] as const).map((stars) => {
            const count = distribution[stars]
            const widthPct = (count / maxBarValue) * 100
            return (
              <div key={stars} className="grid grid-cols-[24px_1fr_40px] items-center gap-3">
                <span className="font-mono text-[12px] text-ink-mute tabular-nums">{stars}★</span>
                <div className="relative h-2 rounded-pill bg-cream-deep overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-pill bg-navy transition-all duration-base"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="font-mono text-[12px] text-ink-mute tabular-nums text-right">
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* FILTRES — pillules tabs Server                                      */
/* ------------------------------------------------------------------ */

interface ReviewsFiltersProps {
  basePath: string
  active: ReviewFilter
  summary: Awaited<ReturnType<typeof getReviewsSummary>>
}

function ReviewsFilters({ basePath, active, summary }: ReviewsFiltersProps) {
  return (
    <PageTabs
      basePath={basePath}
      paramName="filter"
      active={active}
      tabs={[
        { key: 'all', label: 'Tous les avis', count: summary.totalCount },
        { key: 'pending', label: 'Sans réponse', count: summary.pendingResponses },
        { key: 'this-week', label: 'Cette semaine', count: summary.thisWeekCount },
      ]}
    />
  )
}

/* ------------------------------------------------------------------ */
/* LISTE AVIS                                                          */
/* ------------------------------------------------------------------ */

interface ReviewsListProps {
  reviews: ReadonlyArray<AnnuaireReview>
  filter: ReviewFilter
}

function ReviewsList({ reviews, filter }: ReviewsListProps) {
  if (reviews.length === 0) {
    return (
      <Card variant="flat" padding="lg">
        <p className="text-sm text-ink-mute text-center">
          {filter === 'pending'
            ? 'Tous tes avis ont reçu une réponse. Continue comme ça.'
            : filter === 'this-week'
              ? 'Aucun avis reçu sur les 7 derniers jours.'
              : 'Aucun avis dans cette sélection.'}
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* CARD AVIS                                                           */
/* ------------------------------------------------------------------ */

interface ReviewCardProps {
  review: AnnuaireReview
}

function ReviewCard({ review }: ReviewCardProps) {
  return (
    <Card variant="flat" padding="default" className="space-y-4">
      {/* En-tête : stars + auteur + date */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <StarRating value={review.rating} />
          <p className="text-[15px] font-semibold text-ink leading-tight">
            {review.authorDisplayName}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
            {formatReviewDate(review.publishedAt)}
          </p>
        </div>
      </div>

      {/* Corps de l'avis — truncate CSS line-clamp-3 plutôt qu'un bouton
          "Lire plus" inerte (V1 : pas de page détail avis). */}
      <p className="text-[14px] leading-relaxed text-ink/85 line-clamp-3">{review.body}</p>

      {/* Critères validés */}
      {review.criteria.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {review.criteria.map((c) => (
            <Badge key={c} variant="green" className="font-mono text-[10px] gap-1">
              <span aria-hidden>✓</span>
              {getCriterionLabel(c)}
            </Badge>
          ))}
        </div>
      ) : null}

      {/* Footer : réponse existante OU bouton Répondre (V1.5+) */}
      {review.response ? (
        <div className="rounded-lg bg-sage-alt/40 border border-rule/50 p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
              Votre réponse · {formatReviewDate(review.response.respondedAt)}
            </p>
            {FEATURE_REVIEWS_INTERACTIVE ? (
              <Button variant="ghost" size="sm" className="font-medium">
                Modifier
              </Button>
            ) : null}
          </div>
          <p className="text-[13px] leading-relaxed text-ink/85">{review.response.body}</p>
        </div>
      ) : FEATURE_REVIEWS_INTERACTIVE ? (
        <div className="flex justify-end">
          <Button variant="default" size="sm">
            Répondre
          </Button>
        </div>
      ) : null}
    </Card>
  )
}

function StarRating({ value }: { value: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`${value} étoile${value > 1 ? 's' : ''} sur 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={
            n <= value ? 'size-4 fill-amber text-amber' : 'size-4 fill-rule/40 text-rule/60'
          }
          strokeWidth={1.5}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* CTA BAS DE PAGE                                                     */
/* ------------------------------------------------------------------ */

function RequestReviewCta() {
  return (
    <Card variant="flat" padding="lg" className="text-center space-y-4">
      <div className="space-y-2">
        <h2 className="font-serif italic font-normal text-2xl md:text-3xl tracking-tight text-ink">
          Demande un avis à tes clients
        </h2>
        <p className="text-sm text-ink-mute max-w-md mx-auto">
          Un client satisfait est rarement spontané. Envoie-lui un lien sécurisé pour publier son
          avis sur ta fiche annuaire en 30 secondes.
        </p>
      </div>
      <div className="flex justify-center">
        <Button variant="accent" size="lg">
          Envoyer une demande d'avis
        </Button>
      </div>
    </Card>
  )
}
