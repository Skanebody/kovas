/**
 * Liste des 10 derniers feedbacks (depuis support_tickets en V1).
 *
 * Pas de rating dédié : la table support_tickets n'a pas de colonne `rating`
 * en V1. TODO V2 : créer une table `feedback` séparée ou ajouter colonne.
 */

import { Card } from '@/components/ui/card'
import type { RecentFeedbackRow } from '@/lib/admin/product-analytics'

const STATUS_LABEL: Record<string, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  waiting_user: 'Attente user',
  resolved: 'Résolu',
  closed: 'Fermé',
}

const STATUS_TONE: Record<string, string> = {
  open: 'bg-blue-mist text-[#1E3A8A]',
  in_progress: 'bg-orange-mist text-[#7C3F0A]',
  waiting_user: 'bg-cream-deep text-ink-mute',
  resolved: 'bg-lime-mist text-[#2D4015]',
  closed: 'bg-ink/10 text-ink-mute',
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'low',
  normal: 'normal',
  high: 'high',
  critical: 'critical',
}

const PRIORITY_TONE: Record<string, string> = {
  low: 'text-ink-faint',
  normal: 'text-ink-mute',
  high: 'text-[#7C3F0A]',
  critical: 'text-[#8B1414]',
}

function relativeTime(iso: string): string {
  const now = Date.now()
  const ts = new Date(iso).getTime()
  const diffMs = now - ts
  if (diffMs < 60_000) return 'à l’instant'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `il y a ${days} j`
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(ts))
}

export interface FeedbackListProps {
  rows: RecentFeedbackRow[]
}

export function FeedbackList({ rows }: FeedbackListProps) {
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Feedback récents · support tickets
          </h2>
          <p className="text-[12px] text-ink-mute mt-0.5">
            Source : table support_tickets. Rating dédié à venir V2 (colonne dédiée).
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {rows.length} entrée{rows.length > 1 ? 's' : ''}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">
          Aucun ticket de support pour le moment — la KB IA-first absorbe peut-être tout.
        </p>
      ) : (
        <ul className="divide-y divide-rule/40">
          {rows.map((row) => (
            <li key={row.id} className="py-2.5 flex items-start gap-3">
              <span
                className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                  STATUS_TONE[row.status] ?? 'bg-ink/10 text-ink'
                }`}
              >
                {STATUS_LABEL[row.status] ?? row.status}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-ink truncate" title={row.subject}>
                  {row.subject}
                </p>
                <p className="font-mono text-[10px] text-ink-faint mt-0.5">
                  {row.priority ? (
                    <span className={PRIORITY_TONE[row.priority] ?? ''}>
                      {PRIORITY_LABEL[row.priority] ?? row.priority} ·{' '}
                    </span>
                  ) : null}
                  org {row.orgId.slice(0, 8)} · {relativeTime(row.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
