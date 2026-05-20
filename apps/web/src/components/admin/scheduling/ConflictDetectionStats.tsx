/**
 * ConflictDetectionStats — affichage agrégé conflits détectés vs résolus.
 *
 * V1 : la table d'events scheduling n'existe pas encore, on affiche les totaux
 * estimés sur les 30 derniers jours (cf. getConflictDetectionStats).
 * V2 : remplacer par un vrai tableau ligne-par-ligne issu d'une table
 * `scheduling_events` avec date / user / conflict_type / resolved.
 */

import { Card } from '@/components/ui/card'
import type { ConflictCount } from '@/lib/admin/scheduling-metrics'

export interface ConflictDetectionStatsProps {
  conflicts: ConflictCount
}

export function ConflictDetectionStats({ conflicts }: ConflictDetectionStatsProps) {
  const total = conflicts.detected
  const rate = total > 0 ? Math.round((conflicts.resolved / total) * 1000) / 10 : 0

  return (
    <Card variant="opaque" padding="default">
      <header className="mb-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Conflits scheduling · 30 jours
        </p>
        <h2 className="font-serif italic text-3xl text-ink mt-1">Détection & résolution.</h2>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule/60">
              <th className="py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                Période
              </th>
              <th className="py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                Détectés
              </th>
              <th className="py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                Résolus
              </th>
              <th className="py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                Taux
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-rule/30">
              <td className="py-3 text-ink">30 derniers jours</td>
              <td className="py-3 text-right font-mono text-ink">{conflicts.detected}</td>
              <td className="py-3 text-right font-mono text-ink">{conflicts.resolved}</td>
              <td className="py-3 text-right font-mono text-ink">{rate}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] text-ink-faint">
        V1 : estimation à partir des dossiers planifiés. V2 : tracking direct via table
        scheduling_events.
      </p>
    </Card>
  )
}
