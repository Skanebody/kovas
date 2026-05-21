/**
 * /admin/churn-risk — utilisateurs à risque, scorés par inactivité + MRR risqué.
 *
 * Critères :
 *   - Risque ÉLEVÉ   : aucune mission depuis 30+ jours
 *   - Risque MODÉRÉ  : aucune mission depuis 14-30 jours
 *   - Risque FAIBLE  : aucune mission depuis 7-14 jours
 *
 * Actions : envoyer un email check-in personnalisé + tagger « à appeler ».
 */

import { ChurnRiskTable } from '@/components/admin/churn-risk/ChurnRiskTable'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { getChurnRiskUsers } from '@/lib/admin/observability'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { AlertTriangle, EuroIcon, ThermometerSun, UserMinus } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Churn risk',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

export default async function AdminChurnRiskPage() {
  const supabase = createAdminClient()
  const users = await getChurnRiskUsers(supabase)

  const high = users.filter((u) => u.riskLevel === 'high')
  const moderate = users.filter((u) => u.riskLevel === 'moderate')
  const low = users.filter((u) => u.riskLevel === 'low')

  const mrrAtRisk = users.reduce((s, u) => s + u.mrrEur, 0)
  const mrrHigh = high.reduce((s, u) => s + u.mrrEur, 0)

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Churn risk · Observabilité
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Comptes à risque.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          Utilisateurs sans mission récente, scorés par inactivité et MRR risqué. La rétention en
          solopreneur passe par un check-in humain au bon moment.
        </p>
      </div>

      {/* KPIs hero */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Métriques churn clés"
      >
        <AdminMetricCard
          eyebrow="MRR à risque"
          value={formatEur(mrrAtRisk)}
          hint={`${formatInt(users.length)} comptes flagués`}
          icon={EuroIcon}
        />
        <AdminMetricCard
          eyebrow="Risque élevé"
          value={formatInt(high.length)}
          hint={`${formatEur(mrrHigh)} MRR · 30+ j d'inactivité`}
          icon={AlertTriangle}
        />
        <AdminMetricCard
          eyebrow="Risque modéré"
          value={formatInt(moderate.length)}
          hint="14-30 j d'inactivité"
          icon={ThermometerSun}
        />
        <AdminMetricCard
          eyebrow="Risque faible"
          value={formatInt(low.length)}
          hint="7-14 j d'inactivité"
          icon={UserMinus}
        />
      </section>

      {/* Table */}
      <section aria-label="Liste des utilisateurs à risque">
        <ChurnRiskTable users={users} />
      </section>

      {/* Note méthodologie */}
      <section aria-label="Note méthodologie" className="text-xs text-ink-faint">
        <p>
          Les utilisateurs en essai (statut <code className="font-mono">trialing</code>) sans
          activité après 7 jours sont également flagués. Le MRR affiché est celui du plan public —
          les Founders à vie sont comptés à leur tarif réel (49€/mo Standard, 169€/mo Cabinet).
        </p>
      </section>
    </div>
  )
}
