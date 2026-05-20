/**
 * Timeline des 10 dernières actions du user (missions, dossiers, audit).
 */

import { Card } from '@/components/ui/card'
import type { UserActivityEvent } from '@/lib/admin/users-types'
import { Activity, FileText, FolderClosed, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface UserActivityProps {
  events: UserActivityEvent[]
}

const KIND_ICONS: Record<UserActivityEvent['kind'], LucideIcon> = {
  dossier_created: FolderClosed,
  mission_created: FileText,
  mission_completed: FileText,
  admin_action: ShieldCheck,
  audit: Activity,
}

function relativeTime(iso: string): string {
  const now = Date.now()
  const ts = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000))
  if (diffSec < 60) return "à l'instant"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `il y a ${diffD} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export function UserActivity({ events }: UserActivityProps) {
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Activité récente</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          10 dernières
        </span>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucune activité enregistrée.</p>
      ) : (
        <ul className="space-y-2" aria-label="Événements récents">
          {events.map((e) => {
            const Icon = KIND_ICONS[e.kind] ?? Activity
            return (
              <li
                key={e.id}
                className="flex items-start gap-3 rounded-md px-2.5 py-2 hover:bg-ink/[0.03] transition-colors"
              >
                <div className="mt-0.5 size-7 rounded-md bg-ink/5 flex items-center justify-center shrink-0">
                  <Icon className="size-3.5 text-ink-mute" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-ink leading-tight truncate">
                    {e.title}
                    {e.subtitle ? <span className="text-ink-mute"> · {e.subtitle}</span> : null}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint mt-0.5">
                    {relativeTime(e.occurred_at)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
