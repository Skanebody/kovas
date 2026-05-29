/**
 * /dashboard/annuaire/reviews — gestion des avis annuaire KOVAS.
 *
 * Server Component. Filtrage via query param `?filter=all|pending|this-week`
 * (Server-side, pas de state client = navigation pillules SSR-friendly).
 *
 * Sections :
 *  1. Header rating (note moyenne serif italic + nb avis mono + distribution 5 barres)
 *  2. Synthèse Google (gmb_rating / gmb_review_count) si disponible
 *  3. Filtres pillules (PageTabs server-side)
 *  4. Liste reviews (cards verticales avec stars + réponse / formulaire de réponse)
 *  5. Empty state honnête si zéro avis
 *
 * Data source : VRAIES données du diagnostiqueur connecté (table
 * `marketplace_reviews`, migration 20260628400000) + synthèse Google agrégée.
 * Cf. apps/web/src/lib/annuaire/mock-data.ts (data-access).
 */

import { AppPageHeader } from '@/components/app-page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageTabs } from '@/components/ui/page-tabs'
import {
  type AnnuaireReview,
  type ReviewFilter,
  formatReviewDate,
  getClaimedDiagnosticianId,
  getReviewsForDiagnostician,
  getReviewsSummary,
  isReviewFilter,
} from '@/lib/annuaire/mock-data'
import { getCurrentUser } from '@/lib/auth/current-user'
import { MessageSquareDashed, Star } from 'lucide-react'
import type { Metadata } from 'next'
import { ReviewReplyForm } from './review-reply-form'

export const metadata: Metadata = { title: 'Avis annuaire' }

interface PageProps {
  searchParams: Promise<{ filter?: string }>
}

export default async function AnnuaireReviewsPage({ searchParams }: PageProps) {
  const { user, supabase } = await getCurrentUser()
  const params = await searchParams
  const filter: ReviewFilter = isReviewFilter(params.filter) ? params.filter : 'all'

  // biome-ignore lint/suspicious/noExplicitAny: types DB Supabase en attente de régénération (migration 20260628400000)
  const sb = supabase as any
  const diagnosticianId = await getClaimedDiagnosticianId(sb, user.id)
  const [summary, reviews] = await Promise.all([
    getReviewsSummary(sb, diagnosticianId),
    getReviewsForDiagnostician(sb, diagnosticianId, filter),
  ])

  const hasAnyReview = summary.totalCount > 0
  const hasGoogle = summary.google !== null

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <AppPageHeader
        title="Tes"
        accent="avis"
        description="Construis ta réputation locale : les avis influencent directement ton classement dans l'annuaire."
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
        </>
      ) : (
        <>
          {hasGoogle ? <GoogleSynthesisCard summary={summary} /> : null}
          <EmptyState
            icon={MessageSquareDashed}
            title="Tu n'as pas encore d'avis"
            description="Aucun avis natif n'a encore été publié sur ta fiche KOVAS. Invite tes anciens clients à partager leur expérience : les avis vérifiés renforcent ta crédibilité et ton classement dans l'annuaire."
          />
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* HEADER : note moyenne + distribution 5 barres + synthèse Google     */
/* ------------------------------------------------------------------ */

interface ReviewsRatingHeaderProps {
  summary: Awaited<ReturnType<typeof getReviewsSummary>>
}

function ReviewsRatingHeader({ summary }: ReviewsRatingHeaderProps) {
  const { averageRating, totalCount, distribution, google } = summary
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
            {totalCount} avis KOVAS
          </p>
          {google ? (
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
              + {google.rating.toLocaleString('fr-FR')}/5 sur {google.reviewCount} avis Google
            </p>
          ) : null}
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
/* SYNTHÈSE GOOGLE (affichée seule quand 0 avis natif mais data GMB)   */
/* ------------------------------------------------------------------ */

function GoogleSynthesisCard({ summary }: ReviewsRatingHeaderProps) {
  const google = summary.google
  if (!google) return null
  return (
    <Card variant="flat" padding="default" className="flex items-center gap-4">
      <Star className="size-8 fill-amber text-amber shrink-0" strokeWidth={1.5} aria-hidden />
      <div>
        <p className="font-serif italic text-[28px] leading-none text-ink">
          {google.rating.toLocaleString('fr-FR')} / 5
        </p>
        <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Synthèse Google · {google.reviewCount} avis
        </p>
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
  const authorMeta = [review.authorCity, formatReviewDate(review.publishedAt)]
    .filter(Boolean)
    .join(' · ')

  return (
    <Card variant="flat" padding="default" className="space-y-4">
      {/* En-tête : stars + auteur + date + source */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <StarRating value={review.rating} />
          <p className="text-[15px] font-semibold text-ink leading-tight">
            {review.authorDisplayName}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
            {authorMeta}
          </p>
        </div>
        {review.source === 'google' ? (
          <Badge variant="muted" className="font-mono text-[10px]">
            Google
          </Badge>
        ) : null}
      </div>

      {/* Corps de l'avis */}
      {review.body ? (
        <p className="text-[14px] leading-relaxed text-ink/85 whitespace-pre-line">{review.body}</p>
      ) : null}

      {/* Footer : réponse existante OU formulaire de réponse */}
      {review.response ? (
        <div className="rounded-lg bg-sage-alt/40 border border-rule/50 p-4 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
            Ta réponse · {formatReviewDate(review.response.respondedAt)}
          </p>
          <p className="text-[13px] leading-relaxed text-ink/85 whitespace-pre-line">
            {review.response.body}
          </p>
        </div>
      ) : (
        <ReviewReplyForm reviewId={review.id} />
      )}
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
