'use client'

/**
 * Client component qui rend les filtres Profil + Région cliquables sur
 * /pros/temoignages. Auparavant les chips Badge étaient affichées en
 * read-only (`cursor-default`) avec un mot "activation côté client prévue
 * Sprint suivant". Maintenant pleinement fonctionnels.
 *
 * Filtres :
 *  - Profil : all / Solo / Cabinet (un seul choix)
 *  - Région : all / 9 régions (un seul choix)
 *
 * Aucune persistance URL pour V1 — état React local. Si besoin de
 * deep-linking SEO ultérieurement, basculer sur useSearchParams.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ExternalLink } from 'lucide-react'

type Profile = 'Solo' | 'Cabinet'
type Region =
  | 'Île-de-France'
  | 'PACA'
  | 'Auvergne-Rhône-Alpes'
  | 'Normandie'
  | 'Occitanie'
  | 'Nouvelle-Aquitaine'
  | 'Hauts-de-France'
  | 'Bretagne'
  | 'Grand Est'

interface Testimonial {
  name: string
  cabinet: string
  city: string
  region: Region
  profile: Profile
  seniority: string
  metric: string
  metricLabel: string
  quote: string
  publicProfileSlug?: string
}

interface TestimonialsExplorerProps {
  testimonials: Testimonial[]
  regions: Region[]
}

const PROFILES: Array<{ value: 'all' | Profile; label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'Solo', label: 'Solo' },
  { value: 'Cabinet', label: 'Cabinet' },
]

function buildInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function TestimonialsExplorer({ testimonials, regions }: TestimonialsExplorerProps) {
  const [profileFilter, setProfileFilter] = useState<'all' | Profile>('all')
  const [regionFilter, setRegionFilter] = useState<'all' | Region>('all')

  const filtered = useMemo(() => {
    return testimonials.filter((t) => {
      if (profileFilter !== 'all' && t.profile !== profileFilter) return false
      if (regionFilter !== 'all' && t.region !== regionFilter) return false
      return true
    })
  }, [testimonials, profileFilter, regionFilter])

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            Profil :
          </span>
          {PROFILES.map((p) => {
            const active = profileFilter === p.value
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setProfileFilter(p.value)}
                className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-pressed={active}
              >
                <Badge
                  variant={active ? 'default' : 'outline'}
                  className="cursor-pointer transition-colors hover:bg-ink hover:text-paper"
                >
                  {p.label}
                </Badge>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            Région :
          </span>
          <button
            type="button"
            onClick={() => setRegionFilter('all')}
            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-pressed={regionFilter === 'all'}
          >
            <Badge
              variant={regionFilter === 'all' ? 'default' : 'outline'}
              className="cursor-pointer transition-colors hover:bg-ink hover:text-paper"
            >
              Toutes
            </Badge>
          </button>
          {regions.map((r) => {
            const active = regionFilter === r
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRegionFilter(r)}
                className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-pressed={active}
              >
                <Badge
                  variant={active ? 'default' : 'outline'}
                  className="cursor-pointer transition-colors hover:bg-ink hover:text-paper"
                >
                  {r}
                </Badge>
              </button>
            )
          })}
        </div>

        <p className="text-xs text-ink-faint" aria-live="polite">
          {filtered.length} témoignage{filtered.length > 1 ? 's' : ''} affichés
          {profileFilter !== 'all' || regionFilter !== 'all' ? ' (filtrés)' : ''}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <Card variant="opaque" padding="lg" className="md:col-span-2 lg:col-span-3 text-center">
            <p className="text-sm text-ink-mute">
              Aucun témoignage ne correspond à ces critères. Essayez de retirer un filtre.
            </p>
          </Card>
        ) : (
          filtered.map((t) => (
            <Card key={t.name} variant="opaque" padding="default" className="space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-paper"
                  aria-hidden
                >
                  {buildInitials(t.name)}
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold leading-tight">{t.name}</p>
                  <p className="text-xs text-ink-mute">{t.cabinet}</p>
                  <p className="text-xs text-ink-faint">
                    {t.city} · {t.region}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={t.profile === 'Cabinet' ? 'blue' : 'green'}>{t.profile}</Badge>
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
                  {t.seniority}
                </span>
              </div>
              <blockquote className="text-sm italic text-ink-soft">« {t.quote} »</blockquote>
              <div className="rounded-md bg-chartreuse-soft/60 p-3">
                <div className="text-display-serif text-2xl text-chartreuse-deep">{t.metric}</div>
                <p className="text-xs text-ink-mute">{t.metricLabel}</p>
              </div>
              {t.publicProfileSlug && (
                <Link
                  href={`/diag/${t.publicProfileSlug}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-ink-mute hover:text-ink"
                >
                  Voir la fiche annuaire <ExternalLink className="size-3" />
                </Link>
              )}
            </Card>
          ))
        )}
      </div>
    </>
  )
}
