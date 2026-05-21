/**
 * Timeline réutilisable de documents réglementaires.
 *
 * Server component pur : reçoit déjà les items + map des notif non lues.
 * Cliquer ouvre /app/veille/[id].
 */

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  DOC_TYPE_LABEL,
  IMPORTANCE_BADGE,
  IMPORTANCE_LABEL,
  MODULE_LABEL,
  type RegulatoryDocumentListItem,
  type RegulatoryModule,
} from '@/lib/regulatory/types'
import Link from 'next/link'

interface RegulatoryTimelineProps {
  items: RegulatoryDocumentListItem[]
  /** Set des document_id que le user n'a pas encore lus. */
  unreadDocIds?: Set<string>
  emptyMessage?: string
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function moduleLabel(topic: string): string {
  return (MODULE_LABEL as Record<string, string>)[topic] ?? topic
}

export function RegulatoryTimeline({
  items,
  unreadDocIds,
  emptyMessage = 'Aucun document à afficher.',
}: RegulatoryTimelineProps) {
  if (items.length === 0) {
    return (
      <Card variant="flat" padding="default">
        <p className="text-sm text-ink-mute">{emptyMessage}</p>
      </Card>
    )
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => {
        const isUnread = unreadDocIds?.has(item.id) ?? false
        const importanceVariant = IMPORTANCE_BADGE[item.importance]
        // On affiche les modules effectivement matchés dans topics.
        const moduleTags = item.topics.filter((t): t is RegulatoryModule =>
          ['dpe', 'amiante', 'plomb', 'gaz', 'electricite', 'termites', 'carrez', 'erp'].includes(t),
        )
        return (
          <li key={item.id}>
            <Link
              href={`/dashboard/veille/${item.id}`}
              className="block focus:outline-none focus-visible:ring-4 focus-visible:ring-navy/15 rounded-lg"
            >
              <Card
                variant="flat"
                padding="sm"
                className="hover:-translate-y-px transition-transform duration-fast"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 text-right min-w-[88px] pt-0.5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                      {DOC_TYPE_LABEL[item.doc_type]}
                    </p>
                    <p className="text-[12px] text-ink-mute mt-0.5">
                      {formatDate(item.published_at)}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start gap-2 flex-wrap">
                      {isUnread && (
                        <Badge variant="amber" className="shrink-0">
                          À lire
                        </Badge>
                      )}
                      <Badge variant={importanceVariant} className="shrink-0">
                        {IMPORTANCE_LABEL[item.importance]}
                      </Badge>
                      <h3 className="text-[15px] font-semibold text-ink leading-snug">
                        {item.title}
                      </h3>
                    </div>
                    {item.ai_summary && (
                      <p className="text-[13px] text-ink-mute leading-relaxed line-clamp-3">
                        {item.ai_summary}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {moduleTags.slice(0, 6).map((m) => (
                        <Badge key={m} variant="outline" className="text-[10px]">
                          {moduleLabel(m)}
                        </Badge>
                      ))}
                      {item.source && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint ml-auto">
                          {item.source.authority}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
