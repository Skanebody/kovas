import { Card } from '@/components/ui/card'
import { FileText } from 'lucide-react'
import { HistoricalDocumentsUploader } from './HistoricalDocumentsUploader'

export type HistoricalDocumentCategory =
  | 'previous_dpe'
  | 'previous_amiante'
  | 'plans'
  | 'energy_bills'
  | 'notary_acts'
  | 'historical_photos'
  | 'other'

export interface HistoricalDocumentItem {
  id: string
  category: HistoricalDocumentCategory
  storage_path: string
  original_filename: string | null
  file_size_bytes: number | null
  mime_type: string | null
  uploaded_at: string
  ai_extraction_status: 'pending' | 'running' | 'done' | 'failed' | 'skipped' | null
  ai_extracted_data: Record<string, unknown> | null
  signed_url: string | null
}

export const HISTORICAL_DOC_CATEGORIES: Array<{
  value: HistoricalDocumentCategory
  label: string
}> = [
  { value: 'previous_dpe', label: 'Ancien DPE' },
  { value: 'previous_amiante', label: 'Ancien amiante' },
  { value: 'plans', label: 'Plans' },
  { value: 'energy_bills', label: 'Factures énergie' },
  { value: 'notary_acts', label: 'Actes notariés' },
  { value: 'historical_photos', label: 'Photos anciennes' },
  { value: 'other', label: 'Autre' },
]

const CATEGORY_LABEL: Record<HistoricalDocumentCategory, string> = HISTORICAL_DOC_CATEGORIES.reduce(
  (acc, c) => {
    acc[c.value] = c.label
    return acc
  },
  {} as Record<HistoricalDocumentCategory, string>,
)

interface HistoricalDocumentsSectionProps {
  dossierId: string
  documents: ReadonlyArray<HistoricalDocumentItem>
}

function formatBytes(b: number | null): string {
  if (b === null || b === undefined) return '—'
  if (b < 1024) return `${b} o`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} ko`
  return `${(b / 1024 / 1024).toFixed(1)} Mo`
}

/**
 * Section 04bis — Documents historiques du bien (Chantier B / FIX-KK §B).
 *
 * Permet au diagnostiqueur d'uploader scans / PDF / photos d'anciens
 * documents liés au bien (DPE, amiante, plans, factures énergie, actes
 * notariés, photos anciennes). Extraction IA Vision possible pour les
 * anciens diagnostics (déclenchée en arrière-plan).
 */
export function HistoricalDocumentsSection({
  dossierId,
  documents,
}: HistoricalDocumentsSectionProps) {
  // Grouper par catégorie (ordre fixe)
  const grouped: Record<HistoricalDocumentCategory, HistoricalDocumentItem[]> = {
    previous_dpe: [],
    previous_amiante: [],
    plans: [],
    energy_bills: [],
    notary_acts: [],
    historical_photos: [],
    other: [],
  }
  for (const d of documents) {
    grouped[d.category]?.push(d)
  }

  return (
    <Card variant="flat" padding="default" id="historical-documents" className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Documents historiques du bien</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">
          Section 04 bis
        </p>
      </div>

      <p className="text-[12px] text-ink-mute">
        Scans des anciens diagnostics, plans, factures d'énergie, actes notariés. Pour les anciens
        DPE et amiante, l'extraction automatique peut pré-remplir le nouveau dossier.
      </p>

      <HistoricalDocumentsUploader dossierId={dossierId} />

      {documents.length === 0 ? (
        <div className="rounded-md border border-dashed border-rule/60 bg-cream-deep/30 p-6 text-center text-[13px] text-ink-mute">
          Aucun document historique pour le moment.
        </div>
      ) : (
        <div className="space-y-4">
          {HISTORICAL_DOC_CATEGORIES.map((cat) => {
            const items = grouped[cat.value]
            if (items.length === 0) return null
            return (
              <div key={cat.value}>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                  {CATEGORY_LABEL[cat.value]} · {items.length}
                </p>
                <ul className="divide-y divide-rule/60 rounded-md border border-rule/60">
                  {items.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="size-4 text-ink-mute shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-ink truncate">
                            {d.original_filename ?? 'Document'}
                          </p>
                          <p className="font-mono text-[10px] text-ink-faint">
                            {new Date(d.uploaded_at).toLocaleDateString('fr-FR', {
                              dateStyle: 'short',
                            })}
                            {' · '}
                            {formatBytes(d.file_size_bytes)}
                            {d.ai_extraction_status === 'done' && d.ai_extracted_data ? (
                              <span className="ml-2 text-accent-green">IA extraite</span>
                            ) : d.ai_extraction_status === 'running' ? (
                              <span className="ml-2 text-ink-mute">IA en cours…</span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {d.signed_url ? (
                          <a
                            href={d.signed_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[12px] text-ink hover:underline"
                          >
                            Ouvrir
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
