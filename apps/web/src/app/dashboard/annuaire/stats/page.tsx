/**
 * /dashboard/annuaire/stats — analytics fiche annuaire.
 *
 * Server Component. Sélection période via query param `?period=7d|30d|90d|1y`
 * (défaut 30d ; la période ne filtre que les leads reçus, car les compteurs
 * vues/devis sont cumulés en base).
 *
 * Data : VRAIES données du diagnostiqueur connecté
 *  - Vues fiche       → diagnosticians.view_count (cumul)
 *  - Demandes de devis → diagnosticians.quote_request_count (cumul)
 *  - Leads reçus      → count lead_assignments sur la période (notified_at)
 *  - Leads acceptés   → count lead_assignments status='accepted'
 *  - Taux d'acceptation → acceptés / reçus
 *  - Note moyenne / avis → marketplace_reviews
 *
 * Honnêteté : aucune métrique n'est inventée. Les indicateurs non disponibles
 * en base (sources de trafic, benchmark zone, série temporelle, variation
 * période N-1) sont affichés dans une section "Bientôt" plutôt que mockés.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageTabs } from '@/components/ui/page-tabs'
import {
  type AnnuaireStatsPeriod,
  PERIOD_LABELS,
  getAnnuaireStatsSnapshot,
  getClaimedDiagnosticianId,
  isAnnuaireStatsPeriod,
} from '@/lib/annuaire/mock-data'
import { getCurrentUser } from '@/lib/auth/current-user'
import { BarChart3, Eye, FileText, MousePointerClick, Star, TrendingUp } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Statistiques annuaire' }

interface PageProps {
  searchParams: Promise<{ period?: string }>
}

export default async function AnnuaireStatsPage({ searchParams }: PageProps) {
  const { user, supabase } = await getCurrentUser()
  const params = await searchParams
  const period: AnnuaireStatsPeriod = isAnnuaireStatsPeriod(params.period) ? params.period : '30d'

  // biome-ignore lint/suspicious/noExplicitAny: types DB Supabase en attente de régénération (migration 20260628400000)
  const sb = supabase as any
  const diagnosticianId = await getClaimedDiagnosticianId(sb, user.id)

  // Fiche non réclamée → empty state honnête (aucune donnée à afficher).
  if (!diagnosticianId) {
    return (
      <div className="space-y-8 animate-fade-in pb-12">
        <AppPageHeader
          title="Tes"
          accent="statistiques"
          description="Mesure l'impact de ta fiche annuaire : vues, leads reçus et conversion."
        />
        <Card variant="flat" padding="lg">
          <EmptyState
            icon={BarChart3}
            title="Aucune fiche réclamée"
            description="Réclame ta fiche dans l'annuaire pour suivre tes vues, tes leads et ta conversion. Tes statistiques apparaîtront ici une fois la fiche activée."
          />
        </Card>
      </div>
    )
  }

  const snapshot = await getAnnuaireStatsSnapshot(sb, diagnosticianId, period)

  const hasAnyData =
    snapshot.views.value > 0 ||
    snapshot.leads.value > 0 ||
    snapshot.quoteRequests.value > 0 ||
    snapshot.reviewsCount > 0

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <AppPageHeader
        title="Tes"
        accent="statistiques"
        eyebrow={PERIOD_LABELS[period]}
        description="Mesure l'impact de ta fiche annuaire : vues, leads reçus et conversion."
      />

      <PeriodToggle active={period} />

      {hasAnyData ? <KpiGrid snapshot={snapshot} /> : <NoDataYet />}

      <SoonSection />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* TOGGLE PÉRIODE                                                      */
/* ------------------------------------------------------------------ */

function PeriodToggle({ active }: { active: AnnuaireStatsPeriod }) {
  return (
    <PageTabs
      basePath="/dashboard/annuaire/stats"
      paramName="period"
      active={active}
      tabs={[
        { key: '7d', label: '7 jours' },
        { key: '30d', label: '30 jours' },
        { key: '90d', label: '90 jours' },
        { key: '1y', label: '12 mois' },
      ]}
    />
  )
}

/* ------------------------------------------------------------------ */
/* GRILLE KPI                                                          */
/* ------------------------------------------------------------------ */

