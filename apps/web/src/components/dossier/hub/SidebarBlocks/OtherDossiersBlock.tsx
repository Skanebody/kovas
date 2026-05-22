import { Card } from '@/components/ui/card'
import { StatusPill } from '@/components/ui/status-pill'
import { resolveDossierState, getStatusPillProps } from '@/lib/dossier/states'
import { Folder } from 'lucide-react'
import Link from 'next/link'

export interface OtherDossier {
  id: string
  reference: string
  status: string
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  metadata: Record<string, unknown> | null
  address: string | null
}

interface OtherDossiersBlockProps {
  dossiers: ReadonlyArray<OtherDossier>
}

/**
 * Bloc sidebar — Autres dossiers du même client.
 */
export function OtherDossiersBlock({ dossiers }: OtherDossiersBlockProps) {
  const sorted = [...dossiers]
    .sort((a, b) => {
      const aD = a.scheduled_at ?? a.completed_at ?? ''
      const bD = b.scheduled_at ?? b.completed_at ?? ''
      return bD > aD ? 1 : -1
    })
    .slice(0, 4)

  return (
    <Card variant="flat" padding="sm" className="space-y-3">
      <div className="flex items-center gap-2">
        <Folder className="size-3.5 text-ink-mute" />
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
          Autres dossiers du client
        </p>
      </div>

      {sorted.length > 0 ? (
        <ul className="space-y-2">
          {sorted.map((d) => {
            const state = resolveDossierState({
              status: d.status,
              scheduled_at: d.scheduled_at,
              started_at: d.started_at,
              completed_at: d.completed_at,
              metadata: d.metadata,
            })
            const pill = getStatusPillProps(state)
            return (
              <li key={d.id}>
                <Link
                  href={`/app/dossiers/${d.id}`}
                  className="block rounded-md border border-rule/50 bg-paper hover:border-ink/30 px-2.5 py-2 transition-colors duration-fast"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-mono text-[10px] text-ink-faint truncate">{d.reference}</p>
                    <StatusPill variant={pill.variant} label={pill.label} size="sm" />
                  </div>
                  {d.address ? (
                    <p className="text-[11px] text-ink-soft mt-0.5 truncate">{d.address}</p>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-[11px] text-ink-faint">Aucun autre dossier pour ce client.</p>
      )}
    </Card>
  )
}
