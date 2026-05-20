/**
 * Grid de 6 metric cards pour la fiche détaillée user.
 */

import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import type { UserDetailMetrics } from '@/lib/admin/users-types'
import { Banknote, Bot, FileText, FolderClosed, ImageIcon, Star } from 'lucide-react'

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatEurDecimal(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(amount)
}

interface UserMetricsProps {
  metrics: UserDetailMetrics
}

export function UserMetrics({ metrics }: UserMetricsProps) {
  return (
    <section
      aria-label="Métriques utilisateur"
      className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    >
      <AdminMetricCard
        eyebrow="Revenue total"
        value={formatEur(metrics.lifetime_revenue_cents / 100)}
        hint="Cumul factures payées"
        icon={Banknote}
      />
      <AdminMetricCard
        eyebrow="Missions ce mois"
        value={String(metrics.missions_this_month)}
        hint="Mois courant Europe/Paris"
        icon={FileText}
      />
      <AdminMetricCard
        eyebrow="Dossiers total"
        value={String(metrics.dossiers_total)}
        hint="Tous statuts confondus"
        icon={FolderClosed}
      />
      <AdminMetricCard
        eyebrow="Photos"
        value={String(metrics.photos_total)}
        hint="Toutes orgs primaires"
        icon={ImageIcon}
      />
      <AdminMetricCard
        eyebrow="Coût IA ce mois"
        value={formatEurDecimal(metrics.ai_cost_this_month_eur)}
        hint="Claude + Whisper + Deepgram"
        icon={Bot}
      />
      <AdminMetricCard
        eyebrow="NPS"
        value={metrics.nps_score !== null ? String(metrics.nps_score) : '—'}
        hint={metrics.nps_score !== null ? 'Dernier sondage' : 'Pas encore collecté'}
        icon={Star}
      />
    </section>
  )
}