type Snapshot = Awaited<ReturnType<typeof getAnnuaireStatsSnapshot>>

function KpiGrid({ snapshot }: { snapshot: Snapshot }) {
  const acceptance =
    snapshot.acceptanceRate !== null ? `${snapshot.acceptanceRate.toLocaleString('fr-FR')} %` : '—'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <KpiCard
        icon={<Eye className="size-4" strokeWidth={1.5} />}
        label="Vues de ta fiche"
        value={snapshot.views.value.toLocaleString('fr-FR')}
        note="Total cumulé"
      />
      <KpiCard
        icon={<MousePointerClick className="size-4" strokeWidth={1.5} />}
        label="Leads reçus"
        value={snapshot.leads.value.toLocaleString('fr-FR')}
        note="Sur la période"
      />
      <KpiCard
        icon={<FileText className="size-4" strokeWidth={1.5} />}
        label="Demandes de devis"
        value={snapshot.quoteRequests.value.toLocaleString('fr-FR')}
        note="Total cumulé"
      />
      <KpiCard
        icon={<TrendingUp className="size-4" strokeWidth={1.5} />}
        label="Leads acceptés"
        value={snapshot.acceptedLeads.toLocaleString('fr-FR')}
        note="Sur la période"
      />
      <KpiCard
        icon={<TrendingUp className="size-4" strokeWidth={1.5} />}
        label="Taux d'acceptation"
        value={acceptance}
        note="Acceptés / reçus"
      />
      <KpiCard
        icon={<Star className="size-4" strokeWidth={1.5} />}
        label="Note moyenne"
        value={
          snapshot.averageRating !== null
            ? `${snapshot.averageRating.toLocaleString('fr-FR')} / 5`
            : '—'
        }
        note={`${snapshot.reviewsCount} avis`}
      />
    </div>
  )
}

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  /** Sous-titre factuel (ex: "Total cumulé"). Pas de fausse variation N-1. */
  note: string
}

function KpiCard({ icon, label, value, note }: KpiCardProps) {
  return (
    <Card variant="flat" padding="default" className="space-y-4">
      <div className="flex items-center gap-2 text-ink-mute">
        <span className="text-ink-mute" aria-hidden>
          {icon}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em]">{label}</span>
      </div>
      <div className="space-y-1.5">
        <p className="font-serif italic font-normal text-[44px] md:text-[52px] leading-none tracking-tight text-ink">
          {value}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
          {note}
        </span>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* EMPTY (fiche réclamée mais 0 donnée pour l'instant)                 */
/* ------------------------------------------------------------------ */

function NoDataYet() {
  return (
    <Card variant="flat" padding="lg">
      <EmptyState
        icon={BarChart3}
        title="Pas encore de statistiques"
        description="Ta fiche est active mais n'a pas encore généré de vues ni de leads. Les chiffres apparaîtront dès les premières consultations de ta fiche publique."
      />
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* SECTION "BIENTÔT" — honnêteté sur les métriques pas encore dispo    */
/* ------------------------------------------------------------------ */

function SoonSection() {
  const upcoming = [
    {
      title: 'Sources de trafic',
      description:
        'Répartition Google / annuaire KOVAS / accès direct. Disponible quand le tracking par source sera en place.',
    },
    {
      title: 'Comparaison avec ta zone',
      description:
        'Ton classement face aux diagnostiqueurs de ton département (données anonymisées agrégées).',
    },
    {
      title: 'Évolution dans le temps',
      description:
        'Variation vues et leads vs période précédente. Nécessite un historique de snapshots quotidiens.',
    },
  ]

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-sans font-semibold text-[18px] text-ink leading-tight">
          Bientôt disponible
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          En préparation
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {upcoming.map((item) => (
          <Card key={item.title} variant="flat" padding="default" className="space-y-2 opacity-80">
            <p className="text-[14px] font-semibold text-ink leading-tight">{item.title}</p>
            <p className="text-[12px] text-ink-mute leading-relaxed">{item.description}</p>
          </Card>
        ))}
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint text-center">
        On affiche uniquement des chiffres réels. Ces indicateurs arriveront dès que les données
        seront fiables.
      </p>
    </section>
  )
}
