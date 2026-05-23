/**
 * /admin/quality — Indicateurs qualité éditoriale et technique.
 *
 * Sources :
 *  - veille_articles_draft : moyennes E-E-A-T 4 axes (Experience / Expertise /
 *    Authoritativeness / Trustworthiness) sur articles publiés
 *  - seo_drafts : scores E-E-A-T pipeline SEO admin (Mission D1)
 *  - PostHog : scores Lighthouse Performance / SEO / Accessibility (placeholder
 *    V2 — instrumentation à câbler via webhook GitHub Actions Lighthouse CI)
 *
 * V1 : tout en lecture seule. V2 : déclenchera des audits Lighthouse à la demande.
 */

import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import {
  Award,
  BookOpen,
  Gauge,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Qualité éditoriale',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface VeilleStats {
  published: number
  avgExperience: number
  avgExpertise: number
  avgAuthoritativeness: number
  avgTrustworthiness: number
  avgWordCount: number
  avgInternalLinks: number
  avgSourceCitations: number
}

interface SeoStats {
  approvedDrafts: number
  avgEeatScore: number
}

async function fetchVeilleStats(): Promise<VeilleStats> {
  const supabase = createAdminClient()
  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { data } = await (supabase as any)
    .from('veille_articles_draft')
    .select(
      'eeat_experience, eeat_expertise, eeat_authoritativeness, eeat_trustworthiness, word_count, internal_links_count, source_citations_count',
    )
    .eq('status', 'published')

  const rows = ((data ?? []) as Array<{
    eeat_experience: number
    eeat_expertise: number
    eeat_authoritativeness: number
    eeat_trustworthiness: number
    word_count: number
    internal_links_count: number
    source_citations_count: number
  }>)

  if (rows.length === 0) {
    return {
      published: 0,
      avgExperience: 0,
      avgExpertise: 0,
      avgAuthoritativeness: 0,
      avgTrustworthiness: 0,
      avgWordCount: 0,
      avgInternalLinks: 0,
      avgSourceCitations: 0,
    }
  }

  const sum = rows.reduce(
    (acc, r) => ({
      exp: acc.exp + r.eeat_experience,
      exper: acc.exper + r.eeat_expertise,
      auth: acc.auth + r.eeat_authoritativeness,
      trust: acc.trust + r.eeat_trustworthiness,
      words: acc.words + r.word_count,
      iLinks: acc.iLinks + r.internal_links_count,
      sources: acc.sources + r.source_citations_count,
    }),
    { exp: 0, exper: 0, auth: 0, trust: 0, words: 0, iLinks: 0, sources: 0 },
  )
  const n = rows.length

  return {
    published: n,
    avgExperience: Math.round(sum.exp / n),
    avgExpertise: Math.round(sum.exper / n),
    avgAuthoritativeness: Math.round(sum.auth / n),
    avgTrustworthiness: Math.round(sum.trust / n),
    avgWordCount: Math.round(sum.words / n),
    avgInternalLinks: Math.round((sum.iLinks / n) * 10) / 10,
    avgSourceCitations: Math.round((sum.sources / n) * 10) / 10,
  }
}

async function fetchSeoStats(): Promise<SeoStats> {
  const supabase = createAdminClient()
  // biome-ignore lint/suspicious/noExplicitAny: seo_drafts pas dans Database.types
  const { data } = await (supabase as any)
    .from('seo_drafts')
    .select('eeat_score, status')
    .in('status', ['approved', 'published'])

  const rows = ((data ?? []) as Array<{ eeat_score: number | null; status: string }>)
    .filter((r) => typeof r.eeat_score === 'number')

  if (rows.length === 0) return { approvedDrafts: 0, avgEeatScore: 0 }

  const avg = Math.round(
    rows.reduce((acc, r) => acc + (r.eeat_score ?? 0), 0) / rows.length,
  )

  return { approvedDrafts: rows.length, avgEeatScore: avg }
}

function scoreBadge(score: number) {
  if (score >= 75)
    return (
      <Badge variant="green" className="text-[10px]">
        Excellent
      </Badge>
    )
  if (score >= 55)
    return (
      <Badge variant="yellow" className="text-[10px]">
        Correct
      </Badge>
    )
  return (
    <Badge variant="red" className="text-[10px]">
      À renforcer
    </Badge>
  )
}

