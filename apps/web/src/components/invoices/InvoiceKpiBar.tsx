import { cn } from '@/lib/utils'

export interface InvoiceKpiBarProps {
  /** Total HT du mois en cours (en euros) */
  monthHtEur: number
  /** Encaissé du mois en cours (en euros) */
  monthCollectedEur: number
  /** Nombre de factures en retard */
  overdueCount: number
  /** Montant total en retard (en euros) */
  overdueAmountEur: number
  /** Nombre d'échéances < 7 jours */
  upcomingCount: number
  className?: string
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
}) {
  return (
    <div className="flex-1 min-w-[140px] p-4 rounded-[14px] bg-paper border border-[#0F1419]/[0.06]">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute mb-1.5">
        {label}
      </p>
      <p
        className={cn(
          'font-serif italic font-normal text-[28px] leading-none tracking-tight',
          tone === 'success' && 'text-[#1F7A3A]',
          tone === 'warning' && 'text-[#A66100]',
          tone === 'danger' && 'text-[#8B1414]',
          (!tone || tone === 'default') && 'text-ink',
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-[11px] text-ink-faint mt-1.5">{hint}</p> : null}
    </div>
  )
}

/**
 * Barre KPI en tête de la liste factures.
 * 4 KPI : Total HT mois / Encaissé / En retard / Échéances proches.
 *
 * DS v5 : cards plates `bg-paper`, KPI hero Instrument Serif italic, mono labels.
 */
export function InvoiceKpiBar({
  monthHtEur,
  monthCollectedEur,
  overdueCount,
  overdueAmountEur,
  upcomingCount,
  className,
}: InvoiceKpiBarProps) {
  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      <Kpi label="Total HT (ce mois)" value={formatEur(monthHtEur)} hint="Factures émises" />
      <Kpi
        label="Encaissé (ce mois)"
        value={formatEur(monthCollectedEur)}
        hint="Paiements reçus"
        tone="success"
      />
      <Kpi
        label="En retard"
        value={formatEur(overdueAmountEur)}
        hint={`${overdueCount} facture${overdueCount > 1 ? 's' : ''}`}
        tone={overdueCount > 0 ? 'danger' : 'default'}
      />
      <Kpi
        label="Échéances < 7 j"
        value={String(upcomingCount)}
        hint={upcomingCount > 0 ? 'À surveiller' : 'Aucune urgence'}
        tone={upcomingCount > 0 ? 'warning' : 'default'}
      />
    </div>
  )
}
