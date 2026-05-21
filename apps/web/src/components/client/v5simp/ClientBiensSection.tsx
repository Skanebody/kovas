import { Card } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import Link from 'next/link'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  maison: 'Maison',
  appartement: 'Appartement',
  immeuble: 'Immeuble',
  local_commercial: 'Local commercial',
  bureau: 'Bureau',
  autre: 'Autre',
}

export interface ClientBien {
  id: string
  address: string
  city: string | null
  postal_code: string | null
  property_type: string | null
  surface_total: number | null
  dossiers_count: number
}

interface Props {
  clientId: string
  biens: ClientBien[]
}

/**
 * Section 2 — Biens (page client SIMP-2).
 * Grille horizontale scrollable de cards 280px de large + 1 card "Ajouter".
 */
export function ClientBiensSection({ clientId, biens }: Props) {
  return (
    <section aria-labelledby="client-biens-title" className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h2
          id="client-biens-title"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute"
        >
          Biens
        </h2>
        <span className="font-mono text-[11px] text-ink-mute">{biens.length}</span>
      </header>

      <div className="overflow-x-auto -mx-6 px-6 scrollbar-thin">
        <div className="flex gap-3 pb-2">
          {biens.map((bien) => (
            <BienCard key={bien.id} bien={bien} />
          ))}
          <AddBienCard clientId={clientId} />
        </div>
      </div>
    </section>
  )
}

function BienCard({ bien }: { bien: ClientBien }) {
  const typeLabel = bien.property_type
    ? (PROPERTY_TYPE_LABELS[bien.property_type] ?? bien.property_type)
    : null
  const cityLine = [bien.postal_code, bien.city].filter(Boolean).join(' ')

  return (
    <Link
      href={`/dashboard/properties/${bien.id}`}
      className="block w-[280px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 rounded-xl"
    >
      <Card
        variant="opaque"
        padding="default"
        className="h-full hover:border-foreground/30 transition-colors"
      >
        <div className="flex h-full flex-col gap-3">
          <div className="space-y-1">
            <p className="font-sans text-[14px] font-medium leading-snug text-ink line-clamp-2">
              {bien.address}
            </p>
            {cityLine ? <p className="text-[12px] text-ink-mute">{cityLine}</p> : null}
          </div>

          <dl className="mt-auto space-y-1.5 pt-3">
            {typeLabel ? (
              <div className="flex items-center justify-between">
                <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
                  Type
                </dt>
                <dd className="font-mono text-[12px] text-ink">{typeLabel}</dd>
              </div>
            ) : null}
            {bien.surface_total ? (
              <div className="flex items-center justify-between">
                <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
                  Surface
                </dt>
                <dd className="font-mono text-[12px] text-ink">{bien.surface_total} m²</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
                Dossiers
              </dt>
              <dd className="font-mono text-[12px] text-ink">{bien.dossiers_count}</dd>
            </div>
          </dl>
        </div>
      </Card>
    </Link>
  )
}

function AddBienCard({ clientId }: { clientId: string }) {
  return (
    <Link
      href={`/dashboard/properties/new?client_id=${clientId}`}
      className="flex w-[280px] shrink-0 items-center justify-center rounded-xl border border-dashed border-foreground/30 p-7 text-ink-mute hover:border-foreground/50 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 min-h-[180px]"
    >
      <div className="flex flex-col items-center gap-2">
        <Plus className="size-8" strokeWidth={2} />
        <span className="font-mono text-[11px] uppercase tracking-[0.1em]">Ajouter un bien</span>
      </div>
    </Link>
  )
}