function ScoreRow({
  label,
  icon: Icon,
  value,
  hint,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  value: number
  hint: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-ink inline-flex items-center gap-2">
          <Icon className="size-3.5 text-ink-mute" />
          {label}
        </p>
        {scoreBadge(value)}
      </div>
      <div className="h-2 rounded-full bg-cream-deep overflow-hidden">
        <div
          className={
            value >= 75
              ? 'h-full bg-green-500'
              : value >= 55
                ? 'h-full bg-amber-500'
                : 'h-full bg-red-500'
          }
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          aria-label={`${value}/100`}
        />
      </div>
      <p className="text-[11px] text-ink-faint font-mono">
        {value}/100 · {hint}
      </p>
    </div>
  )
}

export default async function AdminQualityPage() {
  const [veille, seo] = await Promise.all([fetchVeilleStats(), fetchSeoStats()])

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Qualité éditoriale · E-E-A-T moyens
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Indicateurs qualité.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          Moyennes E-E-A-T (Google Quality Rater Guidelines) sur l'ensemble des
          articles de veille et drafts SEO publiés. Source primaire : pipeline
          méthode Amandine Bart + scoring auto.
        </p>
      </div>

      {/* KPI grid */}
      <section
        aria-label="Indicateurs qualité globaux"
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminMetricCard
          eyebrow="Articles publiés"
          value={veille.published.toString()}
          hint={`${veille.avgWordCount.toLocaleString('fr-FR')} mots en moyenne`}
          icon={BookOpen}
        />
        <AdminMetricCard
          eyebrow="Drafts SEO approuvés"
          value={seo.approvedDrafts.toString()}
          hint={`Pipeline SEO programmatique`}
          icon={Sparkles}
        />
        <AdminMetricCard
          eyebrow="Score E-E-A-T moyen"
          value={`${Math.round(
            (veille.avgExperience
              + veille.avgExpertise
              + veille.avgAuthoritativeness
              + veille.avgTrustworthiness) / 4,
          )}/100`}
          hint="Composite veille publiée"
          icon={Award}
        />
        <AdminMetricCard
          eyebrow="Sources / article"
          value={veille.avgSourceCitations.toString()}
          hint={`${veille.avgInternalLinks} liens internes moyens`}
          icon={ShieldCheck}
        />
      </section>

      {/* E-E-A-T détaillé */}
      <Card className="p-6">
        <h2 className="font-sans font-semibold text-lg text-ink mb-4">
          Scoring E-E-A-T — articles de veille publiés
        </h2>
        {veille.published === 0 ? (
          <p className="text-sm text-ink-mute py-6 text-center">
            Aucun article publié pour le moment. Les scores apparaîtront dès la
            publication du premier draft validé.
          </p>
        ) : (
          <div className="space-y-5">
            <ScoreRow
              label="Experience (exemples, terrain, chiffres)"
              icon={Star}
              value={veille.avgExperience}
              hint="cible > 60"
            />
            <ScoreRow
              label="Expertise (vocabulaire technique)"
              icon={Award}
              value={veille.avgExpertise}
              hint="cible > 70"
            />
            <ScoreRow
              label="Authoritativeness (sources Légifrance, ADEME, INSEE)"
              icon={ShieldCheck}
              value={veille.avgAuthoritativeness}
              hint="cible > 65"
            />
            <ScoreRow
              label="Trustworthiness (dates, disclaimers, liens externes)"
              icon={Gauge}
              value={veille.avgTrustworthiness}
              hint="cible > 60"
            />
          </div>
        )}
      </Card>

      {/* Lighthouse — placeholder pour V2 instrumentation */}
      <Card className="p-6 bg-cream-deep border-rule">
        <h2 className="font-sans font-semibold text-lg text-ink mb-2">
          Scores Lighthouse — V2
        </h2>
        <p className="text-sm text-ink-mute">
          L'instrumentation Lighthouse CI sera câblée en V2 via un webhook GitHub
          Actions sur les principaux templates SEO (`/diagnostic/[type]/[ville]`,
          `/diagnostiqueurs/[dept]/[city]`, `/observatoire`). Les scores
          Performance, SEO et Accessibility apparaîtront ici une fois la pipeline
          en place.
        </p>
      </Card>
    </div>
  )
}
