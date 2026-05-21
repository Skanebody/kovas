/**
 * Panneau "Évolutions à venir" (colonne droite de la page veille).
 *
 * Documents avec effective_at > now() triés par date, compte à rebours
 * visuel + section "Préparation requise" (regroupe les actions inférées
 * du texte ai_summary — V1 simple).
 */

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  DOC_TYPE_LABEL,
  IMPORTANCE_BADGE,
  IMPORTANCE_LABEL,
  type RegulatoryDocumentListItem,
} from '@/lib/regulatory/types'
import Link from 'next/link'

interface UpcomingChangesPanelProps {
  items: RegulatoryDocumentListItem[]
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return null
  return Math.max(0, Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24)))
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function UpcomingChangesPanel({ items }: UpcomingChangesPanelProps) {
  return (
    <aside className="space-y-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint mb-2">
          Évolutions à venir
        </p>
        <h2 className="font-serif italic text-2xl text-ink leading-tight">À préparer.</h2>
      </div>

      {items.length === 0 ? (
        <Card variant="flat" padding="sm">
          <p className="text-[12px] text-ink-mute">
            Aucune évolution à date d'entrée en vigueur future détectée.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => {
            const days = daysUntil(item.effective_at)
            return (
              <li key={item.id}>
                <Link
                  href={`/app/veille/${item.id}`}
                  className="block focus:outline-none focus-visible:ring-4 focus-visible:ring-navy/15 rounded-lg"
                >
                  <Card
                    variant="flat"
                    padding="sm"
                    className="hover:-translate-y-px transition-transform duration-fast"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                        {DOC_TYPE_LABEL[item.doc_type]}
                      </span>
                      <Badge variant={IMPORTANCE_BADGE[item.importance]} className="text-[10px]">
                        {IMPORTANCE_LABEL[item.importance]}
                      </Badge>
                    </div>
                    <p className="text-[13px] font-semibold text-ink leading-snug mb-2 line-clamp-2">
                      {item.title}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif italic text-3xl text-ink leading-none">
                        {days !== null ? days : '—'}
                      </span>
                      <span className="text-[11px] text-ink-mute">
                        {days !== null
                          ? `jour${days > 1 ? 's' : ''} • ${formatDate(item.effective_at)}`
                          : formatDate(item.effective_at)}
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {items.length > 0 && (
        <Card variant="warm" padding="sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-1.5">
            Préparation requise
          </p>
          <p className="text-[12px] text-ink leading-relaxed">
            Vérifiez l'impact sur vos missions en cours et anticipez les ajustements
            de rapport avant la date d'entrée en vigueur.
          </p>
        </Card>
      )}
    </aside>
  )
}
