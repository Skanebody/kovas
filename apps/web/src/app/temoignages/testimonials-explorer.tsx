'use client'

/**
 * Client component qui rend les filtres Profil + Région cliquables sur
 * /temoignages. B71 (2026-05-26) : harmonisation au style home V5 sobre.
 *
 * Filtres :
 *  - Profil : all / Solo / Cabinet (un seul choix)
 *  - Région : all / 9 régions (un seul choix)
 *
 * Aucune persistance URL pour V1 — état React local. Si besoin de
 * deep-linking SEO ultérieurement, basculer sur useSearchParams.
 */

import Link from 'next/link'
import { useMemo, useState } from 'react'

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

function FilterChip({
  active,
  onClick,
  children,
  ariaPressed,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  ariaPressed: boolean
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaPressed}
      className={[
        'rounded-pill px-3.5 py-1.5 text-[12px] font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F1419]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5F7F4]',
        active
          ? 'bg-[#0F1419] text-paper border border-[#0F1419]'
          : 'bg-white border border-[#0F1419]/[0.08] text-[#0F1419]/72 hover:text-[#0F1419] hover:border-[#0F1419]/30',
      ].join(' ')}
    >
      {children}
    </button>
  )
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
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
            Profil
          </span>
          {PROFILES.map((p) => {
            const active = profileFilter === p.value
            return (
              <FilterChip
                key={p.value}
                active={active}
                ariaPressed={active}
                onClick={() => setProfileFilter(p.value)}
              >
                {p.label}
              </FilterChip>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
            Région
          </span>
          <FilterChip
            active={regionFilter === 'all'}
            ariaPressed={regionFilter === 'all'}
            onClick={() => setRegionFilter('all')}
          >
            Toutes
          </FilterChip>
          {regions.map((r) => {
            const active = regionFilter === r
            return (
              <FilterChip
                key={r}
                active={active}
                ariaPressed={active}
                onClick={() => setRegionFilter(r)}
              >
                {r}
              </FilterChip>
            )
          })}
        </div>

        <p className="text-[12px] text-[#0F1419]/55" aria-live="polite">
          {filtered.length} témoignage{filtered.length > 1 ? 's' : ''} affichés
          {profileFilter !== 'all' || regionFilter !== 'all' ? ' (filtrés)' : ''}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 text-center">
            <p className="text-[14px] text-[#0F1419]/72">
              Aucun témoignage ne correspond à ces critères. Essayez de retirer un filtre.
            </p>
          </div>
        ) : (
          filtered.map((t) => (
            <article
              key={t.name}
              className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-4"
            >
              <header className="flex items-start gap-3">
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#0F1419] text-sm font-semibold text-paper"
                  aria-hidden
                >
                  {buildInitials(t.name)}
                </div>
                <div className="space-y-0.5">
                  <p className="text-[14px] font-semibold leading-tight text-[#0F1419]">{t.name}</p>
                  <p className="text-[12px] text-[#0F1419]/72">{t.cabinet}</p>
                  <p className="text-[12px] text-[#0F1419]/55">
                    {t.city} · {t.region}
                  </p>
                </div>
              </header>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={[
                    'inline-flex items-center rounded-pill px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider',
                    t.profile === 'Cabinet'
                      ? 'bg-[#0F1419] text-paper'
                      : 'bg-white border border-[#0F1419]/[0.08] text-[#0F1419]/72',
                  ].join(' ')}
                >
                  {t.profile}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
                  {t.seniority}
                </span>
              </div>
              <blockquote className="font-serif italic font-normal text-[16px] sm:text-[18px] text-[#0F1419] leading-relaxed">
                <span className="text-[#0F1419]/55">«&nbsp;</span>
                {t.quote}
                <span className="text-[#0F1419]/55">&nbsp;»</span>
              </blockquote>
              <div className="rounded-xl border border-[#0F1419]/[0.06] bg-[#F5F7F4]/60 px-4 py-3">
                <div
                  className="font-serif italic font-normal text-chartreuse-deep leading-none"
                  style={{ fontSize: 'clamp(28px, 3vw, 36px)' }}
                >
                  {t.metric}
                </div>
                <p className="text-[12px] text-[#0F1419]/72 mt-1">{t.metricLabel}</p>
              </div>
              {t.publicProfileSlug && (
                <Link
                  href={`/diag/${t.publicProfileSlug}`}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0F1419]/72 hover:text-[#0F1419] underline-offset-2 hover:underline"
                >
                  Voir la fiche annuaire <ExternalLink className="size-3" />
                </Link>
              )}
            </article>
          ))
        )}
      </div>
    </>
  )
}
