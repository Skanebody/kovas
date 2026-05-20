/**
 * UserSpeedTable — table 4 cols : user / coefficient / sample_size / vs avg.
 *
 * Source : `user_duration_coefficients.global_coefficient`.
 *   - coef = 1.0 → vitesse moyenne
 *   - coef < 1.0 → plus rapide que moyenne (vert)
 *   - coef > 1.0 → plus lent que moyenne (orange)
 */

import { Card } from '@/components/ui/card'
import type { UserSpeedRow } from '@/lib/admin/scheduling-metrics'
import { cn } from '@/lib/utils'

export interface UserSpeedTableProps {
  rows: UserSpeedRow[]
}

function vsAverageClass(vs: number): string {
  if (vs < -5) return 'text-success'
  if (vs > 5) return 'text-warning'
  return 'text-ink-mute'
}

function vsAverageLabel(vs: number): string {
  if (vs === 0) return '0%'
  const sign = vs > 0 ? '+' : ''
  return `${sign}${vs.toFixed(1)}%`
}

function emailShort(email: string | null, userId: string): string {
  if (!email) return `${userId.slice(0, 8)}…`
  const at = email.indexOf('@')
  if (at === -1) return email
  return email.slice(0, Math.min(at, 28))
}

export function UserSpeedTable({ rows }: UserSpeedTableProps) {
  return (
    <Card variant="opaque" padding="default">
      <header className="mb-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Coefficients personnels · users actifs
        </p>
        <h2 className="font-serif italic text-3xl text-ink mt-1">Vitesse par user.</h2>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-mute py-8 text-center">
          Aucun coefficient calibré pour l'instant (min. 10 missions par user).
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule/60">
                <th className="py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                  User
                </th>
                <th className="py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                  Coefficient
                </th>
                <th className="py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                  Missions
                </th>
                <th className="py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                  vs moyenne
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.userId}
                  className={cn('border-b border-rule/30', !row.enabled && 'opacity-60')}
                >
                  <td className="py-3 text-ink">
                    <span className="block">{emailShort(row.userEmail, row.userId)}</span>
                    {!row.enabled ? (
                      <span className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">
                        désactivé
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 text-right font-mono text-ink">
                    {row.globalCoefficient.toFixed(3)}
                  </td>
                  <td className="py-3 text-right font-mono text-ink-mute">{row.sampleSize}</td>
                  <td className={cn('py-3 text-right font-mono', vsAverageClass(row.vsAverage))}>
                    {vsAverageLabel(row.vsAverage)}
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
