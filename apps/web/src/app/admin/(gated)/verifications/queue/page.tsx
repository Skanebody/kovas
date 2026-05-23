import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { VerificationQueueTable } from '@/components/admin/verification/VerificationQueueTable'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import {
  type QueueFilter,
  fetchVerificationKpis,
  fetchVerificationQueue,
} from '@/lib/admin/verification-queue'
import { AlertTriangle, CheckCircle2, Clock, Eye } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'File de modération vérifications',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ filter?: string }>
}

function parseFilter(value: string | undefined): QueueFilter {
  switch (value) {
    case 'pending':
    case 'in_review':
    case 'rejected':
    case 'signalement_threshold':
      return value
    default:
      return 'all'
  }
}

export default async function VerificationsQueuePage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filter = parseFilter(sp.filter)

  const supabase = createAdminClient()

  const [kpis, queue] = await Promise.all([
    fetchVerificationKpis(supabase),
    fetchVerificationQueue(supabase, { filter, limit: 200 }),
  ])

  const rows = queue.map((r) => ({
    id: r.id,
    fullName: r.full_name?.trim() || 'Sans nom',
    city: r.city,
    overallStatus: r.overall_status,
    badgeLevel: r.badge_level,
    identityStatus: r.identity_status,
    cofracStatus: r.cofrac_status,
    rcproStatus: r.rcpro_status,
    sireneStatus: r.sirene_status,
    signalementsCount: r.signalements_count ?? 0,
    priority: r.manual_review_priority ?? 0,
    lastActivity: r.last_activity_at,
  }))

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Modération · Doctolib 2022 lessons
        </p>
        <h1 className="text-2xl font-display font-bold text-ink mt-1">
          File de vérification diagnostiqueurs
        </h1>
        <p className="text-sm text-ink-mute mt-1 max-w-3xl">
          Cette file regroupe les diagnostiqueurs en attente de validation des 4 phases (identité,
          COFRAC, RC Pro, SIRENE) ainsi que ceux qui nécessitent un audit manuel (signalements ou
          alerte critique). Tant qu'un diagnostiqueur n'est pas validé, sa fiche n'apparaît jamais
          dans l'annuaire public.
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminMetricCard
          eyebrow="Total en attente"
          value={kpis.totalPending.toString()}
          hint="overall_status=pending"
          icon={Clock}
        />
        <AdminMetricCard
          eyebrow="Critique (priorité ≥ 50)"
          value={kpis.totalCritical.toString()}
          hint="manual_review_priority"
          icon={AlertTriangle}
        />
        <AdminMetricCard
          eyebrow="À examiner manuellement"
          value={kpis.totalInReview.toString()}
          hint="phase = in_review"
          icon={Eye}
        />
        <AdminMetricCard
          eyebrow="Validés aujourd'hui"
          value={kpis.validatedToday.toString()}
          hint="overall_status=verified · 24h"
          icon={CheckCircle2}
        />
      </div>

      {/* Table */}
      <VerificationQueueTable rows={rows} currentFilter={filter} />
    </div>
  )
}
