'use client'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { cn } from '@/lib/utils'
import type { LeadItem } from './leads-types'

interface LeadsQueueSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leads: LeadItem[]
  currentLeadId: string | null
  onSelect: (leadId: string) => void
}

const MONTH_SHORT_FR = [
  'jan',
  'fév',
  'mar',
  'avr',
  'mai',
  'juin',
  'juil',
  'août',
  'sep',
  'oct',
  'nov',
  'déc',
]

function formatReceived(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const day = d.getDate()
  const month = MONTH_SHORT_FR[d.getMonth()] ?? ''
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month} · ${hours}h${minutes}`
}

/**
 * BottomSheet "Voir la file" — liste compacte de tous les leads en attente.
 * Mode panorama secondaire au mode focal (qui n'affiche qu'un lead).
 * Click ligne → bascule sur ce lead en focal mode + ferme le sheet.
 */
export function LeadsQueueSheet({
  open,
  onOpenChange,
  leads,
  currentLeadId,
  onSelect,
}: LeadsQueueSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="File d'attente"
      description={`${leads.length} lead${leads.length > 1 ? 's' : ''} en attente`}
    >
      {leads.length === 0 ? (
        <p className="text-center text-[14px] text-ink-mute py-6">Aucun lead en attente.</p>
      ) : (
        <ul className="divide-y divide-rule/30">
          {leads.map((l) => {
            const isCurrent = l.id === currentLeadId
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => onSelect(l.id)}
                  className={cn(
                    'w-full flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg text-left transition-colors duration-fast',
                    isCurrent ? 'bg-ink/5' : 'hover:bg-ink/5',
                  )}
                >
                  <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-ink-mute w-[88px] shrink-0 tabular-nums">
                    {formatReceived(l.receivedAt)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[14px] font-medium text-ink truncate">
                      {l.propertyCity || l.clientDisplayName}
                    </span>
                    <span className="block text-[12px] text-ink-mute truncate">
                      {l.propertyAddress}
                    </span>
                  </div>
                  {isCurrent ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute shrink-0">
                      En cours
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </BottomSheet>
  )
}
