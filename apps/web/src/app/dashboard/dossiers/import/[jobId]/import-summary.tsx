import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, Building2, Check, Users } from 'lucide-react'
import Link from 'next/link'

interface ImportSummaryProps {
  jobId: string
  filename: string
  imported: {
    clients: number
    properties: number
    coproprietes: number
    lots: number
  }
  merged: {
    clients: number
    properties: number
    coproprietes: number
  }
}

/**
 * Écran final après commit réussi d'un import Liciel.
 * Affiche les compteurs imported / merged + 2 CTA pour aller voir les
 * données fraîchement importées.
 */
export function ImportSummary({ jobId, filename, imported, merged }: ImportSummaryProps) {
  const totalImported =
    imported.clients + imported.properties + imported.coproprietes + imported.lots
  const totalMerged = merged.clients + merged.properties + merged.coproprietes

  return (
    <div className="space-y-6 animate-fade-in">
      <Card variant="accent" padding="lg">
        <CardContent className="pt-2 space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-chartreuse text-ink">
              <Check className="size-5" strokeWidth={3} />
            </span>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-paper/70">
                Import {jobId.slice(0, 8)} · {filename}
              </p>
              <h2 className="font-serif italic font-normal text-2xl md:text-3xl text-paper leading-tight">
                Import terminé.
              </h2>
            </div>
          </div>

          <p className="text-sm text-paper/85">
            {totalImported} nouvel{totalImported > 1 ? 's' : ''} élément
            {totalImported > 1 ? 's' : ''} ajouté
            {totalImported > 1 ? 's' : ''} à ta base
            {totalMerged > 0 && (
              <>
                {' '}
                · {totalMerged} fusionné{totalMerged > 1 ? 's' : ''} dans des fiches existantes
              </>
            )}
            .
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryStat label="Clients" value={imported.clients} merged={merged.clients} />
        <SummaryStat label="Biens" value={imported.properties} merged={merged.properties} />
        <SummaryStat
          label="Copropriétés"
          value={imported.coproprietes}
          merged={merged.coproprietes}
        />
        <SummaryStat label="Lots" value={imported.lots} merged={0} />
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-end">
        <Button variant="outline" asChild>
          <Link href="/dashboard/dossiers">
            <Building2 className="size-4" /> Voir mes dossiers
          </Link>
        </Button>
        <Button variant="accent" size="lg" asChild>
          <Link href="/dashboard/clients">
            <Users className="size-4" /> Voir mes clients <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  merged,
}: {
  label: string
  value: number
  merged: number
}) {
  return (
    <Card variant="opaque" padding="sm">
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">{label}</p>
        <p className="font-serif italic font-normal text-3xl text-ink leading-none tabular-nums">
          {value}
        </p>
        <p className="text-[11px] text-ink-mute">
          {merged > 0 ? (
            <>
              +<span className="tabular-nums">{merged}</span> fusionné
              {merged > 1 ? 's' : ''}
            </>
          ) : (
            `nouveau${value > 1 ? 'x' : ''}`
          )}
        </p>
      </div>
    </Card>
  )
}
