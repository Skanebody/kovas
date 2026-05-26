import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { AlertTriangle, Info } from 'lucide-react'

interface PreExportSectionProps {
  /** Score ADEME 0-100. Si null, pas encore calculé. */
  ademeScore: number | null
  /** Max 3 findings (forte priorité). */
  findings: ReadonlyArray<{ id: string; severity: 'info' | 'warn' | 'block'; message: string }>
}

/**
 * Section 4 — Pré-vérification ADEME.
 * Anticipe les rejets ADEME avant l'envoi. V1 = placeholder score + findings synthétiques.
 * Phase 2 = règles complètes 3CL-2021.
 */
export function PreExportSection({ ademeScore, findings }: PreExportSectionProps) {
  const limited = findings.slice(0, 3)
  const variant: 'green' | 'yellow' | 'red' =
    ademeScore == null ? 'yellow' : ademeScore >= 90 ? 'green' : ademeScore >= 70 ? 'yellow' : 'red'

  return (
    <Card variant="flat" padding="default" id="pre-export" className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#0F1419]">Pré-vérification ADEME</h2>
          <p className="text-[12px] text-[#0F1419]/72 mt-0.5">
            Détecte les rejets probables avant envoi.
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/55">
          Section 04
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-md border border-[#0F1419]/[0.08] bg-cream-deep/30 p-4 min-w-[140px]">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/72">
            Score
          </p>
          <p className="mt-1 font-serif italic text-[36px] leading-none text-[#0F1419]">
            {ademeScore != null ? ademeScore : '—'}
          </p>
          <p className="mt-1 text-[11px] text-[#0F1419]/72">/ 100</p>
          <Badge variant={variant} className="mt-2">
            {ademeScore == null
              ? 'Non calculé'
              : ademeScore >= 90
                ? 'Prêt'
                : ademeScore >= 70
                  ? 'À revoir'
                  : 'Risque rejet'}
          </Badge>
        </div>

        <div className="flex-1 min-w-[260px]">
          {limited.length > 0 ? (
            <ul className="space-y-2">
              {limited.map((f) => (
                <li
                  key={f.id}
                  className="flex items-start gap-2 rounded-md border border-[#0F1419]/[0.08] bg-paper px-3 py-2 text-[13px] text-[#0F1419]/82"
                >
                  {f.severity === 'block' ? (
                    <AlertTriangle className="size-4 text-danger shrink-0 mt-0.5" />
                  ) : f.severity === 'warn' ? (
                    <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                  ) : (
                    <Info className="size-4 text-info shrink-0 mt-0.5" />
                  )}
                  <span>{f.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[#0F1419]/72">
              {ademeScore == null
                ? 'La pré-vérification ADEME complète sera disponible en Phase 2.'
                : 'Aucun point bloquant détecté.'}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
