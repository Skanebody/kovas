/**
 * KOVAS — Preview compact du dossier de défense.
 *
 * À intégrer dans la page dossier principale (`/app/dossiers/[id]`) ou
 * partout où on veut un aperçu rapide de l'état du défense dossier
 * (existence, statut PDF, dernier horodatage).
 *
 * Server component (composé via les données chargées en amont).
 */

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShieldCheck, ArrowRight, Image as ImageIcon, MapPin } from 'lucide-react'
import Link from 'next/link'

export interface DefenseDossierPreviewData {
  /** UUID du défense dossier (null = pas encore créé). */
  id: string | null
  /** UUID de la mission rattachée. */
  missionId: string
  /** UUID du dossier client (pour navigation). */
  dossierId: string
  /** Nb photos contextuelles attachées. */
  photosCount: number
  /** Geolocalisation visite enregistrée ? */
  hasGeolocation: boolean
  /** PDF généré ? */
  pdfUrl: string | null
  /** Hash SHA-256 (preuve d'intégrité). */
  sha256: string | null
  /** Statut horodatage qualifié (V2). */
  timestampStatus: 'none' | 'stub' | 'qualified'
  /** Date de dernière génération. */
  generatedAt: string | null
}

export function DefenseDossierPreview({ data }: { data: DefenseDossierPreviewData }) {
  const hasDossier = data.id !== null

  return (
    <Card variant="opaque" padding="default" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-5 text-ink" />
          <div>
            <h3 className="text-[15px] font-semibold text-ink">Dossier de défense</h3>
            <p className="text-[11px] text-ink-mute">
              Preuves contextuelles + horodatage du diagnostic
            </p>
          </div>
        </div>
        {hasDossier ? (
          <Badge variant="green">Actif</Badge>
        ) : (
          <Badge variant="muted">Non créé</Badge>
        )}
      </div>

      {hasDossier ? (
        <div className="grid grid-cols-3 gap-3 text-center">
          <Metric icon={<ImageIcon className="size-3.5" />} label="Photos" value={data.photosCount} />
          <Metric
            icon={<MapPin className="size-3.5" />}
            label="Géoloc"
            value={data.hasGeolocation ? 'OK' : '—'}
          />
          <Metric
            icon={<ShieldCheck className="size-3.5" />}
            label="PDF"
            value={data.pdfUrl ? 'Prêt' : '—'}
          />
        </div>
      ) : null}

      {data.sha256 ? (
        <p className="font-mono text-[10px] text-ink-faint truncate">
          SHA-256 · {data.sha256.slice(0, 24)}…
        </p>
      ) : null}

      <div className="flex items-center justify-end pt-2 border-t border-rule">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/dossiers/${data.dossierId}/defense`}>
            Ouvrir le dossier <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </Card>
  )
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-md border border-rule bg-paper/60 p-2.5 space-y-1">
      <div className="flex items-center justify-center gap-1 text-ink-mute">
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-[15px] font-semibold text-ink">{value}</p>
    </div>
  )
}
