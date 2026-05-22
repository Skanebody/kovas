import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, FileArchive, FileText, FileSpreadsheet, FileJson } from 'lucide-react'

interface ExportItem {
  id: string
  label: string
  kind: 'zip' | 'pdf' | 'csv' | 'json' | 'word'
  generatedAt: string | null
  size: string | null
  /** Optionnel : URL signée téléchargement. Si null, bouton "Générer". */
  url: string | null
}

interface ExportsSectionProps {
  dossierId: string
  exports: ReadonlyArray<ExportItem>
}

const KIND_ICON = {
  zip: FileArchive,
  pdf: FileText,
  csv: FileSpreadsheet,
  json: FileJson,
  word: FileText,
}

/**
 * Section 5 — Exports + fichiers générés.
 * Liste les artefacts disponibles (Liciel XML/ZIP, PDF, CSV, JSON).
 */
export function ExportsSection({ dossierId, exports }: ExportsSectionProps) {
  return (
    <Card variant="flat" padding="default" id="exports" className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Exports & fichiers</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">Section 05</p>
      </div>

      {exports.length > 0 ? (
        <ul className="divide-y divide-rule/60 rounded-md border border-rule/60">
          {exports.map((ex) => {
            const Icon = KIND_ICON[ex.kind]
            return (
              <li key={ex.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="size-4 text-ink-mute shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink truncate">{ex.label}</p>
                    <p className="text-[11px] text-ink-faint">
                      {ex.generatedAt
                        ? new Date(ex.generatedAt).toLocaleDateString('fr-FR', { dateStyle: 'short' })
                        : 'Non généré'}
                      {ex.size ? ` · ${ex.size}` : ''}
                    </p>
                  </div>
                </div>
                {ex.url ? (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={ex.url} download>
                      <Download className="size-3.5" />
                      Télécharger
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Générer
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-rule/60 bg-cream-deep/30 p-4 text-center text-[13px] text-ink-mute">
          Aucun export généré. Les exports seront disponibles après validation du dossier.
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/dossiers/${dossierId}/calendar.ics`} download>
            <Download className="size-3.5" /> Calendrier .ics
          </a>
        </Button>
      </div>
    </Card>
  )
}
