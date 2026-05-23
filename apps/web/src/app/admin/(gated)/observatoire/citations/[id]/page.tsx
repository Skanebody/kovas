/**
 * /admin/observatoire/citations/[id] — Modération d'une citation presse.
 *
 * FIX-E (2026-05-24) : page admin permettant de :
 *   - relire l'extrait cité (article_title + quote_excerpt + author + date)
 *   - corriger les champs si besoin (URL, titre, extrait)
 *   - valider (passe à `verified` + estampille verified_by/at)
 *   - rejeter (avec raison)
 *   - remettre en pending
 *
 * Le layout `(gated)` prend déjà en charge l'auth + 2FA.
 */

import { Card } from '@/components/ui/card'
import { PRESS_MENTIONS } from '@/lib/institutional/press-mentions'
import { getPressCitationAdmin } from '@/lib/observatoire/press-citations'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CitationModerationForm } from './CitationModerationForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: 'Modération citation presse — Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function AdminCitationPage({ params }: PageProps) {
  const { id } = await params
  const citation = await getPressCitationAdmin(id)
  if (!citation) notFound()

  const media = PRESS_MENTIONS.find((m) => m.id === citation.mediaSlug)
  const mediaName = media?.name ?? citation.mediaSlug

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header navigation */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute mb-2">
            Observatoire / Citations presse
          </p>
          <h1 className="font-sans text-2xl font-semibold text-ink">Modérer cette citation</h1>
        </div>
        <Link
          href="/admin/observatoire"
          className="text-sm text-ink-mute hover:text-ink underline underline-offset-4"
        >
          ← Retour Observatoire
        </Link>
      </div>

      {/* Carte métadonnées en lecture seule */}
      <Card variant="opaque" padding="default" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {media?.logoPath ? (
              // biome-ignore lint/a11y/useAltText: alt is provided via plain attribute
              <img src={media.logoPath} alt={`Logo ${mediaName}`} className="h-7" />
            ) : null}
            <p className="font-medium text-ink">{mediaName}</p>
          </div>
          <p className="text-xs font-mono text-ink-mute">id : {citation.id}</p>
        </div>
        <dl className="grid sm:grid-cols-3 gap-3 text-xs">
          <div>
            <dt className="font-mono uppercase tracking-wider text-ink-mute">Statut</dt>
            <dd className="text-ink font-medium capitalize">
              {citation.status === 'verified'
                ? 'Vérifiée'
                : citation.status === 'rejected'
                  ? 'Rejetée'
                  : 'En attente'}
            </dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-wider text-ink-mute">Validée par</dt>
            <dd className="text-ink">{citation.verifiedBy ?? '—'}</dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-wider text-ink-mute">Validée le</dt>
            <dd className="text-ink">{formatDate(citation.verifiedAt)}</dd>
          </div>
        </dl>
        {citation.rejectionReason ? (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            <span className="font-mono uppercase tracking-wider mr-2">Rejet :</span>
            {citation.rejectionReason}
          </p>
        ) : null}
      </Card>

      {/* Formulaire client de modération */}
      <CitationModerationForm citation={citation} mediaName={mediaName} />

      {/* Lien public preview */}
      <div className="text-xs text-ink-mute">
        Preview publique :{' '}
        <Link
          href={`/observatoire/citation/${citation.id}`}
          className="text-navy underline underline-offset-4"
          target="_blank"
          rel="noreferrer noopener"
        >
          /observatoire/citation/{citation.id}
        </Link>
        {citation.status !== 'verified' ? (
          <span className="ml-2 text-ink-faint">(masquée tant que non vérifiée)</span>
        ) : null}
      </div>
    </div>
  )
}
