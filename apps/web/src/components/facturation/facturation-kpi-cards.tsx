import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  Archive,
  Banknote,
  CheckCircle2,
  Clock,
  FileX2,
  Hourglass,
  Package,
} from 'lucide-react'
import { formatEur } from './format'
import type { DevisKpi, FacturationTab, FactureKpi, TarifKpi } from './types'

interface KpiCardItem {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  tone: 'neutral' | 'positive' | 'warning' | 'danger'
}

const TONE_BG: Record<KpiCardItem['tone'], string> = {
  neutral: 'bg-ink/5 text-ink-mute',
  positive: 'bg-lime-mist text-[#2D4015]',
  warning: 'bg-orange-mist text-[#7C3F0A]',
  danger: 'bg-coral-mist text-[#8B1414]',
}

function KpiMiniCard({ item }: { item: KpiCardItem }) {
  const Icon = item.icon
  return (
    <Card variant="opaque" padding="sm" className="flex items-start gap-3">
      <span
        aria-hidden
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-md',
          TONE_BG[item.tone],
        )}
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-ink-mute font-mono">{item.label}</p>
        <p className="font-serif italic text-2xl text-ink leading-tight mt-0.5">{item.value}</p>
        {item.hint ? <p className="text-[11px] text-ink-faint mt-0.5">{item.hint}</p> : null}
      </div>
    </Card>
  )
}

interface FacturationKpiCardsProps {
  current: FacturationTab
  devisKpi: DevisKpi
  factureKpi: FactureKpi
  tarifKpi: TarifKpi
}

/**
 * 4 mini-cards résumé contextuelles selon l'onglet courant.
 * - Devis : en attente / acceptés mois / refusés / total
 * - Factures : impayées / payées mois / en retard / CA HT mois
 * - Tarifs : actifs / archivés / utilisations / révision (placeholder)
 */
export function FacturationKpiCards({
  current,
  devisKpi,
  factureKpi,
  tarifKpi,
}: FacturationKpiCardsProps) {
  let items: KpiCardItem[]

  if (current === 'devis') {
    items = [
      {
        label: 'En attente',
        value: String(devisKpi.pendingCount),
        hint: 'Devis envoyés sans réponse',
        icon: Clock,
        tone: 'warning',
      },
      {
        label: 'Acceptés ce mois',
        value: String(devisKpi.acceptedMonthCount),
        hint: 'Conversion → factures à émettre',
        icon: CheckCircle2,
        tone: 'positive',
      },
      {
        label: 'Refusés',
        value: String(devisKpi.refusedCount),
        hint: 'Sur la période courante',
        icon: FileX2,
        tone: 'danger',
      },
      {
        label: 'Total',
        value: String(devisKpi.totalCount),
        hint: 'Tous statuts confondus',
        icon: Package,
        tone: 'neutral',
      },
    ]
  } else if (current === 'factures') {
    items = [
      {
        label: 'Impayées',
        value: String(factureKpi.unpaidCount),
        hint: 'En attente ou émises',
        icon: Hourglass,
        tone: 'warning',
      },
      {
        label: 'Payées ce mois',
        value: String(factureKpi.paidMonthCount),
        hint: 'Encaissement confirmé',
        icon: CheckCircle2,
        tone: 'positive',
      },
      {
        label: 'En retard',
        value: String(factureKpi.overdueCount),
        hint: 'Échéance dépassée',
        icon: AlertCircle,
        tone: 'danger',
      },
      {
        label: 'CA HT ce mois',
        value: formatEur(factureKpi.revenueMonthCents),
        hint: 'Encaissements 30 derniers jours',
        icon: Banknote,
        tone: 'neutral',
      },
    ]
  } else {
    items = [
      {
        label: 'Produits actifs',
        value: String(tarifKpi.activeCount),
        hint: 'Disponibles dans devis/factures',
        icon: Package,
        tone: 'positive',
      },
      {
        label: 'Archivés',
        value: String(tarifKpi.archivedCount),
        hint: 'Masqués du catalogue',
        icon: Archive,
        tone: 'neutral',
      },
      {
        label: 'Utilisations',
        value: '111',
        hint: 'Sur 90 derniers jours',
        icon: CheckCircle2,
        tone: 'neutral',
      },
      {
        label: 'Dernière révision',
        value: '12 j',
        hint: 'Mise à jour catalogue',
        icon: Clock,
        tone: 'neutral',
      },
    ]
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((it) => (
        <KpiMiniCard key={it.label} item={it} />
      ))}
    </div>
  )
}
