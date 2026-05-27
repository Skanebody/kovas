/**
 * Top 10 destinataires bouncing — signal pour suspendre l'envoi ou alerter le user.
 */

import { Card } from '@/components/ui/card'
import type { EmailBouncingRecipient } from '@/lib/admin/observability'

interface Props {
  recipients: EmailBouncingRecipient[]
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso)
  const now = Date.now()
  const diffH = (now - date.getTime()) / (1000 * 60 * 60)
  if (diffH < 24) return `${Math.round(diffH)} h`
  return `${Math.round(diffH / 24)} j`
}

export function EmailBouncingRecipientsTable({ recipients }: Props) {
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">
          Top destinataires bouncing
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          30 derniers jours
        </span>
      </div>

      {recipients.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucun bounce sur 30 jours. 🎯</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] tabular-nums">
            <thead>
              <tr className="border-b border-rule/60 text-left text-ink-mute font-mono uppercase tracking-[0.14em] text-[10px]">
                <th className="py-2 pr-3">Destinataire</th>
                <th className="py-2 pr-3 text-right">Bounces</th>
                <th className="py-2 pr-3">Dernier</th>
                <th className="py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.recipient} className="border-b border-rule/30 last:border-0">
                  <td className="py-2 pr-3 font-mono text-[11px] text-ink truncate max-w-[260px]">
                    {r.recipient}
                  </td>
                  <td className="py-2 pr-3 text-right text-danger font-medium">{r.bounces}</td>
                  <td className="py-2 pr-3 text-ink-mute">
                    il y a {formatRelativeDate(r.lastBounceAt)}
                  </td>
                  <td className="py-2">
                    <span
                      className={
                        r.lastEventType === 'bounced'
                          ? 'inline-flex items-center rounded-pill bg-danger/10 text-danger px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider'
                          : 'inline-flex items-center rounded-pill bg-amber/15 text-amber px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider'
                      }
                    >
                      {r.lastEventType === 'bounced' ? 'hard' : 'soft'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
