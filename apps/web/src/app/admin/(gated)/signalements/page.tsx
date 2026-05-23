import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { SignalementsTable } from '@/components/admin/verification/SignalementsTable'
import {
  type SignalementFilter,
  fetchSignalementKpis,
  fetchSignalements,
} from '@/lib/admin/signalements'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { AlertCircle, AlertTriangle, ShieldOff, XCircle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Signalements diagnostiqueurs',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ filter?: string }>
}

function parseFilter(value: string | undefined): SignalementFilter {
  switch (value) {
    case 'new':
    case 'investigating':
    case 'confirmed_fraud':
    case 'dismissed':
      return value
    default:
      return 'all'
  }
}

export default async function SignalementsAdminPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filter = parseFilter(sp.filter)

  const supabase = createAdminClient()
  const [kpis, signalements] = await Promise.all([
    fetchSignalementKpis(supabase),
    fetchSignalements(supabase, filter, 200),
  ])

  const rows = signalements.map((s) => ({
    id: s.id,
    diagnosticianId: s.diagnostician_id,
    diagnosticianName: s.diagnostician_name,
    diagnosticianCity: s.diagnostician_city,
    reporterEmail: s.reporter_email,
    reason: s.reason,
    description: s.description,
    status: s.status,
    createdAt: s.created_at,
  }))

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Modération · Signalements particuliers
        </p>
        <h1 className="text-2xl font-display font-bold text-ink mt-1">
          Signalements diagnostiqueurs
        </h1>
        <p className="text-sm text-ink-mute mt-1 max-w-3xl">
          File des signalements remontés par les particuliers ou détectés automatiquement par le
          système. Au-delà de 3 signalements en 6 mois, un audit manuel est automatiquement
          déclenché et le diagnostiqueur peut être suspendu temporairement.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminMetricCard
          eyebrow="Nouveaux"
          value={kpis.totalNew.toString()}
          hint="status=new"
          icon={AlertCircle}
        />
        <AdminMetricCard
          eyebrow="En cours"
          value={kpis.totalInvestigating.toString()}
          hint="status=investigating"
          icon={AlertTriangle}
        />
        <AdminMetricCard
          eyebrow="Fraude confirmée"
          value={kpis.totalConfirmedFraud.toString()}
          hint="status=confirmed_fraud"
          icon={ShieldOff}
        />
        <AdminMetricCard
          eyebrow="Écartés"
          value={kpis.totalDismissed.toString()}
          hint="status=dismissed"
          icon={XCircle}
        />
      </div>

      <SignalementsTable rows={rows} currentFilter={filter} />
    </div>
  )
}
