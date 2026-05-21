/**
 * <PrescriberCard> — card prescripteur réutilisable (vue compacte).
 */

import { Card } from '@/components/ui/card'
import {
  PRESCRIBER_TIER_BADGE_CLASS,
  PRESCRIBER_TIER_LABELS,
  type PrescriberRowWithContact,
  isSilent,
} from '@/lib/prescribers/types'
import { cn } from '@/lib/utils'
import { AlertTriangle, Mail, Phone } from 'lucide-react'

interface Props {
  row: PrescriberRowWithContact
  className?: string
  onCall?: () => void
  onEmail?: () => void
}

function formatRevenue(eur: number): string {
  return `${Math.round(eur).toLocaleString('fr-FR')} €`
}

function formatLastMission(iso: string | null): string {
  if (!iso) return 'Jamais'
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 30) return `${days} jours`
  return `${Math.floor(days / 30)} mois`
}

export function PrescriberCard({ row, className, onCall, onEmail }: Props) {
  const silent = isSilent(row)
  const contactName = row.contact?.display_name ?? '— Sans nom —'

  return (
    <Card variant="flat" padding="default" className={cn('space-y-3', className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-sans font-semibold text-[15px] text-ink truncate">{contactName}</p>
          <p className="text-[11px] font-mono text-ink-mute mt-0.5">
            {row.contact?.company_name ?? row.contact?.kind ?? 'Prescripteur'}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-pill border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]',
            PRESCRIBER_TIER_BADGE_CLASS[row.tier],
          )}
        >
          {PRESCRIBER_TIER_LABELS[row.tier]}
        </span>
      </header>

      <div className="grid grid-cols-3 gap-3 text-[11px] font-mono">
        <div>
          <p className="text-ink-faint uppercase tracking-[0.08em]">CA 12m</p>
          <p className="text-ink font-semibold tabular-nums">
            {formatRevenue(row.revenue_12m_eur)}
          </p>
        </div>
        <div>
          <p className="text-ink-faint uppercase tracking-[0.08em]">Missions</p>
          <p className="text-ink font-semibold tabular-nums">{row.missions_12m_count}</p>
        </div>
        <div>
          <p className="text-ink-faint uppercase tracking-[0.08em]">Dernière</p>
          <p className={cn('font-semibold tabular-nums', silent ? 'text-accent-red' : 'text-ink')}>
            {formatLastMission(row.last_mission_at)}
          </p>
        </div>
      </div>

      {silent ? (
        <div className="flex items-center gap-2 rounded-md border border-accent-red/30 bg-accent-red/10 px-3 py-1.5">
          <AlertTriangle className="size-3.5 text-accent-red" />
          <p className="text-[11px] text-accent-red">
            Silencieux depuis {row.silent_since_days} jours — relance recommandée.
          </p>
        </div>
      ) : null}

      <footer className="flex items-center gap-2 pt-2 border-t border-rule/40">
        {row.contact?.phone ? (
          <button
            type="button"
            onClick={onCall}
            className="inline-flex items-center gap-1.5 rounded-pill border border-rule bg-paper px-2.5 py-1 text-[11px] font-medium text-ink-mute hover:text-ink"
          >
            <Phone className="size-3" />
            Programmer un appel
          </button>
        ) : null}
        {row.contact?.email ? (
          <button
            type="button"
            onClick={onEmail}
            className="inline-flex items-center gap-1.5 rounded-pill border border-rule bg-paper px-2.5 py-1 text-[11px] font-medium text-ink-mute hover:text-ink"
          >
            <Mail className="size-3" />
            Envoyer email
          </button>
        ) : null}
      </footer>
    </Card>
  )
}
