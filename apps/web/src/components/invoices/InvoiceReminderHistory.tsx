import { Mail } from 'lucide-react'

export interface InvoiceReminderHistoryProps {
  reminderJ7At: string | null
  reminderJ15At: string | null
  reminderJ30At: string | null
}

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

const ITEMS: { key: 'j7' | 'j15' | 'j30'; label: string; subtitle: string }[] = [
  { key: 'j7', label: 'Rappel amical', subtitle: 'J+7 après échéance' },
  { key: 'j15', label: 'Rappel formel', subtitle: 'J+15 après échéance' },
  { key: 'j30', label: 'Mise en demeure', subtitle: 'J+30 — pénalités L441-10' },
]

/**
 * Historique chronologique des 3 relances automatiques envoyées.
 * Affiche "Non envoyé" pour les étapes pas encore atteintes.
 */
export function InvoiceReminderHistory({
  reminderJ7At,
  reminderJ15At,
  reminderJ30At,
}: InvoiceReminderHistoryProps) {
  const sent = {
    j7: reminderJ7At,
    j15: reminderJ15At,
    j30: reminderJ30At,
  }
  const anySent = reminderJ7At || reminderJ15At || reminderJ30At

  if (!anySent) {
    return <div className="text-[13px] text-ink-mute">Aucune relance envoyée pour le moment.</div>
  }

  return (
    <ul className="space-y-2">
      {ITEMS.map((item) => {
        const at = sent[item.key]
        return (
          <li
            key={item.key}
            className="flex items-start gap-3 p-3 rounded-[12px] bg-paper border border-[#0F1419]/[0.06]"
          >
            <div
              className="size-8 rounded-full flex items-center justify-center shrink-0 bg-cream-deep text-ink-mute"
              aria-hidden
            >
              <Mail className="size-4" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-ink">{item.label}</p>
              <p className="text-[11px] text-ink-faint">{item.subtitle}</p>
            </div>
            <div className="text-right">
              {at ? (
                <p className="text-[11px] font-mono text-ink-mute whitespace-nowrap">
                  {formatDateTime(at)}
                </p>
              ) : (
                <p className="text-[11px] font-mono text-ink-faint whitespace-nowrap">Non envoyé</p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
