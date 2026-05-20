/**
 * Liste compacte des 5 derniers dossiers du user (lien vers /app/dossiers/[id]
 * désactivé V1 puisqu'on est dans l'admin — on affiche juste la donnée).
 */

import { Card } from '@/components/ui/card'
import type { UserDossierSummary } from '@/lib/admin/users-types'

interface UserDossiersListProps {
  dossiers: UserDossierSummary[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
}

export function UserDossiersList({ dossiers }: UserDossiersListProps) {
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Derniers dossiers</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          5 plus récents
        </span>
      </div>
      {dossiers.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucun dossier créé.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-rule">
                <th
                  scope="col"
                  className="pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium"
                >
                  Référence
                </th>
                <th
                  scope="col"
                  className="pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium"
                >
                  Adresse
                </th>
                <th
                  scope="col"
                  className="pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium"
                >
                  Statut
                </th>
                <th
                  scope="col"
                  className="pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium"
                >
                  Créé le
                </th>
              </tr>
            </thead>
            <tbody>
              {dossiers.map((d) => (
                <tr key={d.id} className="border-b border-rule/40 last:border-0">
                  <td className="py-2 font-mono text-[12px] text-ink">{d.reference}</td>
                  <td className="py-2 text-[12px] text-ink-mute truncate max-w-[260px]">
                    {d.property_address ?? <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="py-2 text-[12px] text-ink">{d.status}</td>
                  <td className="py-2 text-[11px] text-ink-mute font-mono">
                    {formatDate(d.created_at)}
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
